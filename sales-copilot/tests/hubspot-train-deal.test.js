// Load environment variables first
require('dotenv').config();

// Validate environment variables before creating client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables. Please check your .env file');
}

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

describe('hubspot-train-deal function', () => {
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

    // Check if we have test data in hubspot_object_status
    const { data: statusData, error: statusError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: { type: 'check_hubspot_object_status' }
      }
    });

    if (statusError) throw statusError;
    if (!statusData.count) {
      throw new Error('No test data found in hubspot_object_status. Please run sync first.');
    }

    // Get a deal ID to test with
    testDealId = statusData.data[0].object_id;
  });

  beforeEach(async () => {
    // Clean up Pinecone before each test
    const { error: pineconeError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: { 
          type: 'cleanup_pinecone',
          params: { portal_id: testPortalId }
        }
      }
    });

    if (pineconeError) throw pineconeError;
  });

  test('should process a deal and update Pinecone', async () => {
    // Call hubspot-train-deal function using POST with parameters in URL
    const trainDealUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal?object_id=${testDealId}`;
    const trainResponse = await fetch(trainDealUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(trainResponse.ok).toBe(true);
    const trainData = await trainResponse.json();
    expect(trainData.success).toBe(true);

    // Verify the deal was processed in Supabase
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', testDealId)
      .single();

    expect(dealError).toBeNull();
    expect(deal).toBeTruthy();
    expect(deal.status).toBe('completed');
    expect(deal.processed_at).toBeTruthy();
    expect(deal.data).toBeTruthy();
    expect(deal.data.hubspot_deal).toBeTruthy();
    expect(deal.data.contacts).toBeTruthy();
    expect(deal.data.companies).toBeTruthy();

    // Verify the record was added to Pinecone
    const { data: pineconeData, error: pineconeError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: { 
          type: 'verify_pinecone_record',
          params: { 
            portal_id: testPortalId,
            deal_id: testDealId
          }
        }
      }
    });

    expect(pineconeError).toBeNull();
    expect(pineconeData.success).toBe(true);
    expect(pineconeData.exists).toBe(true);
  });

  afterAll(async () => {
    // Clean up test data
    const { error: cleanupError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: { type: 'cleanup_test_tables' }
      }
    });

    if (cleanupError) throw cleanupError;
  });
}); 