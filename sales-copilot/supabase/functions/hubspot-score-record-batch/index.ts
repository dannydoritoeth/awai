import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { HubspotClient } from "../_shared/hubspotClient.ts";
import { ScoringService } from "../_shared/scoringService.ts";
import { Logger } from "../_shared/logger.ts";
import { AIConfig } from "../_shared/types.ts";
import { decrypt } from "../_shared/encryption.ts";
import { handleApiCall } from "../_shared/apiHandler.ts";

const BATCH_SIZE = 25; // Process 25 records at a time to avoid timeouts
const MAX_PROCESSING_TIME = 25000; // 25 seconds max processing time
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logger = new Logger("score-batch");

interface QueueItemParams {
  portal_id: string;
  object_type: 'contact' | 'company' | 'deal';
  object_id: string;
}

async function queueForScoring(supabase: any, params: QueueItemParams) {
  const { data: existing, error: checkError } = await supabase
    .from('hubspot_object_status')
    .select('*')
    .eq('portal_id', params.portal_id)
    .eq('object_type', params.object_type)
    .eq('object_id', params.object_id)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
    throw checkError;
  }

  if (existing) {
    // Update existing record
    const { error: updateError } = await supabase
      .from('hubspot_object_status')
      .update({
        scoring_status: 'queued',
        scoring_error: null
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;
  } else {
    // Create new record with required classification
    const { error: insertError } = await supabase
      .from('hubspot_object_status')
      .insert({
        portal_id: params.portal_id,
        object_type: params.object_type,
        object_id: params.object_id,
        classification: 'other', // Set default classification
        scoring_status: 'queued',
        training_status: 'pending'
      });

    if (insertError) throw insertError;
  }
}

async function processQueuedItems(
  supabase: any,
  account: any,
  startTime: number,
  specificItem?: QueueItemParams
) {
  // Decrypt tokens
  const decryptedToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
  const decryptedRefreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);

  if (!decryptedToken || !decryptedRefreshToken) {
    throw new Error('HubSpot tokens are missing or invalid');
  }

  // Initialize HubspotClient with decrypted token
  const hubspotClient = new HubspotClient(decryptedToken);

  // Create ScoringService with the client
  const scoringService = new ScoringService(
    hubspotClient,
    {
      provider: account.ai_provider,
      model: account.ai_model,
      temperature: account.ai_temperature,
      maxTokens: account.ai_max_tokens,
      scoringPrompt: account.scoring_prompt
    },
    account.portal_id,
    logger,
    decryptedRefreshToken // Pass refresh token to enable auto-refresh
  );

  // Query for queued items
  let query = supabase
    .from('hubspot_object_status')
    .select('*')
    .eq('portal_id', account.portal_id)
    .eq('scoring_status', 'queued')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  // If processing a specific item, add it to the query
  if (specificItem) {
    query = query
      .eq('object_type', specificItem.object_type)
      .eq('object_id', specificItem.object_id);
  }

  const { data: items, error: queryError } = await query;
  
  if (queryError) throw queryError;
  if (!items?.length) return 0;

  let processedCount = 0;
  for (const item of items) {
    // Check if we're approaching the time limit
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      logger.info('Approaching time limit, stopping batch');
      break;
    }

    try {
      // Update status to in_progress
      await supabase
        .from('hubspot_object_status')
        .update({ scoring_status: 'in_progress' })
        .eq('id', item.id);

      // Score the item based on its type using handleApiCall for automatic token refresh
      switch (item.object_type) {
        case 'contact':
          await handleApiCall(hubspotClient, account.portal_id, decryptedRefreshToken, 
            () => scoringService.scoreContact(item.object_id));
          break;
        case 'company':
          await handleApiCall(hubspotClient, account.portal_id, decryptedRefreshToken,
            () => scoringService.scoreCompany(item.object_id));
          break;
        case 'deal':
          await handleApiCall(hubspotClient, account.portal_id, decryptedRefreshToken,
            () => scoringService.scoreDeal(item.object_id));
          break;
      }

      // Update status to completed
      const now = new Date().toISOString();
      await supabase
        .from('hubspot_object_status')
        .update({
          scoring_status: 'completed',
          scoring_date: now,
          last_processed: now
        })
        .eq('id', item.id);

      processedCount++;
    } catch (error) {
      logger.error(`Error processing ${item.object_type} ${item.object_id}:`, error);
      
      // Update status to failed
      await supabase
        .from('hubspot_object_status')
        .update({
          scoring_status: 'failed',
          scoring_error: error.message,
          last_processed: new Date().toISOString()
        })
        .eq('id', item.id);
    }
  }

  return processedCount;
}

serve(async (req) => {
  try {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    const url = new URL(req.url);
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check for specific item to queue
    const object_type = url.searchParams.get('object_type') as 'contact' | 'company' | 'deal' | null;
    const object_id = url.searchParams.get('object_id');
    const portal_id = url.searchParams.get('portal_id');

    let specificItem: QueueItemParams | undefined;
    if (object_type && object_id && portal_id) {
      specificItem = { portal_id, object_type, object_id };
      await queueForScoring(supabase, specificItem);
    }

    // Get active HubSpot account(s)
    const accountsQuery = supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('status', 'active');

    // If portal_id is specified, only get that account
    if (portal_id) {
      accountsQuery.eq('portal_id', portal_id);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;
    if (accountsError) throw accountsError;
    if (!accounts?.length) {
      return new Response(
        JSON.stringify({ error: 'No active HubSpot accounts found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalProcessed = 0;
    for (const account of accounts) {
      logger.info(`Processing portal ${account.portal_id}`);
      const processed = await processQueuedItems(supabase, account, startTime, specificItem);
      totalProcessed += processed;
    }

    // Check if there are more items to process
    const { count: remainingCount, error: countError } = await supabase
      .from('hubspot_object_status')
      .select('*', { count: 'exact', head: true })
      .eq('scoring_status', 'queued');

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        remaining: remainingCount || 0,
        processing_time: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logger.error('Batch scoring error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}); 