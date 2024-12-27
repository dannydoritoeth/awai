// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://esm.sh/openai@4.20.1'

console.log('Loading generate-image-caption function...')

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface CaptionOptions {
  style: 'professional' | 'casual' | 'luxury'
  focus: ('features' | 'atmosphere' | 'selling_points')[]
  tone: 'neutral' | 'enthusiastic' | 'sophisticated'
  length: 'short' | 'medium' | 'long'
  includeKeywords: string
}

function generatePrompt(options: CaptionOptions) {
  const lengthGuide = {
    short: 'under 50 characters',
    medium: '50-100 characters',
    long: '100-150 characters'
  }[options.length]

  const styleGuide = {
    professional: 'Use professional and precise language',
    casual: 'Use casual and friendly language',
    luxury: 'Use sophisticated and upscale language'
  }[options.style]

  const toneGuide = {
    neutral: 'Maintain a neutral and factual tone',
    enthusiastic: 'Be enthusiastic and engaging',
    sophisticated: 'Use refined and elegant language'
  }[options.tone]

  const focusAreas = options.focus.map((focus) => {
    switch (focus) {
      case 'features': return 'physical features and details'
      case 'atmosphere': return 'mood and atmosphere'
      case 'selling_points': return 'key selling points'
    }
  }).join(', ')

  const keywordInstruction = options.includeKeywords
    ? `Try to naturally incorporate these keywords where relevant: ${options.includeKeywords}.`
    : ''

  return `Generate a concise, descriptive caption for this real estate listing image.
${styleGuide}. ${toneGuide}.
Focus on these aspects: ${focusAreas}.
Keep the caption ${lengthGuide}.
${keywordInstruction}
Make it compelling and market-ready.`
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse and validate request body
    const bodyText = await req.text()
    
    const body = bodyText ? JSON.parse(bodyText) : null
    if (!body) {
      throw new Error('Request body is empty')
    }

    const { listingId, options } = body
    console.log('Processing request for listing:', listingId, 'with style:', options.style)

    // Create Supabase client with service role key for admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get all images for this listing
    console.log('Fetching images for listing:', listingId)
    const { data: images, error: fetchError } = await supabaseClient
      .from('listing_images')
      .select('id, url')
      .eq('listing_id', listingId)
      .order('order_index')

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError)
      throw fetchError
    }

    if (!images || images.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No images found for this listing' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    console.log(`Found ${images.length} images to process`)
    const prompt = generatePrompt(options as CaptionOptions)

    // Process one image at a time
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      console.log(`Processing image ${i + 1}/${images.length}`)

      try {
        // Download and convert image
        const { data: imageData } = await supabaseClient.storage
          .from('listing-images')
          .download(image.url)
        
        if (!imageData) {
          console.error('No image data found for image:', image.id)
          continue
        }

        // Convert blob to base64 using chunks
        const chunks: Uint8Array[] = []
        const reader = imageData.stream().getReader()
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
        }

        // Combine chunks and convert to base64
        const blob = new Blob(chunks)
        const base64 = btoa(
          new Uint8Array(await blob.arrayBuffer())
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        )

        // Generate caption
        const completion = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          messages: [
            {
              role: "system",
              content: "You are an experienced real estate photographer who writes compelling image captions."
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { 
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 150
        })

        const caption = completion.choices[0].message.content

        if (caption) {
          // Update the database with the generated caption
          const { error: updateError } = await supabaseClient
            .from('listing_images')
            .update({ caption })
            .eq('id', image.id)

          if (updateError) {
            console.error(`Error updating caption for image ${image.id}:`, updateError)
            continue
          }

          console.log(`Successfully generated and saved caption for image ${i + 1}/${images.length}`)
        }
      } catch (error) {
        console.error(`Error processing image ${image.id}:`, error)
        continue
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Captions generated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-image-caption' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
