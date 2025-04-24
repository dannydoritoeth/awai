import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Logger } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts';

const BATCH_SIZE = 25; // Process 25 records at a time to avoid timeouts
const MAX_PROCESSING_TIME = 25000; // 25 seconds max processing time

const logger = new Logger("score-batch");

async function processQueuedItems(
  supabase: any,
  account: any,
  startTime: number,
  specificItem?: { portal_id: string; object_type: string; object_id: string }
) {
  // Query for items that need scoring
  let query = supabase
    .from('hubspot_object_status')
    .select('*')
    .eq('portal_id', account.portal_id)
    .eq('scoring_status', 'pending')
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
      // Call the score-record function for this item
      const scoreUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/hubspot-score-record`;
      const response = await fetch(`${scoreUrl}?portal_id=${item.portal_id}&object_type=${item.object_type}&object_id=${item.object_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to score record: ${error.error || 'Unknown error'}`);
      }

      processedCount++;
    } catch (error) {
      logger.error(`Error calling score-record for ${item.object_type} ${item.object_id}:`, error);
      // Don't update status here - the score-record function handles that
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

    // Check for specific item to process
    const object_type = url.searchParams.get('object_type') as 'contact' | 'company' | 'deal' | null;
    const object_id = url.searchParams.get('object_id');
    const portal_id = url.searchParams.get('portal_id');

    let specificItem: { portal_id: string; object_type: string; object_id: string } | undefined;
    if (object_type && object_id && portal_id) {
      specificItem = { portal_id, object_type, object_id };
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
      .eq('scoring_status', 'pending');

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