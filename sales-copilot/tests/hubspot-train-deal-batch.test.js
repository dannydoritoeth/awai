// Load environment variables first
require('dotenv').config();

// Validate environment variables before creating client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables. Please check your .env file');
}

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

describe('hubspot-train-deal-batch function', () => {
  let testPortalId;
  let testDealIds = [];

  beforeAll(async () => {
    // Get test portal ID
    const { data: portalData, error: portalError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: { type: 'get_test_portal_id' }
      }
    });

    if (portalError) throw portalError;
    testPortalId = portalData.portal_id;

    // Create test deals that will fail fast (invalid IDs that will cause 400 errors)
    const testDeals = Array.from({ length: 3 }, (_, i) => ({
      portal_id: testPortalId,
      object_id: `invalid-test-deal-${i}`,  // Invalid ID that will fail fast
      object_type: 'deal',
      training_status: 'queued',
      training_date: null,
      training_error: null,
      classification: 'other'
    }));

    const { error: insertError } = await supabase
      .from('hubspot_object_status')
      .insert(testDeals);

    if (insertError) throw insertError;
    testDealIds = testDeals.map(deal => deal.object_id);
  });

  afterAll(async () => {
    // Clean up test data
    const { error: deleteError } = await supabase
      .from('hubspot_object_status')
      .delete()
      .in('object_id', testDealIds);

    if (deleteError) throw deleteError;
  });

  // test('should return 200 when no pending deals found', async () => {
  //   // First, update all test deals to completed status
  //   const { error: updateError } = await supabase
  //     .from('hubspot_object_status')
  //     .update({ 
  //       training_status: 'completed',
  //       training_date: new Date().toISOString()
  //     })
  //     .in('object_id', testDealIds)
  //     .eq('portal_id', testPortalId)
  //     .eq('object_type', 'deal');

  //   if (updateError) throw updateError;

  //   // Verify that no deals are in queued status
  //   const { data: queuedDeals, error: checkError } = await supabase
  //     .from('hubspot_object_status')
  //     .select('*')
  //     .eq('training_status', 'queued')
  //     .eq('portal_id', testPortalId)
  //     .eq('object_type', 'deal');

  //   if (checkError) throw checkError;
  //   expect(queuedDeals.length).toBe(0);

  //   const batchUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal-batch`;
  //   const response = await fetch(batchUrl, {
  //     method: 'GET',
  //     headers: {
  //       'Authorization': `Bearer ${supabaseKey}`,
  //       'Content-Type': 'application/json'
  //     }
  //   });

  //   expect(response.status).toBe(200);
  //   const data = await response.json();
  //   expect(data.message).toBe('No pending deals found');
  // }, 30000);

  test('should process a batch of deals and trigger next batch', async () => {
    const batchUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal-batch`;
    const response = await fetch(batchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    // console.log('Batch response:', data);
    
    // Verify it's a success response and processed all deals
    expect(data.success).toBe(true);
    expect(data.deals).toHaveLength(3);
    expect(data.results).toHaveLength(3);
    
    // Each result should indicate training was initiated
    data.results.forEach(result => {
      expect(result.status).toBe('initiated');
      expect(result.response).toBe('Training initiated');
    });
  }, 10000);

  // test('should handle errors gracefully', async () => {
  //   // First, ensure the test deal doesn't exist
  //   const { error: deleteError } = await supabase
  //     .from('hubspot_object_status')
  //     .delete()
  //     .eq('object_id', 'invalid-deal-id')
  //     .eq('portal_id', testPortalId)
  //     .eq('object_type', 'deal');

  //   if (deleteError) throw deleteError;

  //   // Create a deal with an invalid object_id to force an error
  //   const { error: insertError } = await supabase
  //     .from('hubspot_object_status')
  //     .insert({
  //       portal_id: testPortalId,
  //       object_id: 'invalid-deal-id',
  //       object_type: 'deal',
  //       training_status: 'queued',
  //       training_date: null,
  //       training_error: null,
  //       classification: 'other'
  //     });

  //   if (insertError) throw insertError;

  //   const batchUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal-batch`;
  //   const response = await fetch(batchUrl, {
  //     method: 'GET',
  //     headers: {
  //       'Authorization': `Bearer ${supabaseKey}`,
  //       'Content-Type': 'application/json'
  //     }
  //   });

  //   expect(response.status).toBe(200);
  //   const data = await response.json();
    
  //   // Verify error handling
  //   const errorResult = data.results.find(result => result.dealId === 'invalid-deal-id');
  //   expect(errorResult).toBeTruthy();
  //   expect(errorResult.status).toBe(400);
  //   expect(errorResult.response).toContain('Failed to decode base64');

  //   // Clean up the invalid deal
  //   const { error: cleanupError } = await supabase
  //     .from('hubspot_object_status')
  //     .delete()
  //     .eq('object_id', 'invalid-deal-id')
  //     .eq('portal_id', testPortalId)
  //     .eq('object_type', 'deal');

  //   if (cleanupError) throw cleanupError;
  // }, 30000);
}); 