import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get active subscription by portal ID
   */
  async getActiveSubscription(portalId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('metadata->>portal_id', portalId)
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }

    return data;
  }

  /**
   * Get score count for a portal in a given period
   */
  async getScoreCount(
    portalId: string, 
    periodStart: Date, 
    periodEnd: Date
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('ai_events')
      .select('*', { count: 'exact', head: true })
      .eq('portal_id', portalId)
      .eq('event_type', 'score')
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString());

    if (error) {
      console.error('Error counting scores:', error);
      return 0;
    }

    return Number(count || 0);
  }

  /**
   * Record a score event
   */
  async recordScoreEvent(eventRecord: Record<string, any>): Promise<void> {
    const { error } = await this.supabase
      .from('ai_events')
      .insert(eventRecord);

    if (error) {
      throw new Error(`Failed to record score: ${error.message}`);
    }
  }

  /**
   * Record a training event
   */
  async recordTrainingEvent(eventRecord: Record<string, any>): Promise<void> {
    const { error } = await this.supabase
      .from('ai_events')
      .insert(eventRecord);

    if (error) {
      throw new Error(`Failed to record training event: ${error.message}`);
    }
  }

  /**
   * Get active HubSpot account by portal ID
   */
  async getHubspotAccount(portalId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('portal_id', portalId)
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('Error fetching HubSpot account:', error);
      return null;
    }

    return data;
  }

  /**
   * Update HubSpot object status
   */
  async updateObjectStatus(
    portalId: string,
    objectType: string,
    objectId: string,
    updates: {
      scoring_status?: string;
      scoring_date?: string;
      scoring_error?: string | null;
      last_processed?: string;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('hubspot_object_status')
      .update(updates)
      .eq('portal_id', portalId)
      .eq('object_type', objectType)
      .eq('object_id', objectId);

    if (error) {
      console.error('Error updating object status:', error);
      throw new Error(`Failed to update object status: ${error.message}`);
    }
  }
} 