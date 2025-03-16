// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

console.log('Hello from hubspot-webcard-fetch!')

// This will be replaced with real data later
const mockData = {
  objectId: "94232081088",
  title: "AI Sales Copilot Scores",
  properties: {
    ideal_client_score: {
      value: 85,
      label: "Ideal Client Score",
      dataType: "NUMERIC"
    },
    engagement_score: {
      value: 92,
      label: "Engagement Score",
      dataType: "NUMERIC"
    },
    conversion_probability: {
      value: 78,
      label: "Conversion Probability",
      dataType: "NUMERIC"
    }
  }
}

serve(async (req) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }

  try {
    // Log the request URL and query parameters
    const url = new URL(req.url)
    const params = Object.fromEntries(url.searchParams.entries())
    console.log('Request received:', {
      url: url.toString(),
      params,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries())
    })

    // Log the request body if it exists
    let body = null;
    try {
      body = await req.json();
      console.log('Request body:', body);
    } catch (e) {
      console.log('No JSON body in request');
    }

    // Use the actual objectId from the request
    if (params.associatedObjectId) {
      mockData.objectId = params.associatedObjectId
    }

    const response = 
 {
  "responseVersion": "v3",
  "totalCount": 1,
  "cardLabel": "Tickets",
  "sections": [
    {
      "id": "123",
      "title": "Score: 76",
      "actions": []
    },
    {
      "id": "1234",
      "title": "Description explanation",
      "actions": []
    }
  ]
}
    ;

    console.log('Sending response:', response);

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Error in hubspot-webcard-fetch:', error)
    return new Response(
      JSON.stringify({
        status: "ERROR",
        message: error.message || "Internal server error",
        correlationId: crypto.randomUUID()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/hubspot-webcard-fetch' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
