import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'
import { getJobReadiness } from '../shared/job/getJobReadiness.ts'

interface TestFunctionRequest {
  function: string;
  [key: string]: any;
}

// Function parameter validation schemas
const functionSchemas = {
  jobReadiness: {
    required: ['profileId', 'jobId'],
    validate: (params: any) => {
      return params.profileId && params.jobId;
    }
  }
  // Add more function schemas here as needed
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get request body
    const { function: functionName, ...params } = await req.json() as TestFunctionRequest

    // Validate function exists
    if (!functionSchemas[functionName as keyof typeof functionSchemas]) {
      return new Response(
        JSON.stringify({ error: `Function ${functionName} not found` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Get function schema
    const schema = functionSchemas[functionName as keyof typeof functionSchemas]

    // Validate required parameters
    const missingParams = schema.required.filter(param => !params[param])
    if (missingParams.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: `Missing required parameters: ${missingParams.join(', ')}`,
          required: schema.required 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Validate parameter values
    if (!schema.validate(params)) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameter values' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Call the appropriate function based on name
    let result
    switch (functionName) {
      case 'jobReadiness':
        result = await getJobReadiness(supabaseClient, params.profileId, params.jobId)
        break
      default:
        throw new Error(`Function ${functionName} not implemented`)
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}) 