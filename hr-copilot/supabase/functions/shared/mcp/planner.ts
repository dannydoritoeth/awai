import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { PlannerRecommendation, MCPContext } from '../mcpTypes.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';

// Available MCP actions that can be recommended by the planner
const AVAILABLE_ACTIONS = {
  CANDIDATE_MODE: [
    {
      tool: 'getProfileContext',
      description: 'Load profile details and embedding',
      requiresProfileId: true
    },
    {
      tool: 'getSuggestedCareerPaths',
      description: 'Recommend future roles based on profile',
      requiresProfileId: true
    },
    {
      tool: 'getJobReadiness',
      description: 'Score profile readiness for a job',
      requiresProfileId: true,
      requiresJobId: true
    },
    {
      tool: 'getOpenJobs',
      description: 'Get list of available job opportunities',
      requiresProfileId: false
    },
    {
      tool: 'getCapabilityGaps',
      description: 'Compare profile capabilities to a role',
      requiresProfileId: true,
      requiresRoleId: true
    },
    {
      tool: 'getSkillGaps',
      description: 'Compare profile skills to a role',
      requiresProfileId: true,
      requiresRoleId: true
    },
    {
      tool: 'getSemanticSkillRecommendations',
      description: 'Suggest skill improvements via embeddings',
      requiresProfileId: true,
      requiresRoleId: false
    },
    {
      tool: 'getSemanticMatches',
      description: 'Return semantically similar records',
      requiresEmbedding: true,
      requiresTable: true
    },
    {
      tool: 'embedContext',
      description: 'Generate and store an embedding',
      requiresEntityType: true,
      requiresEntityId: true
    },
    {
      tool: 'nudge',
      description: 'Prompt profile to take an action',
      requiresProfileId: true,
      requiresActionType: true
    },
    {
      tool: 'handleChatInteraction',
      description: 'Interpret chat and guide next steps',
      requiresChatContext: true
    },
    {
      tool: 'scoreProfileFit',
      description: 'Calculate overall fit score for a role',
      requiresProfileId: true,
      requiresRoleId: true
    }
  ],
  HIRING_MODE: [
    {
      tool: 'getRoleDetail',
      description: 'Load role details and embedding',
      requiresRoleId: true
    },
    {
      tool: 'getMatchingProfiles',
      description: 'Find profiles that match role requirements',
      requiresRoleId: true
    },
    {
      tool: 'getCapabilityGaps',
      description: 'Compare a profile to role capability needs',
      requiresProfileId: true,
      requiresRoleId: true
    },
    {
      tool: 'getSkillGaps',
      description: 'Compare a profile to role skill needs',
      requiresProfileId: true,
      requiresRoleId: true
    },
    {
      tool: 'scoreProfileFit',
      description: 'Calculate fit score for a specific profile',
      requiresProfileId: true,
      requiresRoleId: true
    },
    {
      tool: 'getSemanticCompanyFit',
      description: 'Compare profile to company/division embedding',
      requiresProfileId: true,
      requiresCompanyId: true
    },
    {
      tool: 'embedContext',
      description: 'Generate and store an embedding',
      requiresEntityType: true,
      requiresEntityId: true
    },
    {
      tool: 'nudge',
      description: 'Send a system-generated prompt',
      requiresProfileId: true,
      requiresActionType: true
    },
    {
      tool: 'handleChatInteraction',
      description: 'Understand and respond to manager input',
      requiresChatContext: true
    }
  ]
};

interface PlannerContext {
  mode: 'candidate' | 'hiring';
  profileId?: string;
  roleId?: string;
  jobId?: string;
  lastMessage?: string;
  semanticContext?: {
    currentFocus?: 'role' | 'skill' | 'capability' | 'company';
    previousMatches?: any[];
  };
}

/**
 * Use OpenAI to analyze context and select appropriate MCP actions
 */
async function getAIRecommendations(
  context: PlannerContext,
  availableActions: typeof AVAILABLE_ACTIONS.CANDIDATE_MODE | typeof AVAILABLE_ACTIONS.HIRING_MODE
): Promise<PlannerRecommendation[]> {
  try {
    const systemPrompt = `You are an AI career planning assistant that helps select the most appropriate actions to take based on user context and available tools.

Available tools:
${availableActions.map(action => `- ${action.tool}: ${action.description}`).join('\n')}

Your task is to:
1. Analyze the user's message and context
2. Select the most appropriate tools to use
3. Provide a clear reason for each tool selection
4. Ensure selected tools have required parameters available
5. Return a JSON array of recommendations

IMPORTANT: You must respond with ONLY a valid JSON array. Each object in the array must have these exact fields:
{
  "tool": "name_of_tool",
  "reason": "clear explanation why this tool is needed",
  "confidence": number between 0 and 1,
  "inputs": { object with required parameters }
}

Example response:
[
  {
    "tool": "getProfileContext",
    "reason": "Need to load current profile data to make recommendations",
    "confidence": 0.9,
    "inputs": {
      "profileId": "123"
    }
  }
]`;

    const userMessage = `Context:
- Mode: ${context.mode}
- Profile ID: ${context.profileId || 'Not provided'}
- Role ID: ${context.roleId || 'Not provided'}
- Job ID: ${context.jobId || 'Not provided'}
- Current Focus: ${context.semanticContext?.currentFocus || 'None'}
- User Message: ${context.lastMessage || 'No message provided'}

Based on this context, return a JSON array of recommended tools to use.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', result);
      // Fall back to rule-based recommendations
      return getRuleBasedRecommendations(context);
    }

    try {
      // Since we're using response_format: json_object, we need to parse the recommendations field
      const content = JSON.parse(result.choices[0].message.content);
      const aiRecommendations = content.recommendations || [];
      
      // Validate recommendations
      if (!Array.isArray(aiRecommendations)) {
        throw new Error('AI response is not an array');
      }

      // Ensure each recommendation has required fields and parameters
      return aiRecommendations.map(rec => validateRecommendation(rec, availableActions));

    } catch (parseError) {
      console.error('Error parsing AI recommendations:', parseError);
      // Fall back to rule-based recommendations
      return getRuleBasedRecommendations(context);
    }

  } catch (error) {
    console.error('Error getting AI recommendations:', error);
    // Fall back to rule-based recommendations
    return getRuleBasedRecommendations(context);
  }
}

/**
 * Validate and normalize a recommendation from the AI
 */
function validateRecommendation(
  recommendation: any,
  availableActions: typeof AVAILABLE_ACTIONS.CANDIDATE_MODE | typeof AVAILABLE_ACTIONS.HIRING_MODE
): PlannerRecommendation {
  const actionDef = availableActions.find(a => a.tool === recommendation.tool);
  if (!actionDef) {
    throw new Error(`Invalid tool: ${recommendation.tool}`);
  }

  return {
    tool: recommendation.tool,
    reason: recommendation.reason || 'No reason provided',
    confidence: Math.min(Math.max(recommendation.confidence || 0.5, 0), 1),
    inputs: recommendation.inputs || {}
  };
}

/**
 * Fall back to rule-based recommendations when AI is unavailable
 */
function getRuleBasedRecommendations(context: PlannerContext): PlannerRecommendation[] {
  const recommendations: PlannerRecommendation[] = [];
  const { mode, profileId, roleId } = context;
    
  // Basic action selection based on context
  if (mode === 'candidate' && profileId) {
    recommendations.push({
      tool: 'getSuggestedCareerPaths',
      reason: 'Providing career path recommendations based on profile context',
      confidence: 0.9,
      inputs: { profileId }
    });

    if (roleId) {
      recommendations.push(
        {
          tool: 'getCapabilityGaps',
          reason: 'Analyzing capability gaps for target role',
          confidence: 0.85,
          inputs: { profileId, roleId }
        },
        {
          tool: 'getSkillGaps',
          reason: 'Analyzing skill gaps for target role',
          confidence: 0.85,
          inputs: { profileId, roleId }
        }
      );
    }

    if (!roleId) {
      recommendations.push({
        tool: 'getOpenJobs',
        reason: 'Finding relevant job opportunities',
        confidence: 0.8,
        inputs: {}
      });
    }
  }

  if (mode === 'hiring' && roleId) {
    recommendations.push({
      tool: 'getMatchingProfiles',
      reason: 'Finding candidates that match role requirements',
      confidence: 0.9,
      inputs: { roleId }
    });

    if (profileId) {
      recommendations.push({
        tool: 'scoreProfileFit',
        reason: 'Evaluating specific candidate fit for role',
        confidence: 0.85,
        inputs: { profileId, roleId }
      });
    }
  }

  return recommendations;
}

/**
 * Main planner function that uses AI when available, falls back to rules when needed
 */
export async function getPlannerRecommendation(
  supabase: SupabaseClient<Database>,
  context: PlannerContext
): Promise<PlannerRecommendation[]> {
  try {
    const { mode } = context;
    const availableActions = mode === 'candidate' 
      ? AVAILABLE_ACTIONS.CANDIDATE_MODE 
      : AVAILABLE_ACTIONS.HIRING_MODE;

    // Get recommendations from AI
    const recommendations = await getAIRecommendations(context, availableActions);

    // Log the planner's recommendations
    await logAgentAction(supabase, {
      entityType: mode === 'candidate' ? 'profile' : 'role',
      entityId: mode === 'candidate' ? context.profileId! : context.roleId!,
      payload: {
        action: 'planner_recommendation',
        recommendations,
        context: {
          mode,
          lastMessage: context.lastMessage,
          semanticContext: context.semanticContext
        }
      },
      semanticMetrics: {
        similarityScores: {},
        matchingStrategy: 'hybrid',
        confidenceScore: recommendations.reduce((acc, rec) => acc + rec.confidence, 0) / recommendations.length
      }
    });

    return recommendations;

  } catch (error) {
    console.error('Error in planner:', error);
    throw error;
  }
} 