import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { OpenAI } from "jsr:@openai/openai"
import { createClient } from "jsr:@supabase/supabase-js"

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let listingId: string | undefined

  try {
    const data = await req.json()
    console.log('Received data:', data)
    listingId = data.id

    // Update status to generating
    const { error: updateError1 } = await supabase
      .from('generated_descriptions')
      .update({ status: 'generating' })
      .eq('listing_id', listingId)
      .eq('status', 'processing')

    if (updateError1) throw updateError1

    // Build the prompt
    const formatPrice = (price: string, currency: string = 'USD') => {
      const symbols = {
        USD: '$',
        AUD: '$',
        NZD: '$',
        GBP: '£',
        EUR: '€',
        CAD: '$'
      }
      return `${symbols[currency as keyof typeof symbols] || '$'}${price}`
    }

    const prompt = `Generate a compelling real estate description for the following property:

Address: ${data.address}${data.unitNumber ? ` Unit ${data.unitNumber}` : ''}
Type: ${data.propertyType} for ${data.listingType}
${data.price ? `Price: ${formatPrice(data.price, data.currency)}` : ''}
${data.bedrooms ? `Bedrooms: ${data.bedrooms}` : ''}
${data.bathrooms ? `Bathrooms: ${data.bathrooms}` : ''}
${data.parking ? `Parking: ${data.parking}` : ''}
${data.lotSize ? `Lot Size: ${data.lotSize} ${data.lotSizeUnit}` : ''}
${data.interiorSize ? `Interior Size: ${data.interiorSize}` : ''}
Highlights: ${data.highlights.join(', ')}
${data.otherDetails ? `Additional Details: ${data.otherDetails}` : ''}

Please write a ${data.target_length} ${data.target_unit} description in ${data.language}. 
Focus on the property's unique features and benefits. 
Use a professional tone and avoid clichés.
Highlight the location and any special amenities.
Use ${formatPrice('', data.currency)} as the currency symbol when mentioning price.`

    console.log('Creating OpenAI completion...')
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
    console.log('OpenAI response:', completion)

    const generatedDescription = completion.choices[0].message.content
    console.log('Final description:', generatedDescription)

    // Update with generated content and completed status
    const { error: updateError2 } = await supabase
      .from('generated_descriptions')
      .update({ 
        content: generatedDescription,
        status: 'completed'
      })
      .eq('listing_id', listingId)
      .eq('status', 'generating')

    if (updateError2) throw updateError2

    return new Response(
      JSON.stringify({ description: generatedDescription }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error:', error)

    // Update status to error if something went wrong
    if (listingId) {
      await supabase
        .from('generated_descriptions')
        .update({ status: 'error' })
        .eq('listing_id', listingId)
        .in('status', ['processing', 'generating'])
    }

    return new Response(
      JSON.stringify({ error: error.message }),
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
