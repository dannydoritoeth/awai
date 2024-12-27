import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Loading generate-description function...')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
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

    const { listingId, options, listingData } = body
    console.log('Parsed request data:', { listingId, options, listingData })

    // Validate required data
    if (!listingId) {
      throw new Error('Missing listingId')
    }

    // Create Supabase client with service role key for admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role key instead
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify listing exists using RLS-bypassing query
    const { data: listings, error: listingError } = await supabaseClient
      .from('listings')
      .select('id')
      .eq('id', listingId)

    if (listingError) {
      console.error('Error fetching listing:', listingError)
      throw new Error(`Database error: ${listingError.message}`)
    }

    if (!listings || listings.length === 0) {
      throw new Error(`Listing not found: ${listingId}`)
    }

    // Use the provided listing data instead of fetching it again
    const listing = listingData

    // Update description status
    const { error: updateError } = await supabaseClient
      .from('listings')
      .update({ description_status: 'in_progress' })
      .eq('id', listingId)

    if (updateError) {
      console.error('Error updating listing status:', updateError)
      throw new Error(`Failed to update listing status: ${updateError.message}`)
    }

    console.log('Listing status updated to in_progress')

    // Generate description logic here
    // ... your existing generation code ...

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Description generation started'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Edge function error:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: {
          name: error.name,
          stack: error.stack,
          cause: error.cause
        }
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
