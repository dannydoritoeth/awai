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

  test('should return 500 when required parameters are missing', async () => {
    const scoreUrl = `${supabaseUrl}/functions/v1/hubspot-score-record`;
    const response = await fetch(scoreUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing required parameters');
    expect(data.details).toContain('Error: Missing required parameters');
  }, 30000);

  test.only('should create a scoring job for a valid record', async () => {
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

    const scoreUrl = `${supabaseUrl}/functions/v1/hubspot-score-record?portal_id=${testPortalId}&record_type=deal&record_id=${testDealId}`;
    const response = await fetch(scoreUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.status === 400) {
      console.error('Error response:', data);
      throw new Error(`Failed to create scoring job: ${data.error}`);
    }

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobId).toBeTruthy();

    // Verify the job was created in the database
    const { data: jobData, error: jobError } = await supabase
      .from('scoring_jobs')
      .select('*')
      .eq('id', data.jobId)
      .single();

    expect(jobError).toBeNull();
    expect(jobData).toBeTruthy();
    expect(jobData.portal_id).toBe(testPortalId);
    expect(jobData.record_type).toBe('deal');
    expect(jobData.record_id).toBe(testDealId);
    expect(jobData.status).toBe('processing');
    expect(jobData.progress).toBe(0);

    // Clean up the test job
    const { error: deleteError } = await supabase
      .from('scoring_jobs')
      .delete()
      .eq('id', data.jobId);

    expect(deleteError).toBeNull();
  }, 30000);

  test('should handle duplicate job creation gracefully', async () => {
    // First, create a job
    const scoreUrl = `${supabaseUrl}/functions/v1/hubspot-score-record?portal_id=${testPortalId}&record_type=deal&record_id=${testDealId}`;
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
    expect(firstData.jobId).toBeTruthy();

    // Try to create another job for the same record
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
    expect(secondData.jobId).toBeTruthy();

    // Clean up the test jobs
    const { error: deleteError } = await supabase
      .from('scoring_jobs')
      .delete()
      .in('id', [firstData.jobId, secondData.jobId]);

    expect(deleteError).toBeNull();
  }, 30000);
}); 