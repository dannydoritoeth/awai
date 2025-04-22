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