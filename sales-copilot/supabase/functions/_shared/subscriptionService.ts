import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Subscription {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
  plan_tier: 'STARTER' | 'GROWTH' | 'PRO';
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
  tier: Subscription['plan_tier'] | 'FREE';
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
          tier: 'FREE',
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
      STARTER: ['basic_feature', 'another_basic_feature'],
      GROWTH: ['basic_feature', 'another_basic_feature', 'advanced_feature'],
      PRO: ['basic_feature', 'another_basic_feature', 'advanced_feature', 'pro_feature']
    };

    return status.tier !== 'FREE' && tierFeatures[status.tier]?.includes(feature);
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
      STARTER: {
        maxScores: 750
      },
      GROWTH: {
        maxScores: 7500
      },
      PRO: {
        maxScores: 3000
      }
    };

    return status.tier === 'FREE' ? this.getFreeSubscriptionLimits() : limits[status.tier];
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
} 