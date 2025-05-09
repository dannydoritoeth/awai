import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../database.types.ts';
import { ChatMessage, ChatSender, ConversationSession, ChatError } from './chatTypes.ts';
import { logAgentAction } from './agent/logAgentAction.ts';
import { MCPMode, SemanticMatch } from './mcpTypes.ts';

// Type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/**
 * Start a new chat session
 */
export async function startChatSession(
  supabaseClient: SupabaseClient,
  mode: 'candidate' | 'hiring' | 'general',
  entityId?: string
) {
  try {
    const { data, error } = await supabaseClient
      .from('conversation_sessions')
      .insert({
        mode,
        entity_id: entityId || null,
        status: 'active'
      })
      .select('id')
      .single();

    if (error) throw error;

    return {
      sessionId: data.id,
      error: null
    };
  } catch (error) {
    console.error('Error starting chat session:', error);
    return {
      sessionId: null,
      error
    };
  }
}

/**
 * Post a user message to a chat session
 */
export async function postUserMessage(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  message: string
): Promise<{ messageId: string; error?: ChatError }> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'user',
        message
      })
      .select('id')
      .single();

    if (error) throw error;
    return { messageId: data.id };
  } catch (error) {
    return {
      messageId: '',
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to post user message',
        details: error
      }
    };
  }
}

/**
 * Log an agent response to a chat session
 */
export async function logAgentResponse(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  message: string,
  actionType?: string,
  toolCall?: Record<string, any>,
  responseData?: Record<string, any>
): Promise<{ messageId: string; error?: ChatError }> {
  try {
    // Log the message
    const { data: messageData, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'assistant',
        message,
        tool_call: toolCall,
        response_data: responseData
      })
      .select('id')
      .single();

    if (messageError) throw messageError;

    // If there's an action type, log it to agent_actions
    if (actionType) {
      const { data: session } = await supabase
        .from('conversation_sessions')
        .select('profile_id')
        .eq('id', sessionId)
        .single();

      if (session) {
        await logAgentAction(supabase, {
          entityType: 'profile',
          entityId: session.profile_id,
          payload: {
            type: actionType,
            message,
            toolCall,
            responseData
          }
        });
      }
    }

    return { messageId: messageData.id };
  } catch (error) {
    return {
      messageId: '',
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to log agent response',
        details: error
      }
    };
  }
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<{ history: { session: ConversationSession | null; messages: ChatMessage[] }; error?: ChatError }> {
  try {
    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (messagesError) throw messagesError;

    return {
      history: {
        session: {
          id: session.id,
          profileId: session.profile_id,
          mode: session.mode,
          entityId: session.entity_id,
          status: session.status,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          summary: session.summary
        },
        messages: messages.map(msg => ({
          id: msg.id,
          sessionId: msg.session_id,
          sender: msg.sender as ChatSender,
          message: msg.message,
          toolCall: msg.tool_call,
          responseData: msg.response_data,
          timestamp: msg.timestamp
        }))
      }
    };
  } catch (error) {
    return {
      history: { session: null, messages: [] },
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to get chat history',
        details: error
      }
    };
  }
}

interface ChatInteractionContext {
  mode: MCPMode;
  profileId?: string;
  roleId?: string;
  actionsTaken: Array<{
    tool: string;
    reason: string;
    result: any;
  }>;
  // Extended context for candidate loop results
  candidateContext?: {
    matches: SemanticMatch[];
    recommendations: Array<{
      type: string;
      score: number;
      semanticScore?: number;
      summary: string;
      details: any;
    }>;
    nextActions?: string[];
    gaps?: {
      capabilities?: Array<{ name: string; gapType: 'missing' | 'insufficient' }>;
      skills?: Array<{ name: string; gapType: 'missing' | 'insufficient' }>;
    };
  };
}

/**
 * Generate a user-friendly response based on candidate context
 */
async function generateCandidateResponse(
  message: string,
  context: ChatInteractionContext
): Promise<{ response: string; followUpQuestion?: string }> {
  try {
    const candidateContext = context.candidateContext;
    if (!candidateContext) {
      return { response: 'I processed your request but no specific recommendations were found.' };
    }

    // Get top matches and recommendations
    const topMatches = candidateContext.matches.slice(0, 3);
    const topRecommendations = candidateContext.recommendations.slice(0, 3);

    // Prepare data for ChatGPT analysis
    const matchData = topMatches.map(match => {
      const recommendation = topRecommendations.find(r => 
        r.details?.roleId === match.id || 
        r.details?.jobId === match.id
      );
      return {
        title: match.name,
        similarity: match.similarity,
        summary: match.summary,
        details: recommendation?.summary || '',
        score: recommendation?.score || 0
      };
    });

    // Collect all skills and capabilities
    const allSkills = new Set<string>();
    const allCapabilities = new Set<string>();
    
    topRecommendations.forEach(rec => {
      if (!rec.summary) return;
      
      const skillMatch = rec.summary.match(/Strong match in skills: ([^.]+)/);
      if (skillMatch) {
        skillMatch[1].split(', ').forEach(s => allSkills.add(s.trim()));
      }
      
      const skillGaps = rec.summary.match(/Skill gaps: ([^.]+)/);
      if (skillGaps) {
        skillGaps[1].split(', ').forEach(s => {
          const skill = s.replace(/\s*\([^)]*\)/, '').trim();
          allSkills.add(skill);
        });
      }
      
      const capabilityGaps = rec.summary.match(/Capability gaps: ([^.]+)/);
      if (capabilityGaps) {
        capabilityGaps[1].split(', ').forEach(c => {
          const capability = c.replace(/\s*\([^)]*\)/, '').trim();
          allCapabilities.add(capability);
        });
      }
    });

    // Prepare the prompt for ChatGPT
    const prompt = `As an AI career advisor, analyze these job opportunities and provide personalized advice.

Available Roles:
${matchData.map(match => `
- ${match.title}
  Match Score: ${(match.score * 100).toFixed(1)}%
  Similarity: ${(match.similarity * 100).toFixed(1)}%
  Details: ${match.details}`).join('\n')}

Skills identified:
${Array.from(allSkills).map(skill => `- ${skill}`).join('\n')}

Capabilities needed:
${Array.from(allCapabilities).map(cap => `- ${cap}`).join('\n')}

User's message: ${message}

Please provide:
1. A brief overview of how these roles align with the candidate's profile
2. Specific insights about each role's requirements and opportunities
3. Practical advice on how to prepare for these roles
4. Suggested next steps for the candidate

Keep the tone conversational and focus on actionable insights rather than technical scores.
Ensure the response is detailed and insightful, highlighting specific aspects of each role.
If there are skill or capability gaps, provide specific suggestions for addressing them.`;

    // Call ChatGPT API
    const response = await callChatGPT(prompt);

    // Generate a contextual follow-up question based on the response
    const followUpQuestion = await generateFollowUpQuestion(response, context);

    return {
      response,
      followUpQuestion
    };
  } catch (error) {
    console.error('Error generating candidate response:', error);
    return { 
      response: 'I encountered an error while processing the results. Please try again or contact support if the issue persists.',
      followUpQuestion: 'Would you like to try a different approach to exploring job opportunities?' 
    };
  }
}

/**
 * Call ChatGPT API with the given prompt
 */
async function callChatGPT(prompt: string): Promise<string> {
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an AI career advisor providing detailed, personalized job recommendations and career advice. Focus on actionable insights and practical steps.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling ChatGPT:', error);
    throw error;
  }
}

/**
 * Generate a contextual follow-up question based on the response
 */
async function generateFollowUpQuestion(response: string, context: ChatInteractionContext): Promise<string> {
  try {
    const prompt = `Based on this career advice response:

${response}

Generate a single, specific follow-up question that would help the candidate get more detailed information about one of the recommended roles or suggested next steps. The question should be contextual and focused on practical career development.

Response format: Just the question, no additional text.`;

    const followUp = await callChatGPT(prompt);
    return followUp.trim();
  } catch (error) {
    console.error('Error generating follow-up question:', error);
    return 'Would you like to know more about any of these roles or get specific advice about skill development?';
  }
}

/**
 * Handle chat interactions in the MCP context
 */
export async function handleChatInteraction(
  supabase: SupabaseClient<Database>,
  sessionId: string | undefined,
  message: string,
  context: ChatInteractionContext
): Promise<{ response: string; followUpQuestion?: string }> {
  try {
    // Generate response based on context
    const { response, followUpQuestion } = await generateCandidateResponse(message, context);

    // Combine response with follow-up if available
    const fullResponse = followUpQuestion 
      ? `${response}\n\n${followUpQuestion}`
      : response;

    // Always log to agent_actions
    if (context.mode !== 'general' && (context.profileId || context.roleId)) {
      await logAgentAction(supabase, {
        entityType: context.profileId ? 'profile' : 'role',
        entityId: context.profileId || context.roleId || '',
        payload: {
          stage: 'final_response',
          message: fullResponse,
          actionsTaken: context.actionsTaken,
          candidateContext: context.candidateContext
        }
      });
    }

    // Only log to chat if session ID exists
    if (sessionId) {
      // Log the user message first
      await postUserMessage(supabase, sessionId, message);

      // Then log the agent's response
      await logAgentResponse(
        supabase,
        sessionId,
        fullResponse,
        'mcp_chat_interaction',
        {
          mode: context.mode,
          profileId: context.profileId,
          roleId: context.roleId
        },
        { 
          actionsTaken: context.actionsTaken,
          candidateContext: context.candidateContext
        }
      );
    }

    // Return the response and follow-up separately
    return { response, followUpQuestion };

  } catch (error) {
    console.error('Error in handleChatInteraction:', error);
    throw error;
  }
}

/**
 * Log a progress update to both agent actions and optionally to chat
 */
export async function logProgress(
  supabase: SupabaseClient<Database>,
  params: {
    entityType: 'profile' | 'role' | 'job';
    entityId?: string;
    stage: 'planning' | 'analysis' | 'scoring' | 'error' | 'summary';
    message: string;
    sessionId?: string;
    payload?: Record<string, any>;
  }
): Promise<void> {
  try {
    // Only log to agent_actions if we have an entityId
    if (params.entityId) {
      await logAgentAction(supabase, {
        entityType: params.entityType,
        entityId: params.entityId,
        payload: {
          stage: params.stage,
          message: params.message,
          ...params.payload
        }
      });
    }

    // If session ID provided, also log to chat
    if (params.sessionId) {
      await logAgentResponse(
        supabase,
        params.sessionId,
        params.message,
        `mcp_${params.stage}`,
        { stage: params.stage },
        params.payload
      );
    }
  } catch (error) {
    console.error('Error logging progress:', error);
    // Don't throw - logging failures shouldn't break the main flow
  }
}

/**
 * Get predefined progress messages for common stages
 */
export function getProgressMessage(
  stage: 'planning' | 'analysis' | 'scoring' | 'error' | 'summary',
  context: {
    matchCount?: number;
    errorType?: string;
    fallbackUsed?: boolean;
  } = {}
): string {
  switch (stage) {
    case 'planning':
      return "I'm analyzing your profile to find the best opportunities...";
    
    case 'analysis':
      return "Evaluating your experience and skills against current openings...";
    
    case 'scoring':
      if (context.matchCount === 0) {
        return "I've completed the analysis but didn't find any strong matches. Let me explain why and suggest some alternatives.";
      }
      return `I've found ${context.matchCount} ${context.matchCount === 1 ? 'role that matches' : 'roles that match'} your profile. Let me show you why.`;
    
    case 'error':
      if (context.fallbackUsed) {
        return "Some data is missing from your profile, so I used alternative methods to make suggestions.";
      }
      return "I encountered some issues while analyzing your profile. I'll do my best to provide recommendations with the available information.";
    
    case 'summary':
      return "Here's a summary of what I found...";
    
    default:
      return "Processing your request...";
  }
} 