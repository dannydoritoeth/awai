// Load environment variables first
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

describe('hubspot-train-summary function', () => {
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
      object_id: `test-summary-deal-${Date.now()}`,
      object_type: 'deal',
      training_status: 'completed',
      training_date: new Date().toISOString(),
      training_error: null,
      classification: 'ideal'
    };

    const { error: insertError } = await supabase
      .from('hubspot_object_status')
      .insert(testDeal);

    if (insertError) throw insertError;
    testDealId = testDeal.object_id;

    // Set up some test metrics in hubspot_accounts
    const metrics = {
      ideal_high: 10000,
      ideal_low: 1000,
      ideal_median: 5000,
      ideal_count: 10,
      nonideal_high: 8000,
      nonideal_low: 500,
      nonideal_median: 4000,
      nonideal_count: 8,
      current_ideal_deals: 5,
      current_less_ideal_deals: 3,
      minimum_ideal_deals: 10,
      minimum_less_ideal_deals: 10,
      current_ideal_companies: 2,
      current_less_ideal_companies: 1,
      minimum_ideal_companies: 5,
      minimum_less_ideal_companies: 5,
      current_ideal_contacts: 3,
      current_less_ideal_contacts: 2,
      minimum_ideal_contacts: 5,
      minimum_less_ideal_contacts: 5
    };

    const { error: updateError } = await supabase
      .from('hubspot_accounts')
      .update(metrics)
      .eq('portal_id', testPortalId);

    if (updateError) throw updateError;
  });

  afterAll(async () => {
    // Clean up test deal
    const { error: deleteError } = await supabase
      .from('hubspot_object_status')
      .delete()
      .eq('object_id', testDealId);

    if (deleteError) throw deleteError;
  });

  test('should return training summary without record ID', async () => {
    const summaryUrl = `${supabaseUrl}/functions/v1/hubspot-train-summary?portal_id=${testPortalId}`;
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
    
    // Verify companies data
    expect(data.result.companies).toEqual({
      current: {
        ideal: 2,
        less_ideal: 1
      },
      required: {
        ideal: 5,
        less_ideal: 5
      }
    });

    // Verify contacts data
    expect(data.result.contacts).toEqual({
      current: {
        ideal: 3,
        less_ideal: 2
      },
      required: {
        ideal: 5,
        less_ideal: 5
      }
    });

    // Verify deals data
    expect(data.result.deals.current).toEqual({
      ideal: 5,
      less_ideal: 3
    });
    expect(data.result.deals.required).toEqual({
      ideal: 10,
      less_ideal: 10
    });

    // Verify deal statistics
    expect(data.result.deals.statistics.ideal).toEqual({
      low: 1000,
      high: 10000,
      median: 5000,
      count: 10,
      last_trained: null,
      to_train: expect.any(Number)
    });
    expect(data.result.deals.statistics.nonideal).toEqual({
      low: 500,
      high: 8000,
      median: 4000,
      count: 8,
      last_trained: null,
      to_train: expect.any(Number)
    });

    // Verify no current record data
    expect(data.result.currentRecord).toBeNull();
  }, 10000);

  test('should return training summary with record data', async () => {
    const summaryUrl = `${supabaseUrl}/functions/v1/hubspot-train-summary?portal_id=${testPortalId}&object_type=deal&object_id=${testDealId}`;
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
    expect(data.result.currentRecord).toHaveProperty('ideal_client_score');
    expect(data.result.currentRecord).toHaveProperty('ideal_client_summary');
  }, 10000);

  test('should return 400 when portal ID is missing', async () => {
    const summaryUrl = `${supabaseUrl}/functions/v1/hubspot-train-summary`;
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
    expect(data.error).toBe('Portal ID is required');
  }, 10000);
}); 