import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../database.types';
import { MCPRequest, MCPResponse, SemanticMatch } from '../mcpTypes';
import { getJobContext } from '../getJobContext';
import { getRoleContext } from '../getRoleContext';
import { getCompanyContext } from '../getCompanyContext';
import { getDivisionContext } from '../getDivisionContext';
import { getCandidateMatches } from '../getCandidateMatches';
import { getCandidateReadiness } from '../getCandidateReadiness';
import { logAgentAction } from '../logAgentAction';
import { getSemanticMatches } from '../embeddings';

export async function runHiringLoop(
  supabase: SupabaseClient<Database>,
  request: MCPRequest
): Promise<MCPResponse> {
  try {
    const { jobId, roleId, companyId, divisionId, context } = request;
    const matches: SemanticMatch[] = [];
    const recommendations: any[] = [];

    // Get context with embeddings
    const jobContext = await getJobContext(supabase, jobId!);
    const roleContext = await getRoleContext(supabase, roleId!);
    const companyContext = await getCompanyContext(supabase, companyId!);
    const divisionContext = await getDivisionContext(supabase, divisionId!);

    if (jobContext.error || roleContext.error || companyContext.error || divisionContext.error) {
      throw new Error('Failed to get context data');
    }

    // Get candidate matches using both traditional and semantic matching
    const candidateMatches = await getCandidateMatches(supabase, {
      jobId: jobId!,
      roleId: roleId!,
      companyId: companyId!,
      divisionId: divisionId!
    });

    if (!candidateMatches.error && candidateMatches.data) {
      for (const candidate of candidateMatches.data) {
        // Get semantic matches for the candidate
        const candidateSemanticMatches = await getSemanticMatches(
          supabase,
          candidate.embedding,
          'profiles',
          1,
          0.7
        );

        // Get candidate readiness
        const readiness = await getCandidateReadiness(supabase, {
          profileId: candidate.id,
          jobId: jobId!,
          roleId: roleId!
        });

        if (readiness.error) continue;

        // Combine semantic and traditional matches
        matches.push(
          ...candidateSemanticMatches.map(match => ({
            id: match.entityId,
            similarity: match.similarity,
            type: 'profile' as const,
            metadata: {
              jobId: jobId,
              roleId: roleId,
              companyId: companyId,
              divisionId: divisionId
            }
          }))
        );

        recommendations.push({
          type: 'candidate_match',
          score: readiness.data!.score,
          semanticScore: candidateSemanticMatches[0]?.similarity || 0,
          summary: readiness.data!.summary,
          details: {
            profileId: candidate.id,
            semanticMatch: candidateSemanticMatches[0],
            readiness: readiness.data
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
      entityType: 'job',
      entityId: jobId!,
      payload: {
        action: 'mcp_loop_complete',
        mode: 'hiring',
        recommendations: recommendations.slice(0, 5),
        matches: matches.slice(0, 10)
      },
      semanticMetrics: {
        similarityScores: {
          profileMatch: matches.find(m => m.type === 'profile')?.similarity,
          roleAlignment: matches.find(m => m.type === 'role')?.similarity,
          companyAlignment: matches.find(m => m.type === 'company')?.similarity
        },
        matchingStrategy: 'hybrid',
        confidenceScore: 0.8
      }
    });

    return {
      success: true,
      message: 'Hiring loop completed successfully',
      data: {
        matches: matches.slice(0, 10),
        recommendations: recommendations.slice(0, 5),
        nextActions: [
          'Review top candidate matches',
          'Schedule interviews with recommended candidates',
          'Update job requirements based on market insights'
        ]
      }
    };

  } catch (error) {
    return {
      success: false,
      message: error.message,
      error: {
        type: 'PLANNER_ERROR',
        message: 'Failed to run hiring loop',
        details: error
      }
    };
  }
} 