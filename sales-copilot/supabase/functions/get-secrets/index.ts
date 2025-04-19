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
      SUPABASE_DB_URL: Deno.env.get('SUPABASE_DB_URL'),
      HUBSPOT_REDIRECT_URI: Deno.env.get('HUBSPOT_REDIRECT_URI'),
      ENCRYPTION_KEY: Deno.env.get('ENCRYPTION_KEY'),
      HUBSPOT_DEVELOPER_API_KEY: Deno.env.get('HUBSPOT_DEVELOPER_API_KEY'),
      PINECONE_API_KEY: Deno.env.get('PINECONE_API_KEY'),
      OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
      APP_INSTALL_SUCCESS_URI: Deno.env.get('APP_INSTALL_SUCCESS_URI'),
      APP_INSTALL_FAILED_URI: Deno.env.get('APP_INSTALL_FAILED_URI'),
      PINECONE_INDEX: Deno.env.get('PINECONE_INDEX'),
      HUBSPOT_APP_ID: Deno.env.get('HUBSPOT_APP_ID'),
      HUBSPOT_CLIENT_ID: Deno.env.get('HUBSPOT_CLIENT_ID'),
      HUBSPOT_CLIENT_SECRET: Deno.env.get('HUBSPOT_CLIENT_SECRET'),
      STRIPE_SECRET_KEY: Deno.env.get('STRIPE_SECRET_KEY'),
      STRIPE_WEBHOOK_SECRET: Deno.env.get('STRIPE_WEBHOOK_SECRET'),
      STRIPE_STARTER_PRICE_ID: Deno.env.get('STRIPE_STARTER_PRICE_ID'),
      STRIPE_PRO_PRICE_ID: Deno.env.get('STRIPE_PRO_PRICE_ID'),
      STRIPE_GROWTH_PRICE_ID: Deno.env.get('STRIPE_GROWTH_PRICE_ID'),
      APP_URL: Deno.env.get('APP_URL'),
      PINECONE_INDEX_HOST: Deno.env.get('PINECONE_INDEX_HOST'),
      LOG_PORTAL_ID_SCORE: Deno.env.get('LOG_PORTAL_ID_SCORE'),
    }

    // Add expiry dates for each secret
    const secretsWithExpiry = Object.entries(secrets).map(([key, value]) => ({
      key,
      value,
      expiresAt: '2025-04-19T04:00:11.000Z' // Default expiry
    }))

    // Return the secrets with expiry
    return new Response(
      JSON.stringify(secretsWithExpiry),
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