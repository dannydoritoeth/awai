import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { HubspotClient } from '../_shared/hubspotClient.ts';
import { Logger } from '../_shared/logger.ts';
import { decrypt } from '../_shared/encryption.ts';
import { handleApiCall } from '../_shared/apiHandler.ts';
import { createIdealDealsSearchCriteria, createNonIdealDealsSearchCriteria } from '../_shared/hubspotQueries.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const logger = new Logger('hubspot-sync-training-objects');
  try {
    // Parse request parameters
    const url = new URL(req.url);
    const portal_id = url.searchParams.get('portal_id');
    
    if (!portal_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: portal_id' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get HubSpot account details
    const { data: account, error: accountError } = await supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('portal_id', portal_id)
      .eq('status', 'active')
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: 'HubSpot account not found or inactive' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Initialize HubSpot client and decrypt tokens
    const accessToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    const hubspotClient = new HubspotClient(accessToken);

    // Track results
    const results = {
      ideal_deals: 0,
      nonideal_deals: 0,
      new_records: 0,
      existing_records: 0
    };

    // Process ideal deals
    logger.info('Fetching ideal deals...');
    const idealSearchCriteria = createIdealDealsSearchCriteria(100); // Get up to 100 deals at a time
    const idealDeals = await handleApiCall(
      hubspotClient,
      portal_id,
      refreshToken,
      async () => {
        const response = await hubspotClient.searchRecords('deals', idealSearchCriteria);
        return response;
      }
    );

    if (idealDeals.results) {
      results.ideal_deals = idealDeals.results.length;
      // Insert records for ideal deals
      for (const deal of idealDeals.results) {
        const { data, error } = await supabase
          .from('hubspot_object_status')
          .upsert({
            portal_id,
            object_type: 'deal',
            object_id: deal.id,
            classification: 'ideal',
            training_status: 'pending'
          }, {
            onConflict: 'portal_id,object_type,object_id',
            ignoreDuplicates: true
          });

        if (!error) {
          if (data && data.length > 0) {
            results.new_records++;
          } else {
            results.existing_records++;
          }
        }
      }
    }

    // Process non-ideal deals
    logger.info('Fetching non-ideal deals...');
    const nonIdealSearchCriteria = createNonIdealDealsSearchCriteria(100); // Get up to 100 deals at a time
    const nonIdealDeals = await handleApiCall(
      hubspotClient,
      portal_id,
      refreshToken,
      async () => {
        const response = await hubspotClient.searchRecords('deals', nonIdealSearchCriteria);
        return response;
      }
    );

    if (nonIdealDeals.results) {
      results.nonideal_deals = nonIdealDeals.results.length;
      // Insert records for non-ideal deals
      for (const deal of nonIdealDeals.results) {
        const { data, error } = await supabase
          .from('hubspot_object_status')
          .upsert({
            portal_id,
            object_type: 'deal',
            object_id: deal.id,
            classification: 'nonideal',
            training_status: 'pending'
          }, {
            onConflict: 'portal_id,object_type,object_id',
            ignoreDuplicates: true
          });

        if (!error) {
          if (data && data.length > 0) {
            results.new_records++;
          } else {
            results.existing_records++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully synced training objects',
        results
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    logger.error('Error syncing training objects:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}); 