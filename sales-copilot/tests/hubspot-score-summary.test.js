// Load environment variables first
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

describe.skip('hubspot-score-summary function', () => {
  let testPortalId;
  let testDealId;

  beforeAll(async () => {
    // Get test portal ID
    const { data: portalData, error: portalError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: { type: 'get_test_portal_id' }
      }
    });

    if (portalError) throw portalError;
    testPortalId = portalData.portal_id;

    // Create a test deal in hubspot_object_status
    const testDeal = {
      portal_id: testPortalId,
      object_id: `test-score-deal-${Date.now()}`,
      object_type: 'deal',
      scoring_status: 'completed',
      scoring_date: new Date().toISOString(),
      scoring_error: null,
      classification: 'other',
    };

    const { error: insertError } = await supabase
      .from('hubspot_object_status')
      .insert(testDeal);

    if (insertError) throw insertError;
    testDealId = testDeal.object_id;

    // Set up test subscription data
    const testSubscription = {
      stripe_subscription_id: `test-sub-${Date.now()}`,
      plan_tier: 'PRO',
      status: 'active',
      cancel_at: null,
      canceled_at: null,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        portal_id: testPortalId
      }
    };

    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert(testSubscription, {
        onConflict: 'stripe_subscription_id'
      });

    if (subError) throw subError;
  });

  afterAll(async () => {
    // Clean up test deal
    const { error: deleteError } = await supabase
      .from('hubspot_object_status')
      .delete()
      .eq('object_id', testDealId);

    if (deleteError) throw deleteError;
  });

  test('should return scoring summary without record ID', async () => {
    const summaryUrl = `${supabaseUrl}/functions/v1/hubspot-score-summary?portal_id=${testPortalId}`;
    const response = await fetch(summaryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Verify success and structure
    expect(data.success).toBe(true);
    expect(data.result).toBeDefined();
    
    // Verify plan data
    expect(data.result.plan).toEqual({
      tier: 'PRO',
      isActive: true,
      isCanceledButActive: false,
      expiresAt: null,
      isExpiringSoon: false,
      amount: 0,
      currency: 'USD',
      billingInterval: 'month'
    });

    // Verify scoring data structure
    expect(data.result.scoring).toMatchObject({
      used: expect.any(Number),
      total: expect.any(Number),
      remaining: expect.any(Number),
      periodStart: expect.any(String),
      periodEnd: expect.any(String),
      percentageUsed: expect.any(Number)
    });

    // Verify no current record data
    expect(data.result.currentRecord).toBeUndefined();
  }, 10000);

  test('should return scoring summary with record data', async () => {
    const summaryUrl = `${supabaseUrl}/functions/v1/hubspot-score-summary?portal_id=${testPortalId}&object_type=deal&object_id=${testDealId}`;
    const response = await fetch(summaryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Verify success and structure
    expect(data.success).toBe(true);
    expect(data.result).toBeDefined();
    
    // Verify current record data exists
    expect(data.result.currentRecord).toBeDefined();
    expect(data.result.currentRecord).toMatchObject({
      id: testDealId,
      type: 'deal',
      ideal_client_score: expect.any(String),
      ideal_client_summary: expect.any(String)
    });
  }, 10000);

  test('should return 400 when portal ID is missing', async () => {
    const summaryUrl = `${supabaseUrl}/functions/v1/hubspot-score-summary`;
    const response = await fetch(summaryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing required parameter: portal_id must be provided in URL');
  }, 10000);
}); 