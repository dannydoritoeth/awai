import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ScoringService } from "../_shared/scoringService.ts";
import { Logger } from "../_shared/logger.ts";
import { AIConfig } from "../_shared/types.ts";
import { decrypt } from "../_shared/encryption.ts";
import { HubspotClient } from "../_shared/hubspotClient.ts";

const logger = new Logger("score-record");

serve(async (req) => {
  try {
    const { recordId, recordType, portalId } = await req.json();

    if (!recordId || !recordType || !portalId) {
      return new Response(
        JSON.stringify({ error: 'recordId, recordType, and portalId are required' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get HubSpot account from Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: account, error } = await supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('portal_id', portalId)
      .eq('status', 'active')
      .single();

    if (error || !account) {
      logger.error('Account fetch error:', error);
      return new Response(
        JSON.stringify({ error: 'HubSpot account not found or inactive' }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Decrypt tokens
    let decryptedToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
    const decryptedRefreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);

    if (!decryptedToken || !decryptedRefreshToken) {
      throw new Error('HubSpot tokens are missing or invalid');
    }

    // Initialize HubSpot client with current token
    const hubspotClient = new HubspotClient(decryptedToken);

    // Create AI configuration from account settings
    const aiConfig: AIConfig = {
      provider: account.ai_provider,
      model: account.ai_model,
      temperature: account.ai_temperature,
      maxTokens: account.ai_max_tokens,
      scoringPrompt: account.scoring_prompt
    };

    // Create scoring service with the HubSpot client
    const scoringService = new ScoringService(
      hubspotClient, // Pass the client instead of just the token
      aiConfig,
      portalId,
      logger
    );

    // Score the record
    logger.info(`Scoring ${recordType} ${recordId}`);
    let result;
    try {
      switch (recordType) {
        case 'contact':
          result = await scoringService.scoreContact(recordId);
          break;
        case 'company':
          result = await scoringService.scoreCompany(recordId);
          break;
        case 'deal':
          result = await scoringService.scoreDeal(recordId);
          break;
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid record type. Must be contact, company, or deal' }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
      }
    } catch (scoringError) {
      logger.error(`Error scoring ${recordType}:`, {
        error: scoringError,
        message: scoringError.message,
        stack: scoringError.stack
      });
      throw scoringError;
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    logger.error('Scoring error:', {
      error,
      message: error.message,
      stack: error.stack
    });
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}); 