import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://esm.sh/openai@4.20.1'

console.log('Loading generate-description function...')

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse and validate request body
    const bodyText = await req.text()
    console.log('Raw request body:', bodyText)

    const body = bodyText ? JSON.parse(bodyText) : null
    if (!body) {
      throw new Error('Request body is empty')
    }

    const { listingId, descriptionId, options, listingData } = body
    console.log('Parsed request data:', { listingId, descriptionId, options, listingData })

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

    // Build the prompt
    const prompt = `Generate a compelling real estate description for the following property:

Address: ${listingData.address}
Type: ${listingData.propertyType} for ${listingData.listingType}
Price: ${listingData.price}
Bedrooms: ${listingData.bedrooms}
Bathrooms: ${listingData.bathrooms}
Parking: ${listingData.parking}
Lot Size: ${listingData.lotSize}
Interior Size: ${listingData.interiorSize}
Property Highlights: ${listingData.propertyHighlights?.join(', ')}
Location Highlights: ${listingData.locationHighlights?.join(', ')}
Location Notes: ${listingData.locationNotes}
Other Details: ${listingData.otherDetails}

Please write a ${options.length} description.
Use a ${options.style} style.
Format as ${options.format}.
Use ${options.tone} tone.`

    console.log('Generating with prompt:', prompt)

    // Generate the description
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an experienced real estate copywriter who creates compelling property descriptions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    const generatedContent = completion.choices[0].message.content

    console.log('Generated content:', generatedContent)

    // Update the specific description record
    const { error: updateError } = await supabaseClient
      .from('generated_descriptions')
      .update({ 
        content: generatedContent,
        status: 'completed'
      })
      .eq('id', descriptionId)
      .eq('status', 'generating')

    if (updateError) {
      console.error('Error updating description:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        content: generatedContent
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-description' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
