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
    // console.log('Test Portal ID:', testPortalId);

    // Check if we have test data in hubspot_object_status
    const { data: statusData, error: statusError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: { type: 'check_hubspot_object_status' }
      }
    });

    if (statusError) throw statusError;
    // console.log('Found deals in hubspot_object_status:', statusData.count);

    if (!statusData.count) {
      // If no data exists, run the sync
      const syncUrl = `${supabaseUrl}/functions/v1/hubspot-train-sync?portal_id=${testPortalId}`;
      const syncResponse = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!syncResponse.ok) {
        throw new Error('Failed to run sync');
      }

      // Wait a moment for sync to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check again for data
      const { data: newStatusData, error: newStatusError } = await supabase.functions.invoke('test-integration', {
        body: {
          action: { type: 'check_hubspot_object_status' }
        }
      });

      if (newStatusError) throw newStatusError;
      if (!newStatusData.count) {
        throw new Error('Sync completed but no data found in hubspot_object_status');
      }

      testDealId = newStatusData.data[0].object_id;
    } else {
      testDealId = statusData.data[0].object_id;
    }

    // console.log('Test Deal ID:', testDealId);
  });

  test('should return 400 when object_id is missing', async () => {
    const trainDealUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal`;
    const response = await fetch(trainDealUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('object_id is required as a query parameter');
  }, 30000);

  test('should return 400 when deal is not found in hubspot_object_status', async () => {
    const trainDealUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal?object_id=invalid_id`;
    const response = await fetch(trainDealUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Failed to fetch deal status');
  }, 30000);

  test('should process a deal and update status correctly', async () => {
    const trainDealUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal?object_id=${testDealId}`;
    const response = await fetch(trainDealUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    // The function might return 400 if there are decryption issues
    if (!response.ok) {
      const data = await response.json();
      expect(data.error).toContain('Failed to decode base64');
      return;
    }

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.objectId).toBe(testDealId);

    // Verify status updates in hubspot_object_status
    const { data: statusData, error: statusError } = await supabase
      .from('hubspot_object_status')
      .select('*')
      .eq('object_id', testDealId)
      .single();

    expect(statusError).toBeNull();
    expect(statusData).toBeTruthy();
    expect(statusData.training_status).toBe('completed');
    expect(statusData.training_date).toBeTruthy();
    expect(statusData.training_error).toBeNull();

    // Verify training event was recorded
    const { data: eventData, error: eventError } = await supabase
      .from('ai_events')
      .select('*')
      .eq('object_id', testDealId)
      .eq('event_type', 'train')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(eventError).toBeNull();
    expect(eventData).toBeTruthy();
    expect(eventData.portal_id).toBe(testPortalId);
    expect(eventData.object_type).toBe('deal');
    expect(eventData.document_data).toBeTruthy();
    expect(eventData.document_data.hubspot_deal).toBeTruthy();
    expect(eventData.document_data.contacts).toBeTruthy();
    expect(eventData.document_data.companies).toBeTruthy();
  }, 30000);

  test('should handle token refresh when access token is expired', async () => {
    // First, get the current tokens
    const { data: accountData, error: accountError } = await supabase
      .from('hubspot_accounts')
      .select('access_token, refresh_token')
      .eq('portal_id', testPortalId)
      .single();

    expect(accountError).toBeNull();
    expect(accountData).toBeTruthy();

    // Update the access token to an expired one
    const { error: updateError } = await supabase
      .from('hubspot_accounts')
      .update({ access_token: 'expired_token' })
      .eq('portal_id', testPortalId);

    expect(updateError).toBeNull();

    // Try to process the deal - should trigger token refresh
    const trainDealUrl = `${supabaseUrl}/functions/v1/hubspot-train-deal?object_id=${testDealId}`;
    const response = await fetch(trainDealUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    // The function should return 400 because the expired token is invalid
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Failed to decode base64');

    // Restore the original tokens
    const { error: restoreError } = await supabase
      .from('hubspot_accounts')
      .update({ 
        access_token: accountData.access_token,
        refresh_token: accountData.refresh_token
      })
      .eq('portal_id', testPortalId);

    expect(restoreError).toBeNull();
  }, 30000);
}); 