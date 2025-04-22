import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface TestAction {
  type: string;
  params?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action } = await req.json() as { action: TestAction }
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get test portal ID from environment
    const testPortalId = Deno.env.get('TEST_PORTAL_ID');
    console.log('TEST_PORTAL_ID:', testPortalId ? 'set' : 'not set');
    
    if (!testPortalId) {
      throw new Error('TEST_PORTAL_ID environment variable is required');
    }

    // Handle different test actions
    switch (action.type) {
      case 'get_test_portal_id':
        // Return the test portal ID
        return new Response(
          JSON.stringify({ portal_id: testPortalId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'test_db_connection':
        // Test database connection
        const { data, error } = await supabaseClient
          .from('hubspot_accounts')
          .select('count')
          .limit(1)
        
        if (error) throw error
        
        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'test_db_write':
        console.log('Attempting to write test data with portal_id:', testPortalId);
        // Test database write
        const { data: writeData, error: writeError } = await supabaseClient
          .from('hubspot_accounts')
          .insert([{ 
            portal_id: testPortalId,
            status: 'test',
            token_type: 'test'
          }])
          .select()
        
        if (writeError) {
          console.error('Write error:', writeError);
          throw writeError;
        }
        
        console.log('Write successful:', writeData);
        return new Response(
          JSON.stringify({ success: true, data: writeData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'test_db_cleanup':
        // Cleanup test data
        const { error: deleteError } = await supabaseClient
          .from('hubspot_accounts')
          .delete()
          .eq('portal_id', testPortalId)
        
        if (deleteError) throw deleteError
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'cleanup_test_tables':
        // Cleanup specific test tables
        const tables = ['hubspot_object_status', 'ai_events'];
        const results = [];

        for (const table of tables) {
          const { error: tableError } = await supabaseClient
            .from(table)
            .delete()
            .eq('portal_id', testPortalId);

          results.push({
            table,
            success: !tableError,
            error: tableError?.message
          });
        }

        return new Response(
          JSON.stringify({ success: true, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'check_hubspot_object_status':
        // Check hubspot_object_status table for test data
        const { data: statusData, error: statusError } = await supabaseClient
          .from('hubspot_object_status')
          .select('*')

        if (statusError) throw statusError;

          JSON.stringify({ 
            success: true, 
            count: statusData.length,
            data: statusData 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        throw new Error(`Unknown test action: ${action.type}`)
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 