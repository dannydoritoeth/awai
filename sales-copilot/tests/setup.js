// Load environment variables
require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize Supabase client
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Cleanup function for test data
async function cleanupTestData() {
  try {
    // Get the test portal ID from the edge function
    const { data: portalData, error: portalError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: {
          type: 'get_test_portal_id'
        }
      }
    });

    if (portalError) {
      console.error('Error getting test portal ID:', portalError);
      return;
    }

    const testPortalId = portalData.portal_id;
    if (!testPortalId) {
      console.error('No test portal ID returned from edge function');
      return;
    }

    // Call the edge function to cleanup test tables
    const { data: cleanupData, error: cleanupError } = await supabase.functions.invoke('test-integration', {
      body: {
        action: {
          type: 'cleanup_test_tables'
        }
      }
    });

    if (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
      return;
    }

    // Log cleanup results
    cleanupData.results.forEach(result => {
      if (result.success) {
        console.log(`Cleaned up ${result.table}`);
      } else {
        console.error(`Error cleaning up ${result.table}:`, result.error);
      }
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Export setup function for Jest globalSetup
module.exports = async () => {
  console.log('Environment variables loaded successfully');
  await cleanupTestData();
}; 