// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="npm:@supabase/supabase-js@2.38.4"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SubscriptionService } from "../_shared/subscriptionService.ts";
import { Logger } from "../_shared/logger.ts";

// Add Deno types
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const logger = new Logger("get-scoring-summary");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse URL parameters
    const url = new URL(req.url);
    const portalId = url.searchParams.get('portalId');

    // Validate required parameters
    if (!portalId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameter: portalId must be provided in URL'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Initialize SubscriptionService
    const subscriptionService = new SubscriptionService(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get subscription status and scoring usage
    const [status, usage] = await Promise.all([
      subscriptionService.getSubscriptionStatus(portalId),
      subscriptionService.getCurrentPeriodScores(portalId)
    ]);

    // Format the response
    const summary = {
      plan: {
        tier: status?.tier || 'FREE',
        isActive: status?.isActive || false,
        isCanceledButActive: status?.isCanceledButActive || false,
        expiresAt: status?.expiresAt || null,
        isExpiringSoon: status?.isExpiringSoon || false,
        amount: status?.amount || 0,
        currency: status?.currency || 'USD',
        billingInterval: status?.billingInterval || null
      },
      scoring: {
        used: usage.scoresUsed,
        total: usage.maxScores,
        remaining: usage.maxScores - usage.scoresUsed,
        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,
        percentageUsed: Math.round((usage.scoresUsed / usage.maxScores) * 100)
      }
    };

    return new Response(
      JSON.stringify({
        success: true,
        summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logger.error('Error getting scoring summary:', {
      error,
      message: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error',
        details: error.stack || 'No stack trace available'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
}); 