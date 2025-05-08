import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, SemanticMatch, PlannerRecommendation } from '../mcpTypes.ts';
import { getSemanticMatches } from '../embeddings.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';
import { batchScoreProfileFit } from '../agent/scoreProfileFit.ts';

export async function runHiringLoop(
  supabase: SupabaseClient<Database>,
  request: MCPRequest & { plannerRecommendations?: PlannerRecommendation[] }
): Promise<MCPResponse> {
  try {
    const { roleId, plannerRecommendations = [] } = request;
    const matches: SemanticMatch[] = [];
    const actionsTaken: any[] = [];
    const recommendations: any[] = [];

    // Execute planner recommendations or use defaults
    const toolsToRun = plannerRecommendations.length > 0 ? plannerRecommendations : [
      {
        tool: 'getMatchingProfiles',
        reason: 'Default action to find matching profiles',
        confidence: 0.8,
        inputs: { roleId }
      }
    ];

    // Process each recommended tool
    for (const tool of toolsToRun) {
      try {
        let result;
        switch (tool.tool) {
          case 'getMatchingProfiles':
            // Get semantic matches for the role
            const semanticMatches = await getSemanticMatches(
              supabase,
              { id: roleId!, table: 'roles' },
              'profiles',
              10,
              0.6
            );
            matches.push(...semanticMatches);

            // Score all matched profiles in batch
            if (semanticMatches.length > 0) {
              const profileIds = semanticMatches.map(match => match.id);
              const scoreResults = await batchScoreProfileFit(supabase, roleId!, profileIds, {
                maxRoles: 10,
                maxConcurrent: 5
              });

              // Add scored results to recommendations
              for (const result of scoreResults) {
                if (result.result.data) {
                  recommendations.push({
                    type: 'profile_fit',
                    profileId: result.roleId, // roleId here is actually profileId since we swapped the perspective
                    score: result.result.data.score,
                    semanticScore: semanticMatches.find(m => m.id === result.roleId)?.similarity || 0,
                    summary: result.result.data.matchSummary,
                    details: result.result.data
                  });
                }
              }
            }
            break;

          case 'getCapabilityGaps':
            if (tool.inputs.profileId) {
              result = await getCapabilityGaps(
                supabase,
                tool.inputs.profileId,
                roleId!
              );
              recommendations.push({
                type: 'capability_gaps',
                profileId: tool.inputs.profileId,
                gaps: result.gaps,
                summary: result.summary
              });
            }
            break;

          case 'getSkillGaps':
            if (tool.inputs.profileId) {
              result = await getSkillGaps(
                supabase,
                tool.inputs.profileId,
                roleId!
              );
              recommendations.push({
                type: 'skill_gaps',
                profileId: tool.inputs.profileId,
                gaps: result.gaps,
                summary: result.summary
              });
            }
            break;
        }

        // Log the action
        actionsTaken.push({
          tool: tool.tool,
          reason: tool.reason,
          inputs: tool.inputs,
          result
        });

      } catch (error) {
        console.error(`Error executing tool ${tool.tool}:`, error);
        // Continue with other tools
      }
    }

    // Sort recommendations by combined score
    recommendations.sort((a, b) => {
      const scoreA = (a.score * 0.4) + ((a.semanticScore || 0) * 0.6);
      const scoreB = (b.score * 0.4) + ((b.semanticScore || 0) * 0.6);
      return scoreB - scoreA;
    });

    return {
      success: true,
      message: 'Hiring loop completed successfully',
      data: {
        matches: matches.slice(0, 10),
        recommendations: recommendations.slice(0, 5),
        actionsTaken,
        nextActions: [
          'Review top candidate profiles',
          'Schedule interviews',
          'Assess skill gaps'
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