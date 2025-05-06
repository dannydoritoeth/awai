import { serve } from 'https://deno.fresh.dev/std@v1/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  getProfileContext,
  getSuggestedCareerPaths,
  getRoleDetail,
  getCapabilityGaps,
  getSkillGaps,
  getOpenJobs,
  getJobReadiness,
  getMatchingProfiles,
  scoreProfileFit,
  logAgentAction
} from '../_shared/index.ts';

interface MCPRequest {
  profileId?: string;
  roleId?: string;
  mode: 'candidate' | 'hiring';
}

interface MCPSummary {
  mode: 'candidate' | 'hiring';
  processedItems: number;
  recommendations: Array<{
    type: string;
    score: number;
    summary: string;
  }>;
  nextSteps?: string[];
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { profileId, roleId, mode } = await req.json() as MCPRequest;

    // Validate inputs
    if (mode === 'candidate' && !profileId) {
      return new Response(
        JSON.stringify({ error: 'profileId is required for candidate mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'hiring' && !roleId) {
      return new Response(
        JSON.stringify({ error: 'roleId is required for hiring mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let summary: MCPSummary;

    if (mode === 'candidate') {
      summary = await runCandidateLoop(supabaseClient, profileId!);
    } else {
      summary = await runHiringLoop(supabaseClient, roleId!);
    }

    // Log the MCP run
    await logAgentAction(
      supabaseClient,
      mode === 'candidate' ? 'profile' : 'role',
      mode === 'candidate' ? profileId! : roleId!,
      {
        action: 'mcp_loop_complete',
        mode,
        summary
      }
    );

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function runCandidateLoop(
  supabase: SupabaseClient,
  profileId: string
): Promise<MCPSummary> {
  const recommendations: MCPSummary['recommendations'] = [];

  // Get profile context
  const profileContext = await getProfileContext(supabase, profileId);
  if (profileContext.error) {
    throw new Error(`Failed to get profile context: ${profileContext.error.message}`);
  }

  // Get career path suggestions
  const careerPaths = await getSuggestedCareerPaths(supabase, profileId);
  if (!careerPaths.error && careerPaths.data) {
    for (const path of careerPaths.data) {
      const roleDetail = await getRoleDetail(supabase, path.target_role.id);
      if (roleDetail.error) continue;

      const gaps = await getCapabilityGaps(supabase, profileId, path.target_role.id);
      const skillGaps = await getSkillGaps(supabase, profileId, path.target_role.id);

      recommendations.push({
        type: 'career_path',
        score: path.popularity_score || 0,
        summary: `Career path to ${path.target_role.title} (${gaps.data?.length || 0} capability gaps, ${skillGaps.data?.length || 0} skill gaps)`
      });
    }
  }

  // Get open jobs
  const openJobs = await getOpenJobs(supabase);
  if (!openJobs.error && openJobs.data) {
    for (const job of openJobs.data) {
      const readiness = await getJobReadiness(supabase, profileId, job.jobId);
      if (readiness.error) continue;

      recommendations.push({
        type: 'job_opportunity',
        score: readiness.data!.score,
        summary: readiness.data!.summary
      });
    }
  }

  // Sort recommendations by score
  recommendations.sort((a, b) => b.score - a.score);

  return {
    mode: 'candidate',
    processedItems: recommendations.length,
    recommendations: recommendations.slice(0, 5), // Top 5 recommendations
    nextSteps: [
      'Review suggested career paths',
      'Explore job opportunities',
      'Focus on closing identified skill gaps'
    ]
  };
}

async function runHiringLoop(
  supabase: SupabaseClient,
  roleId: string
): Promise<MCPSummary> {
  const recommendations: MCPSummary['recommendations'] = [];

  // Get role details
  const roleDetail = await getRoleDetail(supabase, roleId);
  if (roleDetail.error) {
    throw new Error(`Failed to get role details: ${roleDetail.error.message}`);
  }

  // Get matching profiles
  const matches = await getMatchingProfiles(supabase, roleId);
  if (!matches.error && matches.data) {
    for (const match of matches.data) {
      const fitScore = await scoreProfileFit(supabase, match.profileId, roleId);
      if (fitScore.error) continue;

      const profileContext = await getProfileContext(supabase, match.profileId);
      if (profileContext.error) continue;

      const gaps = await getCapabilityGaps(supabase, match.profileId, roleId);
      const skillGaps = await getSkillGaps(supabase, match.profileId, roleId);

      recommendations.push({
        type: 'candidate_match',
        score: fitScore.data!.score,
        summary: `${match.name}: ${fitScore.data!.summary} (${gaps.data?.length || 0} capability gaps, ${skillGaps.data?.length || 0} skill gaps)`
      });
    }
  }

  // Sort recommendations by score
  recommendations.sort((a, b) => b.score - a.score);

  return {
    mode: 'hiring',
    processedItems: recommendations.length,
    recommendations: recommendations.slice(0, 5), // Top 5 recommendations
    nextSteps: [
      'Review top candidate matches',
      'Schedule initial screenings',
      'Consider development plans for promising candidates with gaps'
    ]
  };
} 