import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { HubspotClient } from "../_shared/hubspotClient.ts";
import { ScoringService } from "../_shared/scoringService.ts";
import { Logger } from "../_shared/logger.ts";
import { decrypt, encrypt } from "../_shared/encryption.ts";
import { HubSpotWebhookEvent, AIConfig } from "../_shared/types.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const logger = new Logger("score-record");

async function refreshHubSpotToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: Deno.env.get('HUBSPOT_CLIENT_ID')!,
      client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET')!,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to refresh token:', error);
    throw new Error('Failed to refresh HubSpot token');
  }

  return response.json();
}

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Only handle POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Parse the webhook payload
    const payload: HubSpotWebhookEvent = await req.json();
    logger.info("Received webhook event", payload);

    // Get the account configuration from Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: account, error } = await supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('portal_id', payload.portalId.toString())
      .eq('status', 'active')
      .single();

    if (error || !account) {
      throw new Error(`No active account found for portal ${payload.portalId}`);
    }

    // Decrypt tokens
    let decryptedToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
    const decryptedRefreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);

    if (!decryptedToken || !decryptedRefreshToken) {
      throw new Error('HubSpot tokens are missing or invalid. Please reconnect your HubSpot account.');
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    const expiresAt = new Date(account.expires_at);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
      logger.info('Access token expired or expiring soon, refreshing...');
      const newTokens = await refreshHubSpotToken(decryptedRefreshToken);
      
      // Encrypt new tokens
      const newEncryptedToken = await encrypt(newTokens.access_token, Deno.env.get('ENCRYPTION_KEY')!);
      const newEncryptedRefreshToken = await encrypt(newTokens.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
      
      // Update tokens in database
      const { error: updateError } = await supabase
        .from('hubspot_accounts')
        .update({
          access_token: newEncryptedToken,
          refresh_token: newEncryptedRefreshToken,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('portal_id', payload.portalId.toString());
        
      if (updateError) {
        logger.error('Failed to update tokens:', updateError);
        throw new Error('Failed to update HubSpot tokens');
      }
      
      logger.info('Successfully refreshed and updated tokens');
      decryptedToken = newTokens.access_token;
    }

    // Create AI configuration from account settings
    const aiConfig: AIConfig = {
      provider: account.ai_provider,
      model: account.ai_model,
      temperature: account.ai_temperature,
      maxTokens: account.ai_max_tokens,
      scoringPrompt: account.scoring_prompt
    };

    // Initialize scoring service
    const scoringService = new ScoringService(
      decryptedToken,
      aiConfig,
      payload.portalId.toString(),
      logger
    );

    // Handle different subscription types
    let result;
    switch (payload.subscriptionType) {
      case "contact.creation":
        result = await scoringService.scoreContact(payload.objectId.toString());
        break;
      case "company.creation":
        result = await scoringService.scoreCompany(payload.objectId.toString());
        break;
      case "deal.creation":
        result = await scoringService.scoreDeal(payload.objectId.toString());
        break;
      default:
        logger.info(`Ignoring unsupported event type: ${payload.subscriptionType}`);
        return new Response(JSON.stringify({ 
          error: "Unsupported event type",
          subscriptionType: payload.subscriptionType 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({ 
      success: true,
      result
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Error processing webhook", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}); 