const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

describe('HubSpot Train Sync Tests', () => {
  let testPortalId;

  beforeAll(async () => {
    // Get the test portal ID
    const { data: portalData, error: portalError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: {
          type: 'get_test_portal_id'
        }
      }
    });

    if (portalError) throw portalError;
    testPortalId = portalData.portal_id;
  });

  test('should trigger hubspot-train-sync and verify hubspot_object_status', async () => {
    // Trigger the hubspot-train-sync function
    const syncUrl = `${supabaseUrl}/functions/v1/hubspot-train-sync?portal_id=${testPortalId}`;
    const syncResponse = await fetch(syncUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(syncResponse.ok).toBe(true);

    // Wait for the sync to complete (you might need to adjust this timeout)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check the hubspot_object_status table
    const { data: statusData, error: statusError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: {
          type: 'check_hubspot_object_status'
        }
      }
    });

    expect(statusError).toBeNull();
    expect(statusData.success).toBe(true);
    expect(statusData.count).toBe(147); // Verify exactly 147 records
    expect(statusData.data[0].portal_id).toBe(testPortalId);
  }, 30000); // 30 second timeout
}); 