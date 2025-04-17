import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Logger } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'

const logger = new Logger("score-record");

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Get the portal ID, record type, and record ID from the query parameters
    const url = new URL(req.url)
    const portalId = url.searchParams.get('portalId')
    const recordType = url.searchParams.get('recordType')
    const recordId = url.searchParams.get('recordId')

    if (!portalId || !recordType || !recordId) {
      throw new Error('Missing required parameters')
    }

    // Create a new scoring job
    const { data: job, error } = await supabaseClient
      .from('scoring_jobs')
      .insert({
        portal_id: portalId,
        record_type: recordType,
        record_id: recordId,
        status: 'processing',
        progress: 0
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Return the job ID to the client
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}) 