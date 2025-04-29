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

  describe('scoring quota tests', () => {
    test('free plan: can score up to but not beyond limit', async () => {
      const testRecord = {
        portalId: '242593348',
        objectId: '69338423994',
        objectType: 'deal'
      };
      const FREE_TIER_LIMIT = 50;

      // First clean up any existing events for this portal
      const { error: deleteError } = await supabase
        .from('ai_events')
        .delete()
        .eq('portal_id', testRecord.portalId)
        .eq('event_type', 'score');

      if (deleteError) {
        throw new Error(`Failed to clean up existing events: ${deleteError.message}`);
      }

      // Verify cleanup was successful
      const { count: initialCount, error: initialCountError } = await supabase
        .from('ai_events')
        .select('*', { count: 'exact', head: true })
        .eq('portal_id', testRecord.portalId)
        .eq('event_type', 'score');

      if (initialCountError) {
        throw new Error(`Failed to verify cleanup: ${initialCountError.message}`);
      }

      expect(initialCount).toBe(0);
      console.log('Initial cleanup successful, verified 0 events exist');

      // Create events up to one less than the limit
      const events = Array.from({ length: FREE_TIER_LIMIT - 1 }, (_, i) => ({
        portal_id: testRecord.portalId,
        event_type: 'score',
        object_type: testRecord.objectType,
        object_id: `test-object-${i}`,
        document_data: {
          status: 'completed',
          score: 0.8,
          summary: 'Test summary'
        },
        created_at: new Date(Date.now() - (FREE_TIER_LIMIT - i) * 60000).toISOString() // Spread over last hour
      }));

      const { error: insertError } = await supabase
        .from('ai_events')
        .insert(events);

      if (insertError) {
        throw new Error(`Failed to insert test events: ${insertError.message}`);
      }

      // Verify we have exactly FREE_TIER_LIMIT - 1 events
      const { count: eventCount, error: countError } = await supabase
        .from('ai_events')
        .select('*', { count: 'exact', head: true })
        .eq('portal_id', testRecord.portalId)
        .eq('event_type', 'score');

      if (countError) {
        throw new Error(`Failed to count events: ${countError.message}`);
      }

      expect(eventCount).toBe(FREE_TIER_LIMIT - 1);
      console.log(`Successfully created ${eventCount} events (one less than limit)`);

      // Reset scoring status
      await resetScoringStatus(testRecord.portalId, testRecord.objectId, testRecord.objectType);
      
      // First attempt - should succeed because we're one under the limit
      console.log('\nAttempting first score (should succeed)...');
      try {
        // Get current subscription details for debugging
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('metadata->portal_id', testRecord.portalId)
          .eq('status', 'active')
          .single();
        
        console.log('Active subscription:', subscription || 'None (free tier)');

        // Get current period scores for debugging
        const { data: scores, error: scoresError } = await supabase
          .from('ai_events')
          .select('created_at')
          .eq('portal_id', testRecord.portalId)
          .eq('event_type', 'score')
          .order('created_at', { ascending: false });

        console.log('Current scores:', {
          total: scores?.length || 0,
          oldest: scores?.[scores.length - 1]?.created_at,
          newest: scores?.[0]?.created_at
        });

        const firstAttempt = await initiateScoring(
          testRecord.portalId,
          testRecord.objectId,
          testRecord.objectType
        );

        console.log('First attempt response:', {
          status: firstAttempt.status,
          data: firstAttempt.data
        });

        expect(firstAttempt.status).toBe(200);
        expect(firstAttempt.data).toMatchObject({
          success: true,
          message: 'Scoring process started'
        });

        // Wait for first scoring to complete
        await waitForScoring(
          testRecord.portalId,
          testRecord.objectId,
          testRecord.objectType,
          {
            onPolling: (status, attempt, max) => {
              console.log(`First scoring status: ${status.scoring_status} (attempt ${attempt + 1}/${max})`);
            }
          }
        );

        // Second attempt - should fail because we're now at the limit
        console.log('\nAttempting second score (should fail)...');
        const secondAttempt = await initiateScoring(
          testRecord.portalId,
          testRecord.objectId,
          testRecord.objectType
        );

        console.log('Second attempt response:', {
          status: secondAttempt.status,
          data: secondAttempt.data
        });

        expect(secondAttempt.status).toBe(400);
        expect(secondAttempt.data).toMatchObject({
          success: false,
          error: expect.stringContaining('Scoring limit reached')
        });

      } catch (error) {
        console.error('Error during test:', error);
        throw error;
      } finally {
        // Clean up test events
        console.log('\nCleaning up test events...');
        await supabase
          .from('ai_events')
          .delete()
          .eq('portal_id', testRecord.portalId)
          .eq('event_type', 'score');
      }
    }, 70000); // 70 second timeout
  });

}); 