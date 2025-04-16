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
    
    const documentPackager = new DocumentPackager(hubspotClient, refreshToken, recordStatus.portal_id);

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
      logger.info(`Starting deal processing for ${deal.id} (${recordStatus.classification})`);
      await processSingleDeal(
        deal,
        recordStatus.classification,
        hubspotClient,
        documentPackager,
        openai,
        pineconeClient,
        recordStatus.portal_id,
        namespace,
        refreshToken
      );

      // Update status to completed
      logger.info(`Updating status to completed for deal ${deal.id}`);
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('hubspot_object_status')
        .update({ 
          training_status: 'completed',
          training_date: now,
          last_processed: now,
          training_error: null // Clear any previous error
        })
        .eq('object_id', object_id);

      if (updateError) {
        logger.error(`Failed to update status to completed: ${updateError.message}`);
        throw new Error(`Failed to update training status: ${updateError.message}`);
      }

      logger.info(`Successfully updated status to completed for deal ${deal.id}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Deal processed successfully',
          deal_id: deal.id
        }),
        { status: 200, headers: corsHeaders }
      );
    } catch (error) {
      logger.error(`Error processing deal ${deal.id}:`, error);
      
      // Update status to failed
      await supabase
        .from('hubspot_object_status')
        .update({ 
          training_status: 'failed',
          error_message: error.message,
          last_processed: new Date().toISOString()
        })
        .eq('object_id', object_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          deal_id: deal.id
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error) {
    logger.error('Function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});