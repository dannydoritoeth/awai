import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HubspotClient } from "../../../shared/src/services/hubspotClient.ts";
import { ScoringService } from "../../../shared/src/services/scoringService.ts";
import { Logger } from "../../../shared/src/utils/logger.ts";
import { HubSpotWebhookEvent } from "../../../shared/src/types/hubspot.ts";

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

    // Initialize services
    const hubspotClient = new HubspotClient(accessToken);
    const scoringService = new ScoringService(accessToken);

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