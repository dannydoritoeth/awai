import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get all secrets
    const secrets = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
      SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      HUBSPOT_CLIENT_ID: Deno.env.get('HUBSPOT_CLIENT_ID'),
      HUBSPOT_CLIENT_SECRET: Deno.env.get('HUBSPOT_CLIENT_SECRET'),
      PINECONE_API_KEY: Deno.env.get('PINECONE_API_KEY'),
      PINECONE_ENVIRONMENT: Deno.env.get('PINECONE_ENVIRONMENT'),
      PINECONE_INDEX: Deno.env.get('PINECONE_INDEX'),
      OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
    }

    // Return the secrets
    return new Response(
      JSON.stringify(secrets),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )
  }
}) 