import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, SemanticMatch } from '../mcpTypes.ts';
import { getProfileContext } from '../profile/getProfileContext.ts';
import { getSuggestedCareerPaths } from '../profile/getSuggestedCareerPaths.ts';
// import { getRoleDetail } from '../role/getRoleDetail.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';
import { getOpenJobs } from '../job/getOpenJobs.ts';
import { getJobReadiness } from '../job/getJobReadiness.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';
import { getSemanticMatches } from '../embeddings.ts';
import { getProfileData } from '../profile/getProfileData.ts';
import { getRolesData } from '../role/getRoleData.ts';
import { calculateJobReadiness, generateJobSummary } from '../job/jobReadiness.ts';

export async function runCandidateLoop(
  supabase: SupabaseClient<Database>,
  request: MCPRequest
): Promise<MCPResponse> {
  try {
    const { profileId, context } = request;
    const matches: SemanticMatch[] = [];
    const recommendations: any[] = [];

    // Get profile context with embedding
    const profileContext = await getProfileContext(supabase, profileId!);
    if (profileContext.error) {
      throw new Error(`Failed to get profile context: ${profileContext.error.message}`);
    }

    // Get career path suggestions using semantic matching
    // const careerPaths = await getSuggestedCareerPaths(supabase, profileId!);
    // if (!careerPaths.error && careerPaths.data) {
    //   for (const path of careerPaths.data) {
    //     const roleDetail = await getRoleDetail(supabase, path.target_role.id);
    //     if (roleDetail.error) continue;

    //     // Get semantic matches for capabilities and skills using profile ID
    //     const capabilityMatches = await getSemanticMatches(
    //       supabase,
    //       profileId!, // Use profile ID instead of embedding
    //       'capabilities',
    //       5
    //     );

    //     const skillMatches = await getSemanticMatches(
    //       supabase,
    //       profileId!, // Use profile ID instead of embedding
    //       'skills',
    //       5
    //     );

    //     // Get traditional gap analysis
    //     const gaps = await getCapabilityGaps(supabase, profileId!, path.target_role.id);
    //     const skillGaps = await getSkillGaps(supabase, profileId!, path.target_role.id);

    //     // Combine semantic and traditional matches
    //     matches.push(
    //       ...capabilityMatches.map(match => ({
    //         id: match.entityId,
    //         similarity: match.similarity,
    //         type: 'capability' as const,
    //         metadata: { roleId: path.target_role.id }
    //       })),
    //       ...skillMatches.map(match => ({
    //         id: match.entityId,
    //         similarity: match.similarity,
    //         type: 'skill' as const,
    //         metadata: { roleId: path.target_role.id }
    //       }))
    //     );

    //     recommendations.push({
    //       type: 'career_path',
    //       score: path.popularity_score || 0,
    //       semanticScore: (capabilityMatches[0]?.similarity || 0 + skillMatches[0]?.similarity || 0) / 2,
    //       summary: `Career path to ${path.target_role.title}`,
    //       details: {
    //         capabilityGaps: gaps.data?.length || 0,
    //         skillGaps: skillGaps.data?.length || 0,
    //         semanticMatches: {
    //           capabilities: capabilityMatches.length,
    //           skills: skillMatches.length
    //         }
    //       }
    //     });
    //   }
    // }

    // Get open jobs with semantic matching
    const openJobs = await getOpenJobs(supabase, undefined, 20);
    if (!openJobs.error && openJobs.data) {
      // Get all role IDs from jobs
      const roleIds = openJobs.data
        .map(job => job.roleId)
        .filter((id): id is string => !!id);

      // Bulk load all role and profile data upfront
      const [roleData, profileData] = await Promise.all([
        getRolesData(supabase, roleIds),
        getProfileData(supabase, profileId!)
      ]);

      // Get profile embedding once
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('embedding')
        .eq('id', profileId!)
        .single();

      if (profileError || !profile?.embedding) {
        console.error('Failed to get profile embedding:', profileError);
        return {
          success: false,
          message: 'Failed to get profile embedding',
          error: {
            type: 'DATABASE_ERROR',
            message: 'Failed to get profile embedding',
            details: profileError
          }
        };
      }

      // Get semantic matches for all roles at once
      const roleMatches = await getSemanticMatches(
        supabase,
        { id: profileId!, table: 'profiles' },
        'roles',
        roleIds.length,
        0.7
      );

      // Process each job with preloaded data
      for (const job of openJobs.data) {
        if (!job.roleId || !roleData[job.roleId]) continue;

        // Calculate job readiness score using preloaded data
        const readinessScore = calculateJobReadiness(
          profileData,
          roleData[job.roleId]
        );

        // Find semantic match for this role
        const semanticMatch = roleMatches.find(m => m.id === job.roleId);
        if (!semanticMatch) continue;

        recommendations.push({
          type: 'job_opportunity',
          score: readinessScore,
          semanticScore: semanticMatch.similarity,
          summary: generateJobSummary(profileData, roleData[job.roleId]),
          details: {
            jobId: job.jobId,
            semanticMatch
          }
        });
      }
    }

    // Sort recommendations by combined score (traditional + semantic)
    recommendations.sort((a, b) => {
      const scoreA = (a.score * 0.4) + (a.semanticScore * 0.6);
      const scoreB = (b.score * 0.4) + (b.semanticScore * 0.6);
      return scoreB - scoreA;
    });

    // Log the MCP run
    await logAgentAction(supabase, {
      entityType: 'profile',
      entityId: profileId!,
      payload: {
        action: 'mcp_loop_complete',
        mode: 'candidate',
        recommendations: recommendations.slice(0, 5),
        matches: matches.slice(0, 10)
      },
      semanticMetrics: {
        similarityScores: {
          roleMatch: matches.find(m => m.type === 'role')?.similarity,
          skillAlignment: matches.find(m => m.type === 'skill')?.similarity,
          capabilityAlignment: matches.find(m => m.type === 'capability')?.similarity
        },
        matchingStrategy: 'hybrid',
        confidenceScore: 0.8
      }
    });

    return {
      success: true,
      message: 'Candidate loop completed successfully',
      data: {
        matches: matches.slice(0, 10),
        recommendations: recommendations.slice(0, 5),
        nextActions: [
          'Review suggested career paths',
          'Explore job opportunities',
          'Focus on closing identified skill gaps'
        ]
      }
    };

  } catch (error) {
    return {
      success: false,
      message: error.message,
      error: {
        type: 'PLANNER_ERROR',
        message: 'Failed to run candidate loop',
        details: error
      }
    };
  }
} 