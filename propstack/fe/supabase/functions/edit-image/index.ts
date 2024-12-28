import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import OpenAI from 'https://esm.sh/openai@4.24.1'

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

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      throw new Error('Missing environment variables')
    }

    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    })

    // Create Supabase client
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
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

    console.log('Making request to OpenAI API...')

    // Download the original image
    const imageResponse = await fetch(signedUrlData.signedUrl)
    const imageArrayBuffer = await imageResponse.arrayBuffer()
    const imageFile = new File([imageArrayBuffer], 'image.png', { type: 'image/png' })

    // Convert mask from data URL to File
    const maskBase64 = mask.split(',')[1] // Remove the data:image/png;base64, prefix
    const maskBuffer = Uint8Array.from(atob(maskBase64), c => c.charCodeAt(0))
    const maskFile = new File([maskBuffer], 'mask.png', { type: 'image/png' })

    console.log('Calling OpenAI API with image and mask...')

    // Call OpenAI API for image editing
    const response = await openai.images.edit({
      image: imageFile,
      mask: maskFile,
      prompt: description,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json'
    })

    if (!response.data?.[0]?.b64_json) {
      throw new Error('Failed to generate image')
    }

    // Convert base64 to blob
    const generatedImageBase64 = response.data[0].b64_json
    const generatedImageBlob = await (await fetch(
      `data:image/png;base64,${generatedImageBase64}`
    )).blob()

    // Upload to Supabase Storage
    const fileName = `${listingId}/${Date.now()}-edited.png`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('listing-images')
      .upload(fileName, generatedImageBlob, {
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