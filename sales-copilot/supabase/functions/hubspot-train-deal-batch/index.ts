import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Logger } from '../_shared/logger.ts';
import { sleep } from '../_shared/utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const logger = new Logger('hubspot-train-deal-batch');
  
  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get a distinct list of portal_ids with pending training
    const { data: portalIds, error: portalError } = await supabase
      .from('hubspot_object_status')
      .select('portal_id')
      .eq('training_status', 'queued')
      .eq('object_type', 'deal')
      .limit(1);

    if (portalError) {
      logger.error('Error fetching portal IDs:', portalError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch portal IDs', details: portalError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!portalIds.length) {
      return new Response(
        JSON.stringify({ message: 'No pending deals found' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const portalId = portalIds[0].portal_id;
    logger.info(`Processing batch for portal ${portalId}`);

    // Get up to 10 pending records for this portal
    const { data: pendingDeals, error: dealsError } = await supabase
      .from('hubspot_object_status')
      .select('*')
      .eq('training_status', 'queued')
      .eq('portal_id', portalId)
      .eq('object_type', 'deal')
      .limit(10);

    if (dealsError) {
      logger.error('Error fetching pending deals:', dealsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending deals', details: dealsError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!pendingDeals.length) {
      return new Response(
        JSON.stringify({ message: `No pending deals found for portal ${portalId}` }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get the base URL for the hubspot-train-deal function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const trainDealUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal`;
    
    logger.info(`Train deal URL: ${trainDealUrl}`);

    // Process each deal
    logger.info(`Starting to process ${pendingDeals.length} deals`);
    
    // Fire off all training requests without waiting for responses
    pendingDeals.forEach((deal, i) => {
      logger.info(`Calling training for deal ${deal.object_id} (${i + 1}/${pendingDeals.length})`);
      
      // Fire and forget - don't await
      fetch(`${trainDealUrl}?object_id=${deal.object_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        }
      }).catch(error => {
        logger.error(`Error initiating training for deal ${deal.object_id}:`, error);
      });
    });

    // After processing the current batch, check if there are still pending records
    const { count: remainingCount, error: countError } = await supabase
      .from('hubspot_object_status')
      .select('*', { count: 'exact', head: true })
      .eq('portal_id', portalId)
      .eq('training_status', 'queued')
      .eq('object_type', 'deal');

    let recursionInitiated = false;
    
    if (countError) {
      logger.error('Error checking for remaining pending deals:', countError);
    } else {
      logger.info(`Remaining pending deals for portal ${portalId}: ${remainingCount}`);
      
      if (remainingCount > 0) {
        // Indicate that recursion should happen
        recursionInitiated = true;
        logger.info(`Found ${remainingCount} more pending deals to process in the next batch`);
      } else {
        logger.info('No more pending deals, batch processing complete');
      }
    }

    // Create response object to return immediately
    const responseObj = {
      success: true, 
      message: `Processing batch of ${pendingDeals.length} deals for portal ${portalId}`,
      deals: pendingDeals.map(deal => deal.object_id),
      results: pendingDeals.map(deal => ({
        dealId: deal.object_id,
        status: 'initiated',
        response: 'Training initiated'
      })),
      remaining_deals: 0
    };
    
    // Prepare to return response
    const response = new Response(
      JSON.stringify(responseObj),
      { status: 200, headers: corsHeaders }
    );
    
    // Before returning response, trigger next batch if needed
    if (recursionInitiated) {
      // We need to trigger the next batch but not wait for it to complete
      try {
        logger.info('Initiating next batch processing');
        
        // Explicit absolute URL with full URL construction
        const batchUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal-batch`;
        
        logger.info(`Making absolute request to: ${batchUrl}`);
        
        // Fire and forget - don't await
        fetch(batchUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          }
        }).catch(err => {
          logger.error(`Failed to trigger next batch: ${err.message}`);
        });
        
        logger.info(`Triggered next batch processing via absolute URL`);
      } catch (error) {
        logger.error(`Error initiating next batch: ${error.message}`);
      }
    }
    
    return response;

  } catch (error) {
    logger.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}); 