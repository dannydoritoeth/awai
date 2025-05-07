import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../database.types';
import { MCPRequest, MCPResponse, SemanticMatch } from '../mcpTypes';
import { getProfileContext } from '../getProfileContext';
import { getSuggestedCareerPaths } from '../getSuggestedCareerPaths';
import { getRoleDetail } from '../getRoleDetail';
import { getCapabilityGaps } from '../getCapabilityGaps';
import { getSkillGaps } from '../getSkillGaps';
import { getOpenJobs } from '../getOpenJobs';
import { getJobReadiness } from '../getJobReadiness';
import { logAgentAction } from '../logAgentAction';
import { getSemanticMatches } from '../embeddings';

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
    const careerPaths = await getSuggestedCareerPaths(supabase, profileId!);
    if (!careerPaths.error && careerPaths.data) {
      for (const path of careerPaths.data) {
        const roleDetail = await getRoleDetail(supabase, path.target_role.id);
        if (roleDetail.error) continue;

        // Get semantic matches for capabilities and skills
        const capabilityMatches = await getSemanticMatches(
          supabase,
          profileContext.data!.embedding,
          'capabilities',
          5
        );

        const skillMatches = await getSemanticMatches(
          supabase,
          profileContext.data!.embedding,
          'skills',
          5
        );

        // Get traditional gap analysis
        const gaps = await getCapabilityGaps(supabase, profileId!, path.target_role.id);
        const skillGaps = await getSkillGaps(supabase, profileId!, path.target_role.id);

        // Combine semantic and traditional matches
        matches.push(
          ...capabilityMatches.map(match => ({
            id: match.entityId,
            similarity: match.similarity,
            type: 'capability' as const,
            metadata: { roleId: path.target_role.id }
          })),
          ...skillMatches.map(match => ({
            id: match.entityId,
            similarity: match.similarity,
            type: 'skill' as const,
            metadata: { roleId: path.target_role.id }
          }))
        );

        recommendations.push({
          type: 'career_path',
          score: path.popularity_score || 0,
          semanticScore: (capabilityMatches[0]?.similarity || 0 + skillMatches[0]?.similarity || 0) / 2,
          summary: `Career path to ${path.target_role.title}`,
          details: {
            capabilityGaps: gaps.data?.length || 0,
            skillGaps: skillGaps.data?.length || 0,
            semanticMatches: {
              capabilities: capabilityMatches.length,
              skills: skillMatches.length
            }
          }
        });
      }
    }

    // Get open jobs with semantic matching
    const openJobs = await getOpenJobs(supabase);
    if (!openJobs.error && openJobs.data) {
      for (const job of openJobs.data) {
        const readiness = await getJobReadiness(supabase, profileId!, job.jobId);
        if (readiness.error) continue;

        // Get semantic matches for the job
        const jobMatches = await getSemanticMatches(
          supabase,
          profileContext.data!.embedding,
          'jobs',
          1,
          0.7
        );

        if (jobMatches.length > 0) {
          recommendations.push({
            type: 'job_opportunity',
            score: readiness.data!.score,
            semanticScore: jobMatches[0].similarity,
            summary: readiness.data!.summary,
            details: {
              jobId: job.jobId,
              semanticMatch: jobMatches[0]
            }
          });
        }
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