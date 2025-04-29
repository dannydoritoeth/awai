import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Add Deno declaration for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export interface Subscription {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
  plan_tier: 'starter' | 'growth' | 'pro';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  amount: number | null;
  currency: string | null;
  billing_interval: string | null;
  metadata: {
    portal_id: string;
    stripe_price_id?: string;
    stripe_product_id?: string;
    [key: string]: any;
  };
}

export interface SubscriptionStatus {
  isActive: boolean;
  isCanceledButActive: boolean;
  expiresAt: Date;
  isExpiringSoon: boolean;
  tier: Subscription['plan_tier'] | 'free';
  amount: number | null;
  currency: string | null;
  billingInterval: string | null;
}

export class SubscriptionService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get subscription details for a HubSpot portal
   * @param portalId The HubSpot portal ID
   * @returns Subscription details and status
   */
  async getSubscriptionStatus(portalId: string): Promise<SubscriptionStatus | null> {
    try {
      const { data: subscription, error } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('metadata->portal_id', portalId)
        .eq('status', 'active')
        .single();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }

      if (!subscription) {
        return {
          isActive: false,
          isCanceledButActive: false,
          expiresAt: new Date(),
          isExpiringSoon: false,
          tier: 'free',
          amount: null,
          currency: null,
          billingInterval: null
        };
      }

      const now = new Date();
      const expiresAt = new Date(subscription.current_period_end);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      return {
        isActive: subscription.status === 'active' && expiresAt > now,
        isCanceledButActive: subscription.status === 'active' && subscription.cancel_at_period_end === true,
        expiresAt,
        isExpiringSoon: expiresAt <= sevenDaysFromNow && expiresAt > now,
        tier: subscription.plan_tier,
        amount: subscription.amount,
        currency: subscription.currency,
        billingInterval: subscription.billing_interval
      };
    } catch (error) {
      console.error('Error in getSubscriptionStatus:', error);
      return null;
    }
  }

  /**
   * Check if a portal has access to a specific feature based on their subscription tier
   * @param portalId The HubSpot portal ID
   * @param feature The feature to check access for
   * @returns Whether the portal has access to the feature
   */
  async hasFeatureAccess(portalId: string, feature: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(portalId);
    if (!status?.isActive) return false;

    const tierFeatures: Record<Subscription['plan_tier'], string[]> = {
      starter: ['basic_feature', 'another_basic_feature'],
      growth: ['basic_feature', 'another_basic_feature', 'advanced_feature'],
      pro: ['basic_feature', 'another_basic_feature', 'advanced_feature', 'pro_feature']
    };

    return status.tier !== 'free' && tierFeatures[status.tier]?.includes(feature);
  }

  /**
   * Get subscription limits for a portal based on their tier
   * @param portalId The HubSpot portal ID
   * @returns Subscription limits for the portal's tier
   */
  async getSubscriptionLimits(portalId: string): Promise<Record<string, number> | null> {
    const status = await this.getSubscriptionStatus(portalId);
    if (!status?.tier) return this.getFreeSubscriptionLimits();

    const limits: Record<Subscription['plan_tier'], Record<string, number>> = {
      starter: {
        maxScores: 750
      },
      growth: {
        maxScores: 7500
      },
      pro: {
        maxScores: 3000
      }
    };

    return status.tier === 'free' ? this.getFreeSubscriptionLimits() : limits[status.tier];
  }

  private getFreeSubscriptionLimits(): Record<string, number> {
    return {
      maxScores: 50
    };
  }

  /**
   * Get a user-friendly message about the subscription status
   * @param portalId The HubSpot portal ID
   * @returns A message describing the subscription status
   */
  async getSubscriptionMessage(portalId: string): Promise<string> {
    const status = await this.getSubscriptionStatus(portalId);
    if (!status) return 'Unable to determine subscription status.';

    if (!status.isActive) {
      return 'Your subscription has expired. Renew now to continue using our service.';
    }

    if (status.isCanceledButActive) {
      return `Your subscription will end on ${status.expiresAt.toLocaleDateString()}. Renew now to maintain access.`;
    }

    if (status.isExpiringSoon) {
      return 'Your subscription will renew soon. Update your payment method if needed.';
    }

    return `Active ${status.tier} subscription`;
  }

  /**
   * Get the current period's score usage and limits
   */
  async getCurrentPeriodScores(portalId: string): Promise<{
    scoresUsed: number;
    maxScores: number;
    periodStart: Date;
    periodEnd: Date;
  }> {
    try {
      // Get current subscription period
      const { data: subscription, error: subError } = await this.supabase
        .from('subscriptions')
        .select('current_period_start, current_period_end, plan_tier, status')
        .eq('metadata->portal_id', portalId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw subError;
      }

      // Set period and max scores based on subscription
      let periodStart: Date;
      let periodEnd: Date;
      let maxScores: number;

      if (!subscription) {
        // Free tier defaults
        periodStart = new Date();
        periodStart.setHours(0, 0, 0, 0); // Start of today
        periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1); // One month from start
        maxScores = 50; // Free tier limit
      } else {
        periodStart = new Date(subscription.current_period_start);
        periodEnd = new Date(subscription.current_period_end);
        
        // Set max scores based on plan tier
        maxScores = (() => {
          const tier = subscription.plan_tier.toLowerCase();
          switch (tier) {
            case 'pro': return 3000;
            case 'growth': return 7500;
            case 'starter': return 750;
            default: return 50; // Free tier or unknown
          }
        })();
      }

      // Count scores used in current period
      const { count: scoresUsed, error: countError } = await this.supabase
        .from('ai_events')
        .select('*', { count: 'exact', head: true })
        .eq('portal_id', portalId)
        .eq('event_type', 'score')
        .gte('created_at', periodStart.toISOString())
        .lt('created_at', periodEnd.toISOString());

      if (countError) {
        throw countError;
      }
      
      return {
        scoresUsed: Number(scoresUsed || 0),
        maxScores,
        periodStart,
        periodEnd
      };
    } catch (error) {
      console.error('Error getting current period scores:', error);
      // Return default values on error
      const now = new Date();
      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      
      return {
        scoresUsed: 0,
        maxScores: 50, // Default free tier limit
        periodStart: now,
        periodEnd: oneMonthLater
      };
    }
  }

  /**
   * Check if a portal can score more leads
   */
  async canScoreLead(portalId: string): Promise<{
    canScore: boolean;
    remaining: number;
    periodEnd: Date;
  }> {
    try {
      const usage = await this.getCurrentPeriodScores(portalId);
      
      // Calculate remaining scores and ensure it's a valid number
      let remaining = usage.maxScores - usage.scoresUsed;
      if (isNaN(remaining)) {
        console.warn(`Invalid remaining calculation: ${usage.maxScores} - ${usage.scoresUsed} = ${remaining}`);
        remaining = 0; // Default to 0 if we can't calculate properly
      }
      
      return {
        canScore: usage.scoresUsed < usage.maxScores,
        remaining,
        periodEnd: usage.periodEnd
      };
    } catch (error) {
      console.error('Error in canScoreLead:', error);
      
      // Return default fallback values if we encounter an error
      const fallbackDate = new Date();
      fallbackDate.setMonth(fallbackDate.getMonth() + 1);
      
      return {
        canScore: false, // Prevent scoring on error to be safe
        remaining: 0,
        periodEnd: fallbackDate
      };
    }
  }

  /**
   * Record a new score event for a portal
   * @param portalId The HubSpot portal ID
   * @param scoringDetails Optional details about the scoring event for logging
   */
  async recordScore(
    portalId: string, 
    scoringDetails?: {
      recordId?: string;
      recordType?: string;
      inputs?: any;
      outputs?: any;
      aiProvider?: string;
      aiModel?: string;
      duration?: number;
    }
  ): Promise<void> {
    // Check scoring limits
    const { canScore, remaining, periodEnd } = await this.canScoreLead(portalId);
    if (!canScore) {
      throw new Error(`Score limit reached. Next reset at ${periodEnd.toISOString()}`);
    }

    // Check if logging is enabled via environment variable
    const logPortalId = Deno.env.get('LOG_PORTAL_ID_SCORE');
    const shouldLog = logPortalId && (logPortalId === '*' || logPortalId === portalId);
    
    // Create basic event record
    const eventRecord: Record<string, any> = { 
      portal_id: portalId,
      event_type: 'score',
      object_type: scoringDetails?.recordType,
      object_id: scoringDetails?.recordId,
      document_data: scoringDetails?.outputs ? {
        score: scoringDetails.outputs.score,
        summary: scoringDetails.outputs.summary,
        lastScored: scoringDetails.outputs.lastScored,
        // Include the full prompt and input data
        fullPrompt: scoringDetails.outputs.fullPrompt,
        inputs: {
          record: scoringDetails.inputs?.contact || scoringDetails.inputs?.company || scoringDetails.inputs?.deal,
          similarRecords: scoringDetails.inputs?.similarContacts || scoringDetails.inputs?.similarCompanies || scoringDetails.inputs?.similarDeals,
          aiConfig: {
            provider: scoringDetails.aiProvider,
            model: scoringDetails.aiModel,
            ...scoringDetails.inputs?.aiConfig
          }
        }
      } : null
    };
    
    // Add scoring details in the single log_data column if logging is enabled
    if (shouldLog && scoringDetails) {
      // Create a combined log object with all details
      const logData = {
        // Record information
        recordId: scoringDetails.recordId,
        recordType: scoringDetails.recordType,
        
        // AI configuration
        aiProvider: scoringDetails.aiProvider,
        aiModel: scoringDetails.aiModel,
        
        // Performance metrics
        duration: scoringDetails.duration,
        
        // Full context data
        inputs: scoringDetails.inputs,
        outputs: scoringDetails.outputs,
        
        // Add timestamp for when this log was created
        timestamp: new Date().toISOString()
      };
      
      // Store everything in a single JSON column
      eventRecord.log_data = logData;
    }
    
    // Insert the record into the database
    const { error } = await this.supabase
      .from('ai_events')
      .insert(eventRecord);

    if (error) {
      throw new Error(`Failed to record score: ${error.message}`);
    }
  }

  /**
   * Record a new training event for a portal
   * @param portalId The HubSpot portal ID
   * @param objectType The type of object being trained (deal, contact, company)
   * @param objectId The ID of the object being trained
   * @param classification The classification of the object (ideal, less ideal)
   * @param documentData The document data used for training
   */
  async recordTrainingEvent(
    portalId: string,
    objectType: string,
    objectId: string,
    classification: string,
    documentData: any
  ): Promise<void> {
    const eventRecord = {
      portal_id: portalId,
      event_type: 'train',
      object_type: objectType,
      object_id: objectId,
      classification,
      document_data: documentData,
      created_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('ai_events')
      .insert(eventRecord);

    if (error) {
      throw new Error(`Failed to record training event: ${error.message}`);
    }
  }
} 