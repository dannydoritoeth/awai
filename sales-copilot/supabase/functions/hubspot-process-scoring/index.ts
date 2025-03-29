import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HubspotClient } from '../_shared/hubspotClient.ts'
import { decryptData } from '../_shared/encryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HubspotAccount {
  portal_id: string
  access_token: string
  refresh_token: string
  expires_at: number
  created_at: string
  updated_at: string
}

interface ScoringStats {
  highScoreCount: number
  lowScoreCount: number
  unscoredCount: number
}

async function getScoringStats(
  hubspotClient: HubspotClient,
  objectType: 'contact' | 'company' | 'deal'
): Promise<ScoringStats> {
  // Query for high scores (>= 80)
  const highScoreResponse = await hubspotClient.searchRecords(objectType, {
    filterGroups: [{
      filters: [{
        propertyName: 'training_score',
        operator: 'GTE',
        value: '80'
      }]
    }],
    properties: ['training_score'],
    limit: 10
  });

  // Query for low scores (<= 50)
  const lowScoreResponse = await hubspotClient.searchRecords(objectType, {
    filterGroups: [{
      filters: [{
        propertyName: 'training_score',
        operator: 'LTE',
        value: '50'
      }]
    }],
    properties: ['training_score'],
    limit: 10
  });

  // Query for unscored records
  const unscoredResponse = await hubspotClient.searchRecords(objectType, {
    filterGroups: [{
      filters: [{
        propertyName: 'ai_score',
        operator: 'HAS_NO_VALUE'
      }]
    }],
    properties: ['ai_score'],
    limit: 1
  });

  return {
    highScoreCount: highScoreResponse.total,
    lowScoreCount: lowScoreResponse.total,
    unscoredCount: unscoredResponse.total
  };
}

async function processAccount(
  supabase: any,
  account: HubspotAccount,
  encryptionKey: string,
  isManualTrigger: boolean = false
): Promise<void> {
  try {
    // Decrypt access token
    const accessToken = decryptData(account.access_token, encryptionKey);
    const hubspotClient = new HubspotClient(account.portal_id, accessToken);

    // Check each object type
    const objectTypes = ['contact', 'company', 'deal'] as const;
    
    for (const objectType of objectTypes) {
      console.log(`Processing ${objectType}s for account ${account.portal_id}`);
      
      // Get scoring stats
      const stats = await getScoringStats(hubspotClient, objectType);
      
      // Check if we can do scoring
      const canDoScoring = stats.highScoreCount >= 10 && stats.lowScoreCount >= 10;
      
      if (!canDoScoring) {
        console.log(`Cannot do scoring for ${objectType}s: high=${stats.highScoreCount}, low=${stats.lowScoreCount}`);
        continue;
      }

      // If we have unscored records, process them in batches
      if (stats.unscoredCount > 0) {
        console.log(`Found ${stats.unscoredCount} unscored ${objectType}s`);
        
        // Get unscored records in batches of 100
        const batchSize = 100;
        let processedCount = 0;
        
        while (processedCount < stats.unscoredCount) {
          const unscoredRecords = await hubspotClient.searchRecords(objectType, {
            filterGroups: [{
              filters: [{
                propertyName: 'ai_score',
                operator: 'HAS_NO_VALUE'
              }]
            }],
            properties: ['id', 'ai_score', 'createdate'],
            sorts: [{
              propertyName: 'createdate',
              direction: 'DESCENDING'
            }],
            limit: batchSize
          });

          if (unscoredRecords.results.length === 0) break;

          // Call batch scoring function
          const response = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/hubspot-batch-score`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                portal_id: account.portal_id,
                object_type: objectType,
                record_ids: unscoredRecords.results.map(r => r.id)
              })
            }
          );

          if (!response.ok) {
            throw new Error(`Batch scoring failed: ${await response.text()}`);
          }

          processedCount += unscoredRecords.results.length;
          console.log(`Processed ${processedCount}/${stats.unscoredCount} ${objectType}s`);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing account ${account.portal_id}:`, error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !encryptionKey) {
      throw new Error('Missing required environment variables')
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if this is a manual trigger
    const url = new URL(req.url)
    const isManualTrigger = url.searchParams.get('manual') === 'true'
    const portalId = url.searchParams.get('portal_id')

    // For manual triggers, require authentication
    if (isManualTrigger) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('Authorization header required for manual triggers')
      }

      // Verify the request is from an authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )

      if (authError || !user) {
        throw new Error('Invalid authentication')
      }
    }

    // Get HubSpot accounts
    let query = supabase.from('hubspot_accounts').select('*')
    
    // If portal_id is specified, only process that account
    if (portalId) {
      query = query.eq('portal_id', portalId)
    }

    const { data: accounts, error: accountsError } = await query

    if (accountsError) {
      throw accountsError
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No accounts found to process',
          manual: isManualTrigger,
          portal_id: portalId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process each account
    for (const account of accounts) {
      await processAccount(supabase, account, encryptionKey, isManualTrigger)
    }

    return new Response(
      JSON.stringify({ 
        message: 'Scoring process completed successfully',
        manual: isManualTrigger,
        portal_id: portalId,
        accounts_processed: accounts.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Scoring process error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        manual: isManualTrigger,
        portal_id: portalId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 