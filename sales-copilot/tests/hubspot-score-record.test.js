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

  const resetScoringStatus = async (portalId, objectId, objectType) => {
    const { error } = await supabase
      .from('hubspot_object_status')
      .upsert({
        portal_id: portalId,
        object_id: objectId,
        object_type: objectType,
        scoring_status: 'queued',
        scoring_error: null,
        scoring_date: null,
        classification: 'other'
      }, {
        onConflict: 'portal_id,object_type,object_id'
      });

    if (error) {
      throw new Error(`Failed to reset scoring status: ${error.message}`);
    }
  };

  const initiateScoring = async (portalId, objectId, objectType) => {
    const scoreUrl = `${supabaseUrl}/functions/v1/hubspot-score-record?portal_id=${portalId}&object_type=${objectType}&object_id=${objectId}`;
    
    const response = await fetch(scoreUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to initiate scoring: ${data.error || 'Unknown error'}`);
    }

    return { status: response.status, data };
  };

  const getScoringStatus = async (portalId, objectId, objectType) => {
    const { data, error } = await supabase
      .from('hubspot_object_status')
      .select('scoring_status, scoring_error, scoring_date')
      .eq('portal_id', portalId)
      .eq('object_type', objectType)
      .eq('object_id', objectId)
      .single();

    if (error) {
      throw new Error(`Failed to get scoring status: ${error.message}`);
    }

    return data;
  };

  const waitForScoring = async (portalId, objectId, objectType, options = {}) => {
    const {
      maxAttempts = 30,
      delayMs = 2000,
      onPolling = () => {}
    } = options;

    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const status = await getScoringStatus(portalId, objectId, objectType);
      
      switch (status.scoring_status) {
        case 'completed':
          return status;
        case 'failed':
          throw new Error(`Scoring failed: ${status.scoring_error}`);
        default:
          onPolling(status, attempts, maxAttempts);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          attempts++;
      }
    }
    
    throw new Error(`Scoring timed out after ${maxAttempts} attempts`);
  };

  test('should score a valid record', async () => {
    const testRecord = {
      portalId: '242593348',
      objectId: '69338423994',
      objectType: 'deal'
    };

    // Reset scoring status
    await resetScoringStatus(testRecord.portalId, testRecord.objectId, testRecord.objectType);
    
    // Allow time for reset to take effect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start scoring
    const { status, data } = await initiateScoring(
      testRecord.portalId,
      testRecord.objectId,
      testRecord.objectType
    );
    
    // Verify initial response
    expect([200, 202]).toContain(status);
    expect(data).toEqual({
      success: true,
      message: 'Scoring process started'
    });

    // Wait for scoring to complete
    const finalStatus = await waitForScoring(
      testRecord.portalId,
      testRecord.objectId,
      testRecord.objectType,
      {
        onPolling: (status, attempt, max) => {
          console.log(`Scoring status: ${status.scoring_status} (attempt ${attempt + 1}/${max})`);
        }
      }
    );

    // Verify final state
    expect(finalStatus.scoring_status).toBe('completed');
    expect(finalStatus.scoring_error).toBeNull();
    expect(finalStatus.scoring_date).not.toBeNull();
  }, 70000); // 70 second timeout

  // test('should handle rescoring gracefully', async () => {
  //   const scoreUrl = `${supabaseUrl}/functions/v1/hubspot-score-record?portal_id=${testPortalId}&object_type=deal&object_id=${testDealId}`;
    
  //   // First scoring
  //   const firstResponse = await fetch(scoreUrl, {
  //     method: 'GET',
  //     headers: {
  //       'Authorization': `Bearer ${supabaseKey}`,
  //       'Content-Type': 'application/json'
  //     }
  //   });

  //   expect(firstResponse.status).toBe(200);
  //   const firstData = await firstResponse.json();
  //   expect(firstData.success).toBe(true);
  //   expect(firstData.score).toBeDefined();

  //   // Second scoring of the same record
  //   const secondResponse = await fetch(scoreUrl, {
  //     method: 'GET',
  //     headers: {
  //       'Authorization': `Bearer ${supabaseKey}`,
  //       'Content-Type': 'application/json'
  //     }
  //   });

  //   expect(secondResponse.status).toBe(200);
  //   const secondData = await secondResponse.json();
  //   expect(secondData.success).toBe(true);
  //   expect(secondData.score).toBeDefined();

  //   // Verify we have two events in ai_events
  //   const { data: events, error: eventsError } = await supabase
  //     .from('ai_events')
  //     .select('*')
  //     .eq('portal_id', testPortalId)
  //     .eq('object_type', 'deal')
  //     .eq('object_id', testDealId)
  //     .eq('event_type', 'score')
  //     .order('created_at', { ascending: false })
  //     .limit(2);

  //   expect(eventsError).toBeNull();
  //   expect(events).toHaveLength(2);
  // }, 60000);

}); 