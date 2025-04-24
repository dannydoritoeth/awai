import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Logger } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { HubspotClient } from '../_shared/hubspotClient.ts';
import { decrypt } from '../_shared/encryption.ts';
import { handleApiCall } from '../_shared/apiHandler.ts';
import { ScoringService } from '../_shared/scoringService.ts';
import { AIConfig } from '../_shared/types.ts';

const logger = new Logger("score-record");

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false
      }
    })

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

    // Get HubSpot account details
    const { data: account, error: accountError } = await supabaseClient
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
    try {
      const accessToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
      const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
      const hubspotClient = new HubspotClient(accessToken);

      // Create AI configuration from account settings
      const aiConfig: AIConfig = {
        provider: account.ai_provider,
        model: account.ai_model,
        temperature: account.ai_temperature,
        maxTokens: account.ai_max_tokens,
        scoringPrompt: account.scoring_prompt
      };

      // Create scoring service
      const scoringService = new ScoringService(
        hubspotClient,
        aiConfig,
        portal_id,
        logger,
        refreshToken
      );

      // Score the record
      logger.info(`Scoring ${object_type} ${object_id}`);
      let result;
      try {
        // Use handleApiCall to automatically handle token expiration
        result = await handleApiCall(
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

        // Update the status in hubspot_object_status and record the event in ai_events
        const { error: updateError } = await supabaseClient
          .from('hubspot_object_status')
          .upsert({
            portal_id,
            object_type,
            object_id,
            training_status: 'completed',
            training_date: new Date().toISOString(),
            training_error: null,
            classification: 'other'
          }, {
            onConflict: 'portal_id,object_type,object_id'
          });

        if (updateError) {
          logger.error('Error updating object status:', updateError);
          throw updateError;
        }

        return new Response(
          JSON.stringify({
            success: true,
            score: result.score,
            summary: result.summary,
            lastScored: result.lastScored
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );

      } catch (scoringError) {
        if (scoringError.message?.includes('Invalid record type')) {
          return new Response(
            JSON.stringify({ success: false, error: scoringError.message }),
            { 
              status: 400, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        }
        
        // Update status with error
        await supabaseClient
          .from('hubspot_object_status')
          .upsert({
            portal_id,
            object_type,
            object_id,
            training_status: 'failed',
            training_date: new Date().toISOString(),
            training_error: scoringError.message,
            classification: 'other'
          }, {
            onConflict: 'portal_id,object_type,object_id'
          });

        logger.error(`Error scoring ${object_type}:`, {
          error: scoringError,
          message: scoringError.message,
          stack: scoringError.stack
        });
        throw scoringError;
      }

    } catch (error) {
      logger.error('Error decrypting tokens:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

  } catch (error) {
    logger.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}) 