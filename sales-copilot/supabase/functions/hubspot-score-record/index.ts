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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          persistSession: false
        }
      }
    );

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

    // Immediately update status to in_progress to prevent duplicate processing
    const { error: updateError } = await supabaseClient
      .from('hubspot_object_status')
      .upsert({
        portal_id,
        object_type,
        object_id,
        scoring_status: 'in_progress',
        scoring_error: null,
        classification: 'other'
      }, {
        onConflict: 'portal_id,object_type,object_id'
      });

    if (updateError) {
      logger.error('Error updating status to in_progress:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update record status' }),
        { status: 500, headers: corsHeaders }
      );
    }

    try {
      // Decrypt tokens
      const accessToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
      const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);

      if (!accessToken || !refreshToken) {
        throw new Error('Failed to decrypt HubSpot tokens');
      }

      // Initialize HubSpot client
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

          // Record scoring event
          const { error: eventError } = await supabaseClient
            .from('ai_events')
            .insert({
              portal_id,
              event_type: 'score',
              object_type,
              object_id,
              classification: 'other',
              document_data: {
                score: result.score,
                summary: result.summary
              },
              created_at: new Date().toISOString()
            });

          if (eventError) {
            throw new Error(`Failed to record scoring event: ${eventError.message}`);
          }

          // Update status to completed
          const now = new Date().toISOString();
          await supabaseClient
            .from('hubspot_object_status')
            .update({
              scoring_status: 'completed',
              scoring_date: now,
              scoring_error: null,
              last_processed: now
            })
            .eq('portal_id', portal_id)
            .eq('object_type', object_type)
            .eq('object_id', object_id);

        } catch (scoringError) {
          // Update status with error
          await supabaseClient
            .from('hubspot_object_status')
            .update({
              scoring_status: 'failed',
              scoring_error: scoringError.message,
              last_processed: new Date().toISOString()
            })
            .eq('portal_id', portal_id)
            .eq('object_type', object_type)
            .eq('object_id', object_id);

          logger.error(`Error scoring ${object_type}:`, {
            error: scoringError,
            message: scoringError.message,
            stack: scoringError.stack
          });
        }
      })();

      // Return immediately with success
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Scoring process started'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (error) {
      // Update status to failed
      await supabaseClient
        .from('hubspot_object_status')
        .update({
          scoring_status: 'failed',
          scoring_error: error.message,
          last_processed: new Date().toISOString()
        })
        .eq('portal_id', portal_id)
        .eq('object_type', object_type)
        .eq('object_id', object_id);

      logger.error('Error processing record:', error);
      throw error;
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