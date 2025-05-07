import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, SemanticMatch, PlannerRecommendation } from '../mcpTypes.ts';
import { getSemanticMatches } from '../embeddings.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';
import { scoreProfileFit } from '../agent/scoreProfileFit.ts';

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
            result = await getSemanticMatches(
              supabase,
              roleId!,
              'profiles',
              10,
              0.6
            );
            matches.push(...result);
            break;

          case 'scoreProfileFit':
            if (tool.inputs.profileId) {
              result = await scoreProfileFit(
                supabase,
                tool.inputs.profileId,
                roleId!
              );
              recommendations.push({
                type: 'profile_fit',
                profileId: tool.inputs.profileId,
                score: result.score,
                details: result.details
              });
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

        // Record the action taken
        actionsTaken.push({
          tool: tool.tool,
          reason: tool.reason,
          confidence: tool.confidence,
          inputs: tool.inputs,
          result
        });

      } catch (error) {
        console.error(`Error executing ${tool.tool}:`, error);
        // Continue with other tools even if one fails
      }
    }

    // Sort matches by similarity score
    matches.sort((a, b) => b.similarity - a.similarity);

    // Sort recommendations by score if available
    recommendations.sort((a, b) => {
      const scoreA = a.score || a.similarity || 0;
      const scoreB = b.score || b.similarity || 0;
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
          'Review top candidate matches',
          'Assess capability and skill gaps',
          'Schedule interviews with recommended candidates'
        ]
      }
    };

  } catch (error) {
    console.error('Error in hiring loop:', error);
    return {
      success: false,
      message: error.message,
      error: {
        type: 'HIRING_LOOP_ERROR',
        message: 'Failed to run hiring loop',
        details: error
      }
    };
  }
} 