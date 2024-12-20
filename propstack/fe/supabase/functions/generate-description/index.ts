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

    // Simple OpenAI test
    console.log('Creating OpenAI completion...')
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant."
        },
        {
          role: "user",
          content: "Say hello!"
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    })
    console.log('OpenAI response:', completion)

    const testResponse = completion.choices[0].message.content
    console.log('Final response:', testResponse)

    // Update with generated content and completed status
    const { error: updateError2 } = await supabase
      .from('generated_descriptions')
      .update({ 
        content: testResponse,
        status: 'completed'
      })
      .eq('listing_id', listingId)
      .eq('status', 'generating')

    if (updateError2) throw updateError2

    return new Response(
      JSON.stringify({ description: testResponse }),
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
