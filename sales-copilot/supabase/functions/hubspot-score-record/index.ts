// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Logger } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { HubspotClient } from '../_shared/hubspotClient.ts';
import { decrypt } from '../_shared/encryption.ts';
import { handleApiCall } from '../_shared/apiHandler.ts';
import { ScoringService } from '../_shared/scoringService.ts';
import { AIConfig } from '../_shared/types.ts';
import { SubscriptionService } from '../_shared/subscriptionService.ts';
import { DatabaseService } from '../_shared/databaseService.ts';

const logger = new Logger("score-record");

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize services
    const dbService = new DatabaseService(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const subscriptionService = new SubscriptionService(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the portal ID, record type, and record ID from the query parameters
    const url = new URL(req.url)
    const portal_id = url.searchParams.get('portal_id')
    const object_type = url.searchParams.get('object_type')
    const object_id = url.searchParams.get('object_id')

    if (!portal_id || !object_type || !object_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: portal_id, object_type, and object_id are required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if portal can score more leads
    const { canScore, remaining, periodEnd } = await subscriptionService.canScoreLead(portal_id);
    
    if (!canScore) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Scoring limit reached. You have ${remaining} scores remaining. Next reset at ${periodEnd.toISOString()}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get HubSpot account details
    const account = await dbService.getHubspotAccount(portal_id);

    if (!account) {
      return new Response(
        JSON.stringify({ success: false, error: 'HubSpot account not found' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Decrypt tokens
    const accessToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);

    // Initialize services
    const hubspotClient = new HubspotClient(accessToken);

    // Create AI configuration from account settings
    const aiConfig: AIConfig = {
      provider: account.ai_provider || 'openai',
      model: account.ai_model || 'gpt-4-turbo-preview',
      temperature: account.ai_temperature || 0.7,
      maxTokens: account.ai_max_tokens || 2000,
      scoringPrompt: account.scoring_prompt
    };

    const scoringService = new ScoringService(
      hubspotClient,
      aiConfig,
      portal_id,
      logger,
      refreshToken
    );

    // Return success response immediately
    const response = new Response(
      JSON.stringify({
        success: true,
        message: 'Scoring process started'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

    // Start the scoring process asynchronously
    (async () => {
      try {
        // Score the record
        logger.info(`Scoring ${object_type} ${object_id}`);
        const result = await handleApiCall(
          hubspotClient,
          portal_id,
          refreshToken,
          async () => {
            switch (object_type) {
              case 'contact':
                return await scoringService.scoreContact(object_id);
              case 'company':
                return await scoringService.scoreCompany(object_id);
              case 'deal':
                return await scoringService.scoreDeal(object_id);
              default:
                throw new Error('Invalid record type. Must be contact, company, or deal');
            }
          }
        );

        logger.info(`Successfully scored ${object_type} ${object_id}:`, {
          score: result.score,
          lastScored: result.lastScored
        });

        // Record the scoring event
        await subscriptionService.recordScore(portal_id, {
          recordId: object_id,
          recordType: object_type,
          outputs: result
        });

        // Update status to completed
        await dbService.updateObjectStatus(portal_id, object_type, object_id, {
          scoring_status: 'completed',
          scoring_date: new Date().toISOString(),
          scoring_error: null,
          last_processed: new Date().toISOString()
        });

      } catch (error) {
        logger.error(`Error scoring ${object_type} ${object_id}:`, error);

        // Update status to failed
        await dbService.updateObjectStatus(portal_id, object_type, object_id, {
          scoring_status: 'failed',
          scoring_error: error.message,
          last_processed: new Date().toISOString()
        });
      }
    })();

    return response;

  } catch (error) {
    logger.error('Error in score-record function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}); 