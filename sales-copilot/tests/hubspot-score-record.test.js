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
      onPolling = () => {},
      expectedError = null
    } = options;

    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const status = await getScoringStatus(portalId, objectId, objectType);
      console.log('Current scoring status:', status);
      
      switch (status.scoring_status) {
        case 'completed':
          return status;
        case 'failed':
          if (expectedError && status.scoring_error?.includes(expectedError)) {
            return status; // Expected failure
          }
          throw new Error(`Scoring failed: ${status.scoring_error}`);
        case 'in_progress':
        case 'queued':
          onPolling(status, attempts, maxAttempts);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          attempts++;
          break;
        default:
          throw new Error(`Unexpected scoring status: ${status.scoring_status}`);
      }
    }
    
    throw new Error(`Scoring timed out after ${maxAttempts} attempts`);
  };

  describe('scoring quota tests', () => {
    const testRecord = {
      portalId: '242593348',
      objectId: '69338423994',
      objectType: 'deal'
    };

    const testQuotaLimit = async ({ planTier, limit, subscription = null }) => {
      console.log(`\nTesting ${planTier} plan with limit of ${limit} scores`);

      // First clean up any existing data
      console.log('Cleaning up existing data...');
      
      // Get all subscriptions for this portal
      const { data: existingSubs } = await supabase
        .from('subscriptions')
        .select('id, customer_id')
        .eq('metadata->>portal_id', testRecord.portalId);

      if (existingSubs?.length > 0) {
        console.log(`Found ${existingSubs.length} existing subscriptions to clean up`);
        
        // Delete all subscriptions
        await supabase
          .from('subscriptions')
          .delete()
          .in('id', existingSubs.map(s => s.id));

        // Get unique customer IDs
        const customerIds = [...new Set(existingSubs.map(s => s.customer_id).filter(Boolean))];
        
        // Delete all customers
        if (customerIds.length > 0) {
          await supabase
            .from('customers')
            .delete()
            .in('id', customerIds);
        }
      }

      // Set up subscription period dates
      const now = new Date();
      const periodStart = new Date(now);
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      // If subscription provided, create it with our period dates
      if (subscription) {
        // Create customer first
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .insert({
            platform: 'hubspot',
            platform_customer_id: testRecord.portalId,
            metadata: {}
          })
          .select()
          .single();

        if (customerError) {
          throw new Error(`Failed to insert test customer: ${customerError.message}`);
        }

        // Add customer_id to subscription and portal_id to metadata
        const subscriptionWithCustomer = {
          ...subscription,
          customer_id: customer.id,
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          metadata: {
            ...subscription.metadata,
            portal_id: testRecord.portalId
          }
        };

        console.log('Creating subscription with period:', {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString()
        });

        const { error: subInsertError } = await supabase
          .from('subscriptions')
          .insert(subscriptionWithCustomer);

        if (subInsertError) {
          throw new Error(`Failed to insert test subscription: ${subInsertError.message}`);
        }

        console.log('Successfully created test customer and subscription');

        // Debug: verify subscription was created correctly
        const { data: verifySubscription, error: verifyError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('metadata->>portal_id', testRecord.portalId)
          .eq('status', 'active')
          .single();

        if (verifyError) {
          console.error('Failed to verify subscription:', verifyError);
        } else {
          console.log('Verified subscription:', verifySubscription);
        }
      }

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

      // Create events up to one less than the limit, ensuring dates fall within subscription period
      const events = Array.from({ length: limit - 1 }, (_, i) => {
        // Calculate event date to be within subscription period
        const eventDate = new Date(periodStart);
        eventDate.setMinutes(eventDate.getMinutes() + i); // Spread events over minutes within the period
        
        return {
          portal_id: testRecord.portalId,
          event_type: 'score',
          object_type: testRecord.objectType,
          object_id: `test-object-${i}`,
          document_data: {
            status: 'completed',
            score: 0.8,
            summary: 'Test summary'
          },
          created_at: eventDate.toISOString()
        };
      });

      const { error: insertError } = await supabase
        .from('ai_events')
        .insert(events);

      if (insertError) {
        throw new Error(`Failed to insert test events: ${insertError.message}`);
      }

      // Debug: Get all events and their dates
      const { data: allEvents, error: eventsError } = await supabase
        .from('ai_events')
        .select('created_at')
        .eq('portal_id', testRecord.portalId)
        .eq('event_type', 'score')
        .order('created_at', { ascending: true });

      if (!eventsError && allEvents) {
        console.log('Event date range:', {
          count: allEvents.length,
          first: allEvents[0]?.created_at,
          last: allEvents[allEvents.length - 1]?.created_at,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString()
        });
      }

      // Verify we have exactly limit - 1 events within the period
      const { count: eventCount, error: countError } = await supabase
        .from('ai_events')
        .select('*', { count: 'exact', head: true })
        .eq('portal_id', testRecord.portalId)
        .eq('event_type', 'score')
        .gte('created_at', periodStart.toISOString())
        .lt('created_at', periodEnd.toISOString());

      if (countError) {
        throw new Error(`Failed to count events: ${countError.message}`);
      }

      expect(eventCount).toBe(limit - 1);
      console.log(`Successfully created ${eventCount} events within subscription period`);

      // Reset scoring status
      await resetScoringStatus(testRecord.portalId, testRecord.objectId, testRecord.objectType);
      
      try {
        // Get current subscription details for debugging
        const { data: activeSubscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('metadata->portal_id', testRecord.portalId)
          .eq('status', 'active')
          .single();
        
        console.log('Active subscription:', activeSubscription || 'None (free tier)');

        // Get current period scores for debugging
        const { data: scores } = await supabase
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

        // First attempt - should succeed because we're one under the limit
        console.log('\nAttempting first score (should succeed)...');
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

        // Wait for first scoring to complete, expecting it to fail with limit reached
        const firstScoringStatus = await waitForScoring(
          testRecord.portalId,
          testRecord.objectId,
          testRecord.objectType,
          {
            onPolling: (status, attempt, max) => {
              console.log(`First scoring status: ${status.scoring_status} (attempt ${attempt + 1}/${max})`);
            },
            expectedError: 'Score limit reached'
          }
        );

        // Verify the scoring failed due to limit
        expect(firstScoringStatus.scoring_status).toBe('failed');
        expect(firstScoringStatus.scoring_error).toContain('Score limit reached');

        // Second attempt - should fail immediately
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
        // Clean up
        // console.log('\nCleaning up...');
        // await supabase
        //   .from('ai_events')
        //   .delete()
        //   .eq('portal_id', testRecord.portalId)
        //   .eq('event_type', 'score');

        if (subscription) {
          await supabase
            .from('subscriptions')
            .delete()
            .eq('metadata->portal_id', testRecord.portalId);
        }
      }
    };

    test('free plan: can score up to but not beyond limit', async () => {
      await testQuotaLimit({
        planTier: 'free',
        limit: 50
      });
    }, 70000);

    test('starter plan: can score up to but not beyond limit', async () => {
      const now = new Date();
      const monthFromNow = new Date(now);
      monthFromNow.setMonth(monthFromNow.getMonth() + 1);

      await testQuotaLimit({
        planTier: 'starter',
        limit: 750,
        subscription: {
          status: 'active',
          plan_tier: 'starter',
          current_period_start: now.toISOString(),
          current_period_end: monthFromNow.toISOString(),
          cancel_at: null,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
          metadata: {
            portal_id: testRecord.portalId,
            stripe_price_id: 'price_starter_test',
            stripe_product_id: 'prod_starter_test'
          }
        }
      });
    }, 70000);
  });
}); 