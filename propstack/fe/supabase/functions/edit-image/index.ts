import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log('Edit Image function started')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request body
    const { imageId, listingId, mask, mode, description } = await req.json()

    // Validate inputs
    if (!imageId || !listingId || !mask || !mode || !description) {
      throw new Error('Missing required fields')
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get original image
    const { data: imageData } = await supabaseAdmin
      .from('listing_images')
      .select('url')
      .eq('id', imageId)
      .single()

    if (!imageData) {
      throw new Error('Image not found')
    }

    // Get signed URL for the original image
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('listing-images')
      .createSignedUrl(imageData.url, 3600)

    if (!signedUrlData?.signedUrl) {
      throw new Error('Failed to get signed URL')
    }

    // Call Replicate API for image editing
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${Deno.env.get('REPLICATE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "c11bac58203367db93a3c552bd49a25a5418458ddffb7e90dae55780765e26d6",
        input: {
          image: signedUrlData.signedUrl,
          mask: mask,
          prompt: description,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 50,
        },
      }),
    })

    const prediction = await response.json()

    // Poll for completion
    const startTime = Date.now()
    const timeoutDuration = 5 * 60 * 1000 // 5 minutes
    let result = null

    while (Date.now() - startTime < timeoutDuration) {
      const pollResponse = await fetch(prediction.urls.get, {
        headers: {
          'Authorization': `Token ${Deno.env.get('REPLICATE_API_KEY')}`,
        },
      })
      
      const pollResult = await pollResponse.json()
      
      if (pollResult.status === 'succeeded') {
        result = pollResult.output[0]
        break
      } else if (pollResult.status === 'failed') {
        throw new Error('Image generation failed')
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    if (!result) {
      throw new Error('Generation timed out')
    }

    // Download the generated image
    const imageResponse = await fetch(result)
    const imageBlob = await imageResponse.blob()

    // Upload to Supabase Storage
    const fileName = `${listingId}/${Date.now()}-edited.png`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('listing-images')
      .upload(fileName, imageBlob, {
        contentType: 'image/png',
        cacheControl: '3600',
      })

    if (uploadError) {
      throw uploadError
    }

    // Create new image record
    const { data: newImage, error: dbError } = await supabaseAdmin
      .from('listing_images')
      .insert({
        listing_id: listingId,
        url: fileName,
        order_index: 999, // Add to end
      })
      .select()
      .single()

    if (dbError) {
      throw dbError
    }

    return new Response(
      JSON.stringify({ success: true, image: newImage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (err) {
    console.error('Error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 