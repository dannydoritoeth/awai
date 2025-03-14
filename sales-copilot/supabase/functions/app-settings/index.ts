import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS for preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Parse URL to get query parameters
    const url = new URL(req.url);
    const portalId = url.searchParams.get('portalId');

    if (req.method === 'GET') {
      // If it's a GET request for settings data
      if (portalId && req.headers.get('accept') === 'application/json') {
        const { data, error } = await supabase
          .from('portal_settings')
          .select('settings')
          .eq('portal_id', portalId)
          .single();

        if (error && error.code !== 'PGRST116') { // Ignore not found error
          return new Response(
            JSON.stringify({
              success: false,
              error: error.message
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            values: data?.settings || {}
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      // Return the HubSpot app settings JSON configuration
      return new Response(
        JSON.stringify({
          title: 'Sales Copilot Settings',
          sections: [
            {
              title: 'API Configuration',
              description: 'Configure your API keys and settings for the Sales Copilot integration.',
              properties: [
                {
                  name: 'openaiApiKey',
                  type: 'text',
                  label: 'OpenAI API Key',
                  description: 'Your OpenAI API key starting with sk-...',
                  required: true
                },
                {
                  name: 'pineconeApiKey',
                  type: 'text',
                  label: 'Pinecone API Key',
                  description: 'Your Pinecone API key',
                  required: true
                },
                {
                  name: 'pineconeEnvironment',
                  type: 'text',
                  label: 'Pinecone Environment',
                  description: 'Your Pinecone environment (e.g., gcp-starter)',
                  required: true
                },
                {
                  name: 'pineconeIndexName',
                  type: 'text',
                  label: 'Pinecone Index Name',
                  description: 'Your Pinecone index name',
                  required: true
                }
              ]
            }
          ]
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { portalId, values } = body;
      
      if (!portalId || !values) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required fields'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
      }

      // Update or insert settings for the portal
      const { error } = await supabase
        .from('portal_settings')
        .upsert({
          portal_id: portalId,
          settings: values,
          updated_at: new Date().toISOString()
        });

      if (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}); 