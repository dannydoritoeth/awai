import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import OpenAI from 'https://esm.sh/openai@4.86.1';
import { HubspotClient } from '../_shared/hubspotClient.ts';
import { Logger } from '../_shared/logger.ts';
import { decrypt } from '../_shared/encryption.ts';
import { DocumentPackager } from '../_shared/documentPackager.ts';
import { handleApiCall } from '../_shared/apiHandler.ts';
import { processSingleDeal } from '../_shared/dealProcessor.ts';
import { calculateDealStatistics } from '../_shared/statistics.ts';
import { PineconeClient } from '../_shared/pineconeClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const logger = new Logger('hubspot-train-deal');
  try {
    // Parse URL parameters
    const url = new URL(req.url);
    const object_id = url.searchParams.get('object_id');

    if (!object_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: object_id' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get record status
    const { data: recordStatus, error: statusError } = await supabase
      .from('hubspot_object_status')
      .select('*')
      .eq('object_id', object_id)
      .single();

    if (statusError || !recordStatus) {
      return new Response(
        JSON.stringify({ error: 'Record not found in status table' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if record is already processed
    if (recordStatus.training_status === 'completed') {
      return new Response(
        JSON.stringify({ message: 'Record already processed', status: recordStatus }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Update status to in_progress
    await supabase
      .from('hubspot_object_status')
      .update({ training_status: 'in_progress' })
      .eq('object_id', object_id);

    // Get HubSpot account details
    const { data: account, error: accountError } = await supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('portal_id', recordStatus.portal_id)
      .eq('status', 'active')
      .single();

    if (accountError || !account) {
      await supabase
        .from('hubspot_object_status')
        .update({ 
          training_status: 'failed',
          error_message: 'HubSpot account not found or inactive'
        })
        .eq('object_id', object_id);

      return new Response(
        JSON.stringify({ error: 'HubSpot account not found or inactive' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Initialize clients
    const accessToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    const hubspotClient = new HubspotClient(accessToken);
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
    
    // Initialize Pinecone client
    const pineconeClient = new PineconeClient();
    await pineconeClient.initialize(
      Deno.env.get('PINECONE_API_KEY')!,
      Deno.env.get('PINECONE_INDEX')!
    );
    
    const documentPackager = new DocumentPackager(hubspotClient);

    // Get deal details
    const deal = await handleApiCall(
      hubspotClient,
      recordStatus.portal_id,
      refreshToken,
      () => hubspotClient.getRecord('deals', object_id, [
        'dealname',
        'amount',
        'closedate',
        'createdate',
        'dealstage',
        'pipeline',
        'hs_lastmodifieddate',
        'hs_date_entered_closedwon',
        'hs_date_entered_closedlost',
        'hs_deal_stage_probability',
        'hs_pipeline_stage',
        'hs_time_in_pipeline',
        'hs_time_in_dealstage',
        'hs_deal_stage_changes'
      ])
    );

    if (!deal) {
      await supabase
        .from('hubspot_object_status')
        .update({ 
          training_status: 'failed',
          error_message: 'Deal not found in HubSpot'
        })
        .eq('object_id', object_id);

      return new Response(
        JSON.stringify({ error: 'Deal not found in HubSpot' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Process the deal
    const namespace = `hubspot-${recordStatus.portal_id}`;
    try {
      await processSingleDeal(
        deal,
        recordStatus.classification,
        hubspotClient,
        documentPackager,
        openai,
        pineconeClient,
        recordStatus.portal_id,
        namespace
      );

      // Update statistics if amount is available
      if (deal.properties?.amount) {
        const amount = parseFloat(deal.properties.amount);
        if (!isNaN(amount) && amount > 0) {
          // Get current statistics
          const { data: currentStats, error: statsError } = await supabase
            .from('hubspot_accounts')
            .select(`
              ideal_count,
              ideal_high,
              ideal_low,
              ideal_median,
              nonideal_count,
              nonideal_high,
              nonideal_low,
              nonideal_median,
              current_ideal_deals,
              current_less_ideal_deals
            `)
            .eq('portal_id', recordStatus.portal_id)
            .single();

          if (!statsError && currentStats) {
            const stats = calculateDealStatistics([amount]);
            const updateData: any = {
              last_training_date: new Date().toISOString()
            };

            // Update appropriate statistics based on classification
            if (recordStatus.classification === 'ideal') {
              // Get all the amounts for proper median calculation
              const amounts = [];
              
              // If we have existing data and count, create a synthetic array based on existing median
              if (currentStats.ideal_count > 0 && currentStats.ideal_median !== null) {
                // Simulate the existing distribution using the current median
                for (let i = 0; i < currentStats.ideal_count; i++) {
                  amounts.push(currentStats.ideal_median);
                }
              }
              
              // Add the new amount
              amounts.push(amount);
              
              // Calculate new statistics with all amounts
              const newStats = calculateDealStatistics(amounts);
              
              updateData.ideal_count = (currentStats.ideal_count || 0) + 1;
              updateData.ideal_high = Math.max(stats.high, currentStats.ideal_high || 0);
              updateData.ideal_low = currentStats.ideal_low === null 
                ? stats.low 
                : Math.min(stats.low, currentStats.ideal_low);
              updateData.ideal_median = newStats.median;
              updateData.ideal_last_trained = new Date().toISOString();
              updateData.current_ideal_deals = (currentStats.current_ideal_deals || 0) + 1;
              
              logger.info(`Ideal deal update: count=${updateData.ideal_count}, high=${updateData.ideal_high}, low=${updateData.ideal_low}, median=${updateData.ideal_median}`);
            } else {
              // Get all the amounts for proper median calculation
              const amounts = [];
              
              logger.info(`Processing NONIDEAL deal with amount: ${amount}`);
              logger.info(`Current nonideal stats: count=${currentStats.nonideal_count}, high=${currentStats.nonideal_high}, low=${currentStats.nonideal_low}, median=${currentStats.nonideal_median}`);
              
              // If we have existing data and count, create a synthetic array based on existing median
              if (currentStats.nonideal_count > 0 && currentStats.nonideal_median !== null) {
                logger.info(`Using existing nonideal_median: ${currentStats.nonideal_median} × ${currentStats.nonideal_count} times`);
                // Simulate the existing distribution using the current median
                for (let i = 0; i < currentStats.nonideal_count; i++) {
                  amounts.push(currentStats.nonideal_median);
                }
              } else {
                logger.info(`No existing nonideal median or count is zero/null`);
              }
              
              // Add the new amount
              amounts.push(amount);
              logger.info(`Added new amount ${amount} to amounts array. Total length: ${amounts.length}`);
              
              // Calculate new statistics with all amounts
              const newStats = calculateDealStatistics(amounts);
              logger.info(`New calculated stats: low=${newStats.low}, high=${newStats.high}, median=${newStats.median}, count=${newStats.count}`);
              
              updateData.nonideal_count = (currentStats.nonideal_count || 0) + 1;
              updateData.nonideal_high = Math.max(stats.high, currentStats.nonideal_high || 0);
              updateData.nonideal_low = currentStats.nonideal_low === null 
                ? stats.low 
                : Math.min(stats.low, currentStats.nonideal_low);
              updateData.nonideal_median = newStats.median;
              updateData.nonideal_last_trained = new Date().toISOString();
              updateData.current_less_ideal_deals = (currentStats.current_less_ideal_deals || 0) + 1;
              
              logger.info(`Nonideal deal update: count=${updateData.nonideal_count}, high=${updateData.nonideal_high}, low=${updateData.nonideal_low}, median=${updateData.nonideal_median}`);
            }

            // Update statistics
            logger.info(`Updating statistics for portal ${recordStatus.portal_id}`);
            
            const { data: updateResult, error: updateStatsError } = await supabase
              .from('hubspot_accounts')
              .update(updateData)
              .eq('portal_id', recordStatus.portal_id);
              
            if (updateStatsError) {
              logger.error(`Error updating statistics: ${updateStatsError.message}`);
            } else {
              logger.info(`Statistics updated successfully`);
            }
          }
        }
      }

      // Update status to completed
      const { error: updateError } = await supabase
        .from('hubspot_object_status')
        .update({ 
          training_status: 'completed',
          training_error: null // Clear any previous error message
        })
        .eq('object_id', object_id);

      if (updateError) {
        logger.error('Error updating status to completed:', updateError);
        throw new Error('Failed to update record status to completed');
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Deal processed successfully',
          deal_id: deal.id,
          status: 'completed'
        }),
        { status: 200, headers: corsHeaders }
      );

    } catch (error) {
      logger.error('Error processing deal:', error);

      // Update status to failed
      await supabase
        .from('hubspot_object_status')
        .update({ 
          training_status: 'failed',
          training_error: error.message
        })
        .eq('object_id', object_id);

      return new Response(
        JSON.stringify({ 
          error: 'Failed to process deal',
          details: error.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

  } catch (error) {
    logger.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});