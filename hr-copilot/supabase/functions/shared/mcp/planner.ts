import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { PlannerRecommendation, MCPContext } from '../mcpTypes.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';
import { buildSafePrompt } from './promptBuilder.ts';

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
      description: 'Find semantically similar entities across the system',
      requiresEmbedding: true,
      requiresEntityTypes: true
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
    },
    {
      tool: 'getSemanticMatches',
      description: 'Find semantically similar entities across the system',
      requiresEmbedding: true,
      requiresEntityTypes: true
    }
  ],
  GENERAL_MODE: [
    {
      tool: 'getSemanticMatches',
      description: 'Find semantically similar entities across the system',
      requiresEmbedding: true,
      requiresEntityTypes: true
    },
    {
      tool: 'handleChatInteraction',
      description: 'Process general chat interactions',
      requiresChatContext: true
    },
    {
      tool: 'embedContext',
      description: 'Generate and store an embedding',
      requiresText: true
    }
  ]
};

interface PlannerContext {
  mode: 'candidate' | 'hiring' | 'general';
  profileId?: string;
  roleId?: string;
  jobId?: string;
  lastMessage?: string;
  chatHistory?: ChatMessage[];
  agentActions?: AgentAction[];
  contextEmbedding?: number[];
  summary?: string;
  semanticContext?: {
    currentFocus?: 'role' | 'skill' | 'capability' | 'company';
    previousMatches?: any[];
    previousFocus?: 'role' | 'job' | 'capability' | 'company';
    matchingTopic?: string;
  };
}

/**
 * Use OpenAI to analyze context and select appropriate MCP actions
 */
async function getAIRecommendations(
  context: PlannerContext,
  availableActions: typeof AVAILABLE_ACTIONS.CANDIDATE_MODE | typeof AVAILABLE_ACTIONS.HIRING_MODE | typeof AVAILABLE_ACTIONS.GENERAL_MODE
): Promise<PlannerRecommendation[]> {
  try {
    const systemPrompt = `You are an AI career planning assistant that helps select the most appropriate actions to take based on user context and available tools.

Your task is to:
1. Analyze the user's message, chat history, and previous actions
2. Consider the conversation summary and semantic context
3. Select the most appropriate tools to use
4. Provide a clear reason for each tool selection
5. Ensure selected tools have required parameters available

IMPORTANT: You must respond with a valid JSON array containing objects with these exact fields:
{
  "tool": "string (one of the available tool names)",
  "reason": "string (explaining why this tool was chosen)",
  "confidence": "number (0-1)",
  "inputs": "object (containing required parameters)"
}`;

    const promptData = {
      systemPrompt,
      userMessage: 'Please select the most appropriate tools to use based on this context.',
      data: {
        context: {
          mode: context.mode,
          message: context.lastMessage || 'No message provided',
          profileId: context.profileId || 'Not provided',
          roleId: context.roleId || 'Not provided',
          jobId: context.jobId || 'Not provided',
          currentFocus: context.semanticContext?.currentFocus || 'None',
          previousFocus: context.semanticContext?.previousFocus || 'None',
          matchingTopic: context.semanticContext?.matchingTopic || 'None',
          summary: context.summary || 'No summary available',
          chatHistoryLength: context.chatHistory?.length || 0,
          agentActionsLength: context.agentActions?.length || 0,
          hasContextEmbedding: !!context.contextEmbedding
        },
        availableTools: availableActions.map(action => ({
          tool: action.tool,
          description: action.description,
          requirements: Object.entries(action)
            .filter(([key]) => key.startsWith('requires'))
            .map(([key]) => key.replace('requires', '').toLowerCase())
        }))
      },
      context: {
        format: 'json',
        responseType: 'array',
        maxTools: 3
      }
    };

    const promptOptions = {
      maxItems: 10,
      maxFieldLength: 200,
      priorityFields: ['tool', 'description', 'requirements'],
      excludeFields: ['metadata']
    };

    const prompt = buildSafePrompt('openai:gpt-4o', promptData, promptOptions);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    const recommendations = JSON.parse(data.choices[0].message.content);

    if (!Array.isArray(recommendations)) {
      throw new Error('Invalid AI response format - expected array');
    }

    return recommendations;
  } catch (error) {
    console.error('Error getting AI recommendations:', error);
    return [];
  }
}

/**
 * Validate and normalize a recommendation from the AI
 */
function validateRecommendation(
  recommendation: any,
  availableActions: typeof AVAILABLE_ACTIONS.CANDIDATE_MODE | typeof AVAILABLE_ACTIONS.HIRING_MODE | typeof AVAILABLE_ACTIONS.GENERAL_MODE
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
  const { mode, profileId, roleId, semanticContext, chatHistory, agentActions, contextEmbedding } = context;
    
  // If we have a context embedding, always consider semantic matches first
  if (contextEmbedding) {
    recommendations.push({
      tool: 'getSemanticMatches',
      reason: 'Using conversation context to find relevant matches',
      confidence: 0.9,
      inputs: {
        embedding: contextEmbedding,
        entityTypes: mode === 'candidate' ? ['role', 'skill'] : mode === 'hiring' ? ['profile', 'capability'] : ['role', 'profile', 'skill']
      }
    });
  }

  // If we have previous actions, consider their outcomes
  if (agentActions?.length) {
    const lastAction = agentActions[0];
    if (lastAction.payload.type === 'skill_gap' || lastAction.payload.type === 'capability_gap') {
      recommendations.push({
        tool: lastAction.payload.type === 'skill_gap' ? 'getSkillGaps' : 'getCapabilityGaps',
        reason: 'Following up on previously identified gaps',
        confidence: 0.85,
        inputs: { profileId, roleId }
      });
    }
  }

  // Basic action selection based on context
  if (mode === 'candidate' && profileId) {
    // If we have chat history, check if we've already suggested career paths
    const hasCareerPathSuggestion = chatHistory?.some(msg => 
      msg.toolCall?.tool === 'getSuggestedCareerPaths'
    );

    if (!hasCareerPathSuggestion) {
      recommendations.push({
        tool: 'getSuggestedCareerPaths',
        reason: 'Providing career path recommendations based on profile context',
        confidence: 0.9,
        inputs: { profileId }
      });
    }

    // If focusing on a specific role
    if (roleId || semanticContext?.currentFocus === 'role') {
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

    // If no specific role focus yet
    if (!roleId && !semanticContext?.currentFocus) {
      recommendations.push({
        tool: 'getOpenJobs',
        reason: 'Finding relevant job opportunities',
        confidence: 0.8,
        inputs: {}
      });
    }
  }

  if (mode === 'hiring' && roleId) {
    // If we have chat history, check if we've already found matches
    const hasMatchingProfiles = chatHistory?.some(msg => 
      msg.toolCall?.tool === 'getMatchingProfiles'
    );

    if (!hasMatchingProfiles) {
      recommendations.push({
        tool: 'getMatchingProfiles',
        reason: 'Finding candidates that match role requirements',
        confidence: 0.9,
        inputs: { roleId }
      });
    }

    if (profileId || semanticContext?.currentFocus === 'profile') {
      recommendations.push({
        tool: 'scoreProfileFit',
        reason: 'Evaluating specific candidate fit for role',
        confidence: 0.85,
        inputs: { profileId, roleId }
      });
    }
  }

  // If we have a conversation summary, use it to guide recommendations
  if (context.summary) {
    recommendations.push({
      tool: 'handleChatInteraction',
      reason: 'Using conversation summary to provide contextual guidance',
      confidence: 0.8,
      inputs: {
        summary: context.summary,
        mode,
        profileId,
        roleId
      }
    });
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
      : mode === 'hiring' 
        ? AVAILABLE_ACTIONS.HIRING_MODE 
        : AVAILABLE_ACTIONS.GENERAL_MODE;

    // Get recommendations from AI
    const recommendations = await getAIRecommendations(context, availableActions);

    // Log the planner's recommendations
    await logAgentAction(supabase, {
      entityType: mode === 'candidate' ? 'profile' : mode === 'hiring' ? 'role' : 'general',
      entityId: mode === 'candidate' ? context.profileId! : mode === 'hiring' ? context.roleId! : undefined,
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