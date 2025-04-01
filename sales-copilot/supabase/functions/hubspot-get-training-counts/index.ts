import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Minimum required training counts for each type
const MIN_TRAINING_COUNTS = {
  companies: 10,
  contacts: 10,
  deals: 10
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get portalId from URL parameters
    const url = new URL(req.url);
    const portalId = url.searchParams.get('portalId');

    if (!portalId) {
      throw new Error('Portal ID is required')
    }

    console.log('Fetching data for portalId:', portalId);

    // Query hubspot_accounts table for the account settings
    const { data: accountData, error: accountError } = await supabaseClient
      .from('hubspot_accounts')
      .select(`
        current_ideal_companies,
        current_less_ideal_companies,
        current_ideal_contacts,
        current_less_ideal_contacts,
        current_ideal_deals,
        current_less_ideal_deals
      `)
      .eq('portal_id', portalId)
      .single()

    if (accountError) {
      console.error('Database error:', accountError);
      throw new Error(`Error fetching account data: ${accountError.message}`)
    }

    console.log('Account data:', accountData);

    // Return the counts
    return new Response(
      JSON.stringify({
        success: true,
        result: {
          companies: {
            current: {
              ideal: accountData?.current_ideal_companies || 0,
              less_ideal: accountData?.current_less_ideal_companies || 0
            },
            required: {
              ideal: MIN_TRAINING_COUNTS.companies,
              less_ideal: MIN_TRAINING_COUNTS.companies
            }
          },
          contacts: {
            current: {
              ideal: accountData?.current_ideal_contacts || 0,
              less_ideal: accountData?.current_less_ideal_contacts || 0
            },
            required: {
              ideal: MIN_TRAINING_COUNTS.contacts,
              less_ideal: MIN_TRAINING_COUNTS.contacts
            }
          },
          deals: {
            current: {
              ideal: accountData?.current_ideal_deals || 0,
              less_ideal: accountData?.current_less_ideal_deals || 0
            },
            required: {
              ideal: MIN_TRAINING_COUNTS.deals,
              less_ideal: MIN_TRAINING_COUNTS.deals
            }
          }
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
}) 