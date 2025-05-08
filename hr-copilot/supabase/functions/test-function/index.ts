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
import { testJobMatching } from '../shared/job/testJobMatching.ts'

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
    const { action, profileId, limit, threshold } = await req.json()

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    )

    let result

    switch (action) {
      case 'testJobMatching':
        if (!profileId) {
          throw new Error('profileId is required for job matching test')
        }
        result = await testJobMatching(supabaseClient, profileId, {
          limit: limit || 20,
          threshold: threshold || 0.7
        })
        break

      // ... other test cases ...

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}) 