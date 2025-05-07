import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'
import { getJobReadiness } from '../shared/job/getJobReadiness.ts'
import { getCapabilityGaps } from '../shared/profile/getCapabilityGaps.ts'
import { getSkillGaps } from '../shared/profile/getSkillGaps.ts'
import { getProfileContext } from '../shared/profile/getProfileContext.ts'
import { getSuggestedCareerPaths } from '../shared/profile/getSuggestedCareerPaths.ts'
import { getRoleDetail } from '../shared/role/getRoleDetail.ts'
import { getOpenJobs } from '../shared/job/getOpenJobs.ts'
import { getMatchingProfiles } from '../shared/role/getMatchingProfiles.ts'
import { scoreProfileFit } from '../shared/agent/scoreProfileFit.ts'
import { getSemanticMatches } from '../shared/embeddings.ts'

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
  },
  capabilityGaps: {
    required: ['profileId', 'targetRoleId'],
    validate: (params: any) => {
      return params.profileId && params.targetRoleId;
    }
  },
  skillGaps: {
    required: ['profileId', 'targetRoleId'],
    validate: (params: any) => {
      return params.profileId && params.targetRoleId;
    }
  },
  profileContext: {
    required: ['profileId'],
    validate: (params: any) => {
      return params.profileId;
    }
  },
  suggestedCareerPaths: {
    required: ['profileId'],
    validate: (params: any) => {
      return params.profileId;
    }
  },
  roleDetail: {
    required: ['roleId'],
    validate: (params: any) => {
      return params.roleId;
    }
  },
  openJobs: {
    required: [],
    validate: () => true
  },
  matchingProfiles: {
    required: ['roleId'],
    validate: (params: any) => {
      return params.roleId;
    }
  },
  scoreProfileFit: {
    required: ['profileId', 'roleId'],
    validate: (params: any) => {
      return params.profileId && params.roleId;
    }
  },
  semanticMatches: {
    required: ['embedding', 'targetTable', 'limit', 'minScore'],
    validate: (params: any) => {
      return params.embedding && params.targetTable && 
             typeof params.limit === 'number' && 
             typeof params.minScore === 'number';
    }
  }
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
      case 'capabilityGaps':
        result = await getCapabilityGaps(supabaseClient, params.profileId, params.targetRoleId)
        break
      case 'skillGaps':
        result = await getSkillGaps(supabaseClient, params.profileId, params.targetRoleId)
        break
      case 'profileContext':
        result = await getProfileContext(supabaseClient, params.profileId)
        break
      case 'suggestedCareerPaths':
        result = await getSuggestedCareerPaths(supabaseClient, params.profileId)
        break
      case 'roleDetail':
        result = await getRoleDetail(supabaseClient, params.roleId)
        break
      case 'openJobs':
        result = await getOpenJobs(supabaseClient, params.roleId) // roleId is optional
        break
      case 'matchingProfiles':
        result = await getMatchingProfiles(supabaseClient, params.roleId)
        break
      case 'scoreProfileFit':
        result = await scoreProfileFit(supabaseClient, params.profileId, params.roleId)
        break
      case 'semanticMatches':
        result = await getSemanticMatches(
          supabaseClient, 
          params.embedding, 
          params.targetTable, 
          params.limit, 
          params.minScore
        )
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