import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { HubspotClient } from "../_shared/hubspotClient.ts";
import { ScoringService } from "../_shared/scoringService.ts";
import { Logger } from "../_shared/logger.ts";
import { HubSpotWebhookEvent, AIConfig } from "../_shared/types.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const logger = new Logger("score-record");

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

    // Get the access token from the request headers
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing or invalid authorization header");
    }
    const accessToken = authHeader.substring(7);

    // Get the account configuration from Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: accounts, error } = await supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('portal_id', payload.portalId.toString())
      .eq('status', 'active')
      .single();

    if (error || !accounts) {
      throw new Error(`No active account found for portal ${payload.portalId}`);
    }

    // Create AI configuration from account settings
    const aiConfig: AIConfig = {
      provider: accounts.ai_provider,
      model: accounts.ai_model,
      temperature: accounts.ai_temperature,
      maxTokens: accounts.ai_max_tokens,
      scoringPrompt: accounts.scoring_prompt
    };

    // Initialize services
    const scoringService = new ScoringService(accessToken, aiConfig, logger);

    // Handle different subscription types
    switch (payload.subscriptionType) {
      case "contact.creation":
        await scoringService.scoreContact(payload.objectId.toString());
        break;
      case "company.creation":
        await scoringService.scoreCompany(payload.objectId.toString());
        break;
      case "deal.creation":
        await scoringService.scoreDeal(payload.objectId.toString());
        break;
      default:
        logger.info(`Ignoring unsupported event type: ${payload.subscriptionType}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Error processing webhook", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}); 