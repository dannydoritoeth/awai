// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="npm:@supabase/supabase-js@2.38.4"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
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

    // Create Supabase client directly
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Get current period score count directly using the function from the migration
    const { data: scoreData, error: scoreError } = await supabaseClient
      .rpc('get_current_period_score_count', { portal_id_param: portalId })
      .single();

    if (scoreError) {
      logger.error('Error getting score count:', {
        error: scoreError,
        portalId
      });
    }

    // Get subscription status directly for plan details
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .filter('metadata->>portal_id', 'eq', portalId.toString())
      .eq('status', 'active')
      .single();

    if (subError) {
      logger.error('Error getting subscription:', {
        error: subError,
        portalId
      });
    }

    // Format the response with available data
    const summary = {
      plan: {
        tier: subscription?.plan_tier || 'FREE',
        isActive: !!subscription,
        isCanceledButActive: subscription?.cancel_at_period_end || false,
        expiresAt: subscription?.cancel_at || null,
        isExpiringSoon: false, // Can calculate this if needed
        amount: 0, // Price amount would need to be retrieved from prices table if needed
        currency: 'USD',
        billingInterval: 'month' // Default to monthly
      },
      scoring: {
        used: scoreData?.scores_used || 0,
        total: scoreData?.max_scores || 50, // Default to 50 for free tier
        remaining: (scoreData?.max_scores || 50) - (scoreData?.scores_used || 0),
        periodStart: scoreData?.period_start || new Date().toISOString(),
        periodEnd: scoreData?.period_end || new Date().toISOString(),
        percentageUsed: Math.round(((scoreData?.scores_used || 0) / (scoreData?.max_scores || 50)) * 100)
      }
    };

    return new Response(
      JSON.stringify({
        success: true,
        result: summary
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