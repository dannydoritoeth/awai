// Load environment variables first
require('dotenv').config();

// Validate environment variables before creating client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables. Please check your .env file');
}

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

describe('hubspot-score-record function', () => {
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

    // Get a test deal ID from hubspot_object_status
    const { data: statusData, error: statusError } = await supabase
      .from('hubspot_object_status')
      .select('object_id')
      .eq('portal_id', testPortalId)
      .eq('object_type', 'deal')
      .limit(1);

    if (statusError) throw statusError;

    if (!statusData || statusData.length === 0) {
      // If no deals exist, create a test deal
      const { data: newDeal, error: insertError } = await supabase
        .from('hubspot_object_status')
        .insert({
          portal_id: testPortalId,
          object_id: 'test-deal-1',
          object_type: 'deal',
          training_status: 'completed',
          training_date: new Date().toISOString(),
          training_error: null,
          classification: 'other'
        })
        .select('object_id')
        .single();

      if (insertError) throw insertError;
      testDealId = newDeal.object_id;
    } else {
      testDealId = statusData[0].object_id;
    }
  });

  afterAll(async () => {
    // Clean up test data if we created it
    if (testDealId === 'test-deal-1') {
      const { error: deleteError } = await supabase
        .from('hubspot_object_status')
        .delete()
        .eq('object_id', testDealId);

      if (deleteError) throw deleteError;
    }
  });

  test('should return 400 when required parameters are missing', async () => {
    const scoreUrl = `${supabaseUrl}/functions/v1/hubspot-score-record`;
    const response = await fetch(scoreUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing required parameters: portal_id, object_type, and object_id are required');
  }, 30000);

  test('should score a valid record', async () => {
    // First ensure we have a valid deal in the database
    const { data: existingDeal, error: dealError } = await supabase
      .from('hubspot_object_status')
      .select('*')
      .eq('object_id', testDealId)
      .single();

    if (dealError || !existingDeal) {
      // Create a test deal if it doesn't exist
      const { data: newDeal, error: insertError } = await supabase
        .from('hubspot_object_status')
        .insert({
          portal_id: testPortalId,
          object_id: testDealId,
          object_type: 'deal',
          training_status: 'completed',
          training_date: new Date().toISOString(),
          training_error: null,
          classification: 'other'
        })
        .select()
        .single();

      if (insertError) throw insertError;
    }

    const scoreUrl = `${supabaseUrl}/functions/v1/hubspot-score-record?portal_id=${testPortalId}&object_type=deal&object_id=${testDealId}`;
    const response = await fetch(scoreUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.status === 400) {
      throw new Error(`Failed to score record: ${data.error}`);
    }

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.score).toBeDefined();
    expect(data.summary).toBeDefined();
    expect(data.lastScored).toBeDefined();

    // Verify the status was updated in hubspot_object_status
    const { data: statusData, error: statusError } = await supabase
      .from('hubspot_object_status')
      .select('*')
      .eq('portal_id', testPortalId)
      .eq('object_type', 'deal')
      .eq('object_id', testDealId)
      .single();

    expect(statusError).toBeNull();
    expect(statusData).toBeTruthy();
    expect(statusData.training_status).toBe('completed');
    expect(statusData.training_error).toBeNull();

    // Add a small delay to allow for event creation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the event was recorded in ai_events
    const { data: eventData, error: eventError } = await supabase
      .from('ai_events')
      .select('*')
      .eq('portal_id', testPortalId)
      .eq('object_type', 'deal')
      .eq('object_id', testDealId)
      .eq('event_type', 'score')
      .order('created_at', { ascending: false })
      .limit(1);

    expect(eventError).toBeNull();
    expect(eventData).toBeTruthy();
    expect(eventData.length).toBe(1);
    expect(eventData[0].document_data.score).toBe(data.score);
    expect(eventData[0].document_data.summary).toBe(data.summary);
  }, 30000);

  test('should handle rescoring gracefully', async () => {
    const scoreUrl = `${supabaseUrl}/functions/v1/hubspot-score-record?portal_id=${testPortalId}&object_type=deal&object_id=${testDealId}`;
    
    // First scoring
    const firstResponse = await fetch(scoreUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(firstResponse.status).toBe(200);
    const firstData = await firstResponse.json();
    expect(firstData.success).toBe(true);
    expect(firstData.score).toBeDefined();

    // Second scoring of the same record
    const secondResponse = await fetch(scoreUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(secondResponse.status).toBe(200);
    const secondData = await secondResponse.json();
    expect(secondData.success).toBe(true);
    expect(secondData.score).toBeDefined();

    // Verify we have two events in ai_events
    const { data: events, error: eventsError } = await supabase
      .from('ai_events')
      .select('*')
      .eq('portal_id', testPortalId)
      .eq('object_type', 'deal')
      .eq('object_id', testDealId)
      .eq('event_type', 'score')
      .order('created_at', { ascending: false })
      .limit(2);

    expect(eventsError).toBeNull();
    expect(events).toHaveLength(2);
  }, 60000);

  test('should handle token refresh gracefully', async () => {
    // First, get the current tokens
    const { data: accountData, error: accountError } = await supabase
      .from('hubspot_accounts')
      .select('access_token, refresh_token, expires_at')
      .eq('portal_id', testPortalId)
      .single();

    expect(accountError).toBeNull();
    expect(accountData).toBeTruthy();

    const originalExpiresAt = new Date(accountData.expires_at).getTime();

    // Update the expiration time to force a refresh
    const { error: updateError } = await supabase
      .from('hubspot_accounts')
      .update({ 
        expires_at: new Date(Date.now() - 3600000).toISOString() // Set to 1 hour ago
      })
      .eq('portal_id', testPortalId);

    expect(updateError).toBeNull();

    // Try to score the record - should trigger token refresh
    const scoreUrl = `${supabaseUrl}/functions/v1/hubspot-score-record?portal_id=${testPortalId}&object_type=deal&object_id=${testDealId}`;
    const response = await fetch(scoreUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    // The function should handle the expired token and refresh it
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.score).toBeDefined();

    // Add a small delay to ensure token refresh has completed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the token was refreshed by checking the expiration time was updated
    const { data: refreshedAccount, error: refreshError } = await supabase
      .from('hubspot_accounts')
      .select('expires_at')
      .eq('portal_id', testPortalId)
      .single();

    expect(refreshError).toBeNull();
    const refreshedTime = new Date(refreshedAccount.expires_at).getTime();
    // Simply verify that the expiration time changed
    expect(refreshedTime).toBeGreaterThan(originalExpiresAt);
  }, 60000);
}); 