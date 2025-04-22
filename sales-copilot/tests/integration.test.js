// Load environment variables first
require('dotenv').config();

// Validate environment variables before creating client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables. Please check your .env file');
}

const { createClient } = require('@supabase/supabase-js');

// Debug logging
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '***' : 'undefined');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Integration Tests', () => {
  test('should test database connection through edge function', async () => {
    const { data, error } = await supabase.functions.invoke('test-integration', {
      body: {
        action: {
          type: 'test_db_connection'
        }
      }
    });

    expect(error).toBeNull();
    expect(data.success).toBe(true);
  });

  // test('should write and cleanup test data', async () => {
  //   // Write test data
  //   const writeResponse = await supabase.functions.invoke('test-integration', {
  //     body: {
  //       action: {
  //         type: 'test_db_write'
  //       }
  //     }
  //   });

  //   expect(writeResponse.error).toBeNull();
  //   expect(writeResponse.data.success).toBe(true);

  //   // Cleanup test data
  //   const cleanupResponse = await supabase.functions.invoke('test-integration', {
  //     body: {
  //       action: {
  //         type: 'test_db_cleanup'
  //       }
  //     }
  //   });

  //   expect(cleanupResponse.error).toBeNull();
  //   expect(cleanupResponse.data.success).toBe(true);
  // });
});

describe('train-deal function', () => {
  let testPortalId;
  let testDealId;

  beforeAll(async () => {
    // Get test portal ID
    const response = await fetch(`${supabaseUrl}/functions/v1/test-integration`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: { type: 'get_test_portal_id' }
      })
    });

    const data = await response.json();
    testPortalId = data.portal_id;

    // Check if we have test data in hubspot_object_status
    const statusResponse = await fetch(`${supabaseUrl}/functions/v1/test-integration`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: { type: 'check_hubspot_object_status' }
      })
    });

    const statusData = await statusResponse.json();
    if (!statusData.count) {
      throw new Error('No test data found in hubspot_object_status. Please run sync first.');
    }

    // Get a deal ID to test with
    testDealId = statusData.data[0].object_id;
  });

  beforeEach(async () => {
    // Clean up Pinecone before each test
    const pineconeResponse = await fetch(`${supabaseUrl}/functions/v1/test-integration`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: { 
          type: 'cleanup_pinecone',
          params: { portal_id: testPortalId }
        }
      })
    });

    if (!pineconeResponse.ok) {
      throw new Error('Failed to clean up Pinecone');
    }
  });

  test('should process a deal and update Pinecone', async () => {
    // Call train-deal function
    const response = await fetch(`${supabaseUrl}/functions/v1/hubspot-train-deal`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dealId: testDealId
      })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify the deal was processed in Supabase
    const { data: deal, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', testDealId)
      .single();

    expect(error).toBeNull();
    expect(deal).toBeTruthy();
    expect(deal.status).toBe('completed');
    expect(deal.processed_at).toBeTruthy();
    expect(deal.data).toBeTruthy();
    expect(deal.data.hubspot_deal).toBeTruthy();
    expect(deal.data.contacts).toBeTruthy();
    expect(deal.data.companies).toBeTruthy();

    // Verify the record was added to Pinecone
    const pineconeResponse = await fetch(`${supabaseUrl}/functions/v1/test-integration`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: { 
          type: 'verify_pinecone_record',
          params: { 
            portal_id: testPortalId,
            deal_id: testDealId
          }
        }
      })
    });

    expect(pineconeResponse.ok).toBe(true);
    const pineconeData = await pineconeResponse.json();
    expect(pineconeData.success).toBe(true);
    expect(pineconeData.exists).toBe(true);
  });

  afterAll(async () => {
    // Clean up test data
    await fetch(`${supabaseUrl}/functions/v1/test-integration`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: { type: 'cleanup_test_tables' }
      })
    });
  });
}); 