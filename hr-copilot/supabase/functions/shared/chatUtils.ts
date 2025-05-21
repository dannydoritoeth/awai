import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../database.types.ts';
import { ChatMessage, ChatSender, ConversationSession, ChatError } from './chatTypes.ts';
import { logAgentAction } from './agent/logAgentAction.ts';
import { MCPMode, SemanticMatch } from './mcpTypes.ts';
import { generateEmbedding } from './semanticSearch.ts';

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
  mode: 'candidate' | 'hiring' | 'general' | 'analyst',
  entityId?: string,
  browserSessionId?: string,
  initialMessage?: string,
  insightId?: string,
  scope?: string,
  companyIds?: string[]
) {
  try {
    // Get the summary based on mode
    let summary: string | null = null;

    if (mode === 'hiring' && entityId) {
      // Get role name
      const { data: role } = await supabaseClient
        .from('roles')
        .select('title')
        .eq('id', entityId)
        .single();
      summary = role?.title || null;
    } else if (mode === 'candidate' && entityId) {
      // Get profile name
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('name')
        .eq('id', entityId)
        .single();
      summary = profile?.name || null;
    } else if (mode === 'analyst' && insightId) {
      // For analyst mode, use the predefined insight title
      const insights = {
        generateCapabilityHeatmapByTaxonomy: 'Capability Heatmap by Taxonomy Group',
        generateCapabilityHeatmapByDivision: 'Capability Heatmap by Division',
        generateCapabilityHeatmapByRegion: 'Capability Heatmap by Region',
        generateCapabilityHeatmapByCompany: 'Organization-wide Capability Heatmap'
      };
      summary = insights[insightId as keyof typeof insights] || null;
    } else if (mode === 'general' && initialMessage) {
      // For general mode, use the first 50 characters of the message
      summary = initialMessage.length > 50 ? `${initialMessage.substring(0, 47)}...` : initialMessage;
    }

    // Create the session with summary
    const { data, error } = await supabaseClient
      .from('conversation_sessions')
      .insert({
        mode,
        entity_id: mode === 'general' ? null : entityId,
        browser_session_id: browserSessionId,
        status: 'active',
        summary
      })
      .select('id')
      .single();

    if (error) throw error;

    return {
      data,
      error: null
    };
  } catch (error) {
    console.error('Error starting chat session:', error);
    return {
      data: null,
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
  message: string,
  messageId?: string,
  mcpLoopBody?: Record<string, any>
): Promise<{ messageId: string; error?: ChatError }> {
  try {
    // Generate embedding for the message
    const embedding = await generateEmbedding(message);

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        id: messageId, // Use provided messageId if available
        session_id: sessionId,
        sender: 'user',
        message,
        embedding,
        response_data: mcpLoopBody // Store the MCP loop body in response_data
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

// Messages that don't need embeddings (simple status updates or processing steps)
const SKIP_EMBEDDING_MESSAGES = [
  // Status updates
  'Applied response formatting',
  'Retrieved planner recommendations',
  'Retrieved conversation context',
  'Executed candidate mode processing',
  'MCP Processing Step V2',
  'Tool Execution',
  'Processing Step',
  'Loading profile data',
  'Searching for roles',
  'Processing matches',
  'Loading capabilities',
  'Comparing capabilities',
  'Finding mentors',
  'Generating plan',
  'Completed',
  'Error in',
  'Retrieved',
  'Loaded',
  'Found',
  'Processing',
  'Analyzing',
  'Generating',
  
  // Progress indicators
  'Loading...',
  'Searching...',
  'Analyzing...',
  'Processing...',
  'Generating...',
  'Comparing...',
  'Finding...',
  'Retrieving...',
  'Updating...',
  'Calculating...',
  
  // Action states
  'Starting analysis',
  'Completing analysis',
  'Beginning search',
  'Completing search',
  'Starting generation',
  'Completing generation',
  'Starting comparison',
  'Completing comparison',
  
  // Phase markers
  'Phase 1:',
  'Phase 2:',
  'Phase 3:',
  'Phase 4:',
  'Phase 5:',
  'Phase 6:',
  
  // Common action verbs
  'Loading',
  'Searching',
  'Finding',
  'Getting',
  'Retrieving',
  'Processing',
  'Analyzing',
  'Generating',
  'Creating',
  'Updating',
  'Comparing',
  'Calculating',
  'Checking',
  'Validating',
  'Verifying',
  'Preparing',
  'Building',
  'Constructing',
  'Evaluating',
  'Assessing',
  'Reviewing',
  'Examining',
  'Inspecting',
  'Testing',
  'Matching',
  'Mapping',
  'Filtering',
  'Sorting',
  'Ranking',
  'Scoring',
  'Computing',
  'Determining',
  'Identifying',
  'Locating',
  'Fetching',
  'Gathering',
  'Collecting',
  'Compiling',
  'Assembling',
  'Organizing',
  'Structuring',
  'Formatting',
  'Transforming',
  'Converting',
  'Parsing',
  'Extracting',
  'Combining',
  'Merging',
  'Joining',
  'Splitting',
  'Separating',
  'Dividing',
  'Grouping',
  'Categorizing',
  'Classifying',
  'Labeling',
  'Tagging',
  'Marking',
  'Flagging',
  'Highlighting',
  'Emphasizing',
  'Summarizing',
  'Concluding',
  'Finalizing',
  'Completing',
  'Finishing',
  'Ending',
  'Stopping',
  'Halting',
  'Pausing',
  'Resuming',
  'Continuing',
  'Proceeding',
  'Moving',
  'Advancing',
  'Progressing',
  'Developing',
  'Evolving',
  'Growing',
  'Expanding',
  'Extending',
  'Enhancing',
  'Improving',
  'Optimizing',
  'Refining',
  'Polishing',
  'Cleaning',
  'Sanitizing',
  'Validating',
  'Verifying',
  'Confirming',
  'Checking',
  'Testing',
  'Debugging',
  'Fixing',
  'Repairing',
  'Correcting',
  'Adjusting',
  'Modifying',
  'Changing',
  'Updating',
  'Upgrading',
  'Downgrading',
  'Installing',
  'Uninstalling',
  'Configuring',
  'Setting',
  'Resetting',
  'Initializing',
  'Starting',
  'Booting',
  'Launching',
  'Running',
  'Executing',
  'Performing',
  'Conducting',
  'Carrying',
  'Handling',
  'Managing',
  'Controlling',
  'Monitoring',
  'Observing',
  'Watching',
  'Tracking',
  'Following',
  'Leading',
  'Guiding',
  'Directing',
  'Steering',
  'Navigating',
  'Routing',
  'Mapping',
  'Planning',
  'Scheduling',
  'Timing',
  'Measuring',
  'Counting',
  'Calculating',
  'Computing',
  'Processing'
];

/**
 * @deprecated Use logAgentProgress instead. This function will be removed once MCP loop v2 handles all agent action logging.
 */
export async function logAgentResponse(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  message: string,
  actionType?: string,
  toolCall?: Record<string, any>,
  responseData?: Record<string, any>
): Promise<{ messageId: string; error?: ChatError }> {
  console.warn('logAgentResponse is deprecated. Please use logAgentProgress instead.');
  return logAgentProgress(supabase, sessionId, message, toolCall);
}

/**
 * Log a progress update message to the chat session only
 * This is the preferred way to log progress updates from actions since MCP loop v2 handles agent_actions logging
 */
export async function logAgentProgress(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  message: string,
  toolCall?: Record<string, any>
): Promise<{ messageId: string; error?: ChatError }> {
  try {
    console.log('logAgentProgress called with:', { sessionId, message });
    
    // Check if this is a simple status update or processing step
    const shouldSkipEmbedding = SKIP_EMBEDDING_MESSAGES.some(skipMessage => 
      message.includes(skipMessage) || 
      toolCall?.reason?.includes(skipMessage)
    );

    let embedding = null;
    if (!shouldSkipEmbedding) {
      // Generate embedding for the message
      embedding = await generateEmbedding(message);
      console.log('Generated embedding for message');
    }

    // Log the message to chat_messages only
    const { data: messageData, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'assistant',
        message,
        tool_call: toolCall,
        embedding
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('Error inserting chat message:', messageError);
      throw messageError;
    }
    console.log('Successfully inserted chat message with ID:', messageData?.id);

    return { messageId: messageData.id };
  } catch (error) {
    console.error('Full error in logAgentProgress:', error);
    return {
      messageId: '',
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to log agent progress',
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
 * Handle chat interactions in the MCP context
 */
export async function handleChatInteraction(
  supabase: SupabaseClient<Database>,
  sessionId: string | undefined,
  message: string,
  context: ChatInteractionContext
): Promise<{ response: string; followUpQuestion?: string }> {
  try {
    let response: string;
    let followUpQuestion: string | undefined;

    // Log the interaction start
    await logAgentAction(supabase, {
      entityType: context.profileId ? 'profile' : 'role',
      entityId: context.profileId || context.roleId || '',
      payload: {
        stage: 'chat_interaction_start',
        message,
        context
      }
    });

    // Only log to chat if session ID exists
    if (sessionId) {
      // Log the user message first
      await postUserMessage(supabase, sessionId, message);
    }

    // Return the response and follow-up separately
    return { response: "Please use the appropriate MCP loop for responses", followUpQuestion: undefined };

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

/**
 * Create the MCP loop request body
 */
export function createMCPLoopBody(
  mode: 'candidate' | 'hiring' | 'general' | 'analyst',
  sessionId: string,
  message: string,
  entityId?: string,
  insightId?: string,
  scope?: string,
  companyIds?: string[],
  actionData?: {
    actionId: string;
    params: Record<string, any>;
  }
) {
  // Extract all params from actionData if present
  const actionParams = actionData?.params || {};
  
  // Create flattened base context
  const baseContext = {
    lastMessage: message,
    mode,
    chatHistory: [],
    agentActions: [],
    summary: '',
    semanticContext: {
      previousMatches: []
    },
    contextEmbedding: [],
    // Flatten all action params into context
    ...actionParams
  };

  // Create flattened body with all parameters at top level
  const body = {
    mode,
    sessionId,
    ...(mode === 'candidate' ? { profileId: entityId } : {}),
    ...(mode === 'hiring' ? { roleId: entityId } : {}),
    // Flatten all action params at top level
    ...actionParams,
    // Include actionId if present
    ...(actionData?.actionId && { actionId: actionData.actionId }),
    context: baseContext
  };

  // Add analyst-specific fields if in analyst mode
  if (mode === 'analyst') {
    const analystBody = {
      ...body,
      insightId,
      companyIds: companyIds || [entityId],
      context: {
        ...baseContext,
        companyIds: companyIds || [entityId],
        scope: scope || 'division',
        outputFormat: 'action_plan'
      },
      plannerRecommendations: []
    };

    console.log('MCP Loop V2 Request (Analyst):', JSON.stringify(analystBody, null, 2));
    return analystBody;
  }

  console.log('MCP Loop V2 Request:', JSON.stringify(body, null, 2));
  return body;
} 