import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js';
import type { Database } from '../../database.types.ts';
import { generateEmbedding } from '../semanticSearch.ts';
import { getConversationContextV2, ConversationContextV2 } from '../context/getConversationContext.ts';
import { invokeChatModel } from '../ai/invokeAIModel.ts';
import { invokeChatModelV2, type ChatPrompt, type AIResponse } from '../ai/invokeAIModelV2.ts';
import { ActionV2Registry } from './actions/actionRegistry.ts';
import { createHash } from 'https://deno.land/std@0.110.0/hash/mod.ts';
import { 
  MCPRequestV2, 
  MCPResponseV2, 
  ToolMetadataV2, 
  PlannedActionV2, 
  ActionResultV2 
} from './types/action.ts';
import { formatToolMetadataAsCSV } from './utils/formatters.ts';
import { logAgentProgress } from '../chatUtils.ts';

interface DependenciesV2 {
  generateEmbedding: typeof generateEmbedding;
  getConversationContext: typeof getConversationContextV2;
  invokeChatModel: typeof invokeChatModel;
  invokeChatModelV2: (prompt: ChatPrompt, options: any) => Promise<AIResponse>;
}

/**
 * Generates a deterministic hash for request deduplication
 */
function generateRequestHash(request: Record<string, any>): string {
  const ordered = Object.keys(request)
    .sort()
    .reduce((acc: Record<string, any>, key) => {
      acc[key] = request[key];
      return acc;
    }, {});
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}

/**
 * Checks if a cached result is still valid
 */
function isResultStillValid(result: any): boolean {
  // Add any validation logic here (e.g., time-based expiry)
  return true;
}

/**
 * MCP Loop V2 Runner
 * Implements a more dynamic action processing loop with better context management
 */
export class McpLoopRunner {
  private supabase: SupabaseClient<Database>;
  private request: MCPRequestV2;
  private context: Record<string, any>;
  private intermediateResults: ActionResultV2[];
  private plan: PlannedActionV2[];
  private summaryMessage?: string;
  private deps: DependenciesV2;
  private stepIndex: number;

  constructor(supabase: SupabaseClient<Database>, request: MCPRequestV2, deps: Partial<DependenciesV2> = {}) {
    this.supabase = supabase;
    this.request = request;
    this.context = request.context || {};
    this.intermediateResults = [];
    this.plan = [];
    this.stepIndex = 0;
    this.deps = {
      generateEmbedding,
      getConversationContext: getConversationContextV2,
      invokeChatModel,
      invokeChatModelV2,
      ...deps
    };
  }

  /**
   * Logs an MCP step to agent_actions with deduplication support
   */
  private async logMcpStep(action: PlannedActionV2, result: any, requestHash: string): Promise<void> {
    try {
      const { data: embedding } = await this.deps.generateEmbedding(
        `${action.tool} ${JSON.stringify(action.args)}`
      );

      await this.supabase.from('agent_actions').insert({
        agent_name: 'mcp_v2',
        action_type: action.tool,
        target_type: this.context.profileId ? 'profile' : 
                    this.context.roleId ? 'role' : 
                    this.context.sessionId ? 'chat' : undefined,
        target_id: this.context.profileId || 
                  this.context.roleId || 
                  this.context.sessionId,
        request: action.args,
        request_hash: requestHash,
        response: result,
        outcome: result.success ? 'success' : 'error',
        confidence_score: result.confidence || null,
        session_id: this.request.sessionId,
        step_index: this.stepIndex++,
        embedding
      });
    } catch (error) {
      console.error('Failed to log MCP step:', error);
    }
  }

  /**
   * Checks for existing action results that match the current request
   */
  private async findExistingActionResult(
    action: PlannedActionV2,
    requestHash: string
  ): Promise<ActionResultV2 | null> {
    if (!this.request.sessionId) return null;

    console.log('Finding existing action result for:', {
      session_id: this.request.sessionId,
      action_type: action.tool,
      request_hash: requestHash
    });

    const { data } = await this.supabase
      .from('agent_actions')
      .select('response, outcome, request_hash')
      .match({
        session_id: this.request.sessionId,
        action_type: action.tool
      })
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Don't rehydrate if there's no data
    if (!data?.response) return null;

    // Check if request hash matches
    if (data.request_hash) {
      try {
        // Parse the stored hash if it's a JSON string
        const storedHash = typeof data.request_hash === 'string' ? JSON.parse(data.request_hash) : data.request_hash;
        
        // Convert current hash to array if it's Uint8Array
        const currentHashArray = Array.from(requestHash);
        
        // Convert stored hash object to array if needed
        const storedHashArray = Array.isArray(storedHash) ? storedHash : Object.values(storedHash);
        
        // Compare the arrays
        const hashesMatch = storedHashArray.length === currentHashArray.length &&
          storedHashArray.every((value, index) => value === currentHashArray[index]);
        
        if (!hashesMatch) {
          console.log(`Request hash mismatch for ${action.tool}:`, {
            stored: storedHashArray,
            current: currentHashArray
          });
          return null;
        }
      } catch (error) {
        console.error(`Error comparing request hashes for ${action.tool}:`, error);
        return null;
      }
    }

    // Don't rehydrate failed responses
    if (
      data.outcome === 'error' || 
      data.response.success === false ||
      data.response.error
    ) {
      console.log(`Skipping rehydration of failed result for ${action.tool}:`, {
        outcome: data.outcome,
        error: data.response.error
      });
      return null;
    }

    // Validate the response has required fields
    if (!this.isValidActionResult(data.response)) {
      console.log(`Invalid cached result for ${action.tool}, will re-execute`);
      return null;
    }

    return data.response;
  }

  /**
   * Validates that a cached result has the required fields and structure
   */
  private isValidActionResult(response: any): boolean {
    // Basic structure check
    if (!response || typeof response !== 'object') return false;

    // Must have success flag
    if (typeof response.success !== 'boolean') return false;

    // If success is true, must have data
    if (response.success && !response.data) return false;

    // If success is false, must have error info
    if (!response.success && !response.error) return false;

    return true;
  }

  /**
   * Main entry point for running the MCP loop
   */
  public async run(): Promise<MCPResponseV2> {
    try {
      // Step 1: Load Context
      await this.loadContext();

      // Step 2: Plan
      await this.planActions();

      // Step 3: Execute
      await this.executeActions();

      // Step 4: Finalize
      await this.finalize();

      return {
        success: true,
        data: {
          context: this.context,
          intermediateResults: this.intermediateResults,
          plan: this.plan,
          semanticMatches: this.context.semanticMatches,
          summaryMessage: this.summaryMessage
        }
      };
    } catch (error) {
      console.error('MCP Loop error:', error);
      return {
        success: false,
        error: {
          type: 'MCP_LOOP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        }
      };
    }
  }

  /**
   * Step 1: Context Loader
   * Loads and prepares the context for action processing
   */
  private async loadContext() {
    // Get the latest message, either from messages array or context
    let latestMessage = this.request.messages?.[this.request.messages.length - 1]?.content;
    if (!latestMessage && this.request.context?.lastMessage) {
      latestMessage = this.request.context.lastMessage;
    }
    if (!latestMessage) {
      throw new Error("No message content provided in either messages array or context");
    }

    // Generate embedding for the latest message
    const embeddedMessage = await this.deps.generateEmbedding(latestMessage);

    // Normalize context fields and handle common typos
    const normalizedContext = {
      ...(this.request.context || {}),
      // Fix common typos and ensure proper field mapping
      roleId: this.request.roleId || 
             this.request.context?.roleId || 
             this.request.context?.role_id,
      profileId: this.request.profileId || 
                this.request.context?.profileId || 
                this.request.context?.profile_id
    };

    // Initialize base context with request-specific fields
    this.context = {
      ...normalizedContext,
      embeddedMessage,
      mode: this.request.mode,
      messages: this.request.messages || [],
      latestMessage,
      sessionId: this.request.sessionId
    };

    // Log normalized context for debugging
    console.log('Normalized context:', {
      roleId: this.context.roleId,
      profileId: this.context.profileId,
      mode: this.context.mode,
      messageCount: this.context.messages.length
    });

    // Only load conversation context if session ID is provided
    if (this.request.sessionId) {
      console.log('Loading conversation context for session:', this.request.sessionId);
      try {
        const conversationContext = await this.deps.getConversationContext(
          this.supabase,
          this.request.sessionId,
          {
            messageLimit: 10,
            actionLimit: 5,
            embeddingAverageCount: 3
          }
        );

        // Update context with conversation history
        this.context = {
          ...this.context,
          recentMessages: conversationContext.history || [],
          agentActions: conversationContext.agentActions || [],
          summary: conversationContext.summary,
          contextEmbedding: conversationContext.contextEmbedding,
          sessionId: this.request.sessionId
        };

        // Log context loading with history
        console.log('Context loaded with history:', {
          sessionId: this.request.sessionId,
          mode: this.request.mode,
          messageCount: this.request.messages?.length || 0,
          historyCount: conversationContext.history?.length || 0,
          actionsCount: conversationContext.agentActions?.length || 0
        });
      } catch (error) {
        console.warn('Failed to load conversation context:', error);
        // Continue without conversation context
      }
    } else {
      // Log context loading without history
      console.log('Context loaded without session history:', {
        mode: this.request.mode,
        messageCount: this.request.messages?.length || 0,
        profileId: this.context.profileId,
        roleId: this.context.roleId
      });
    }
  }

  /**
   * Step 2: Planner
   * Uses AI to plan a sequence of actions based on the context
   */
  private async planActions() {
    // Gather Available Tools
    const tools: ToolMetadataV2[] = ActionV2Registry.getToolMetadataList();

    // Construct Planner Prompt
    const systemPrompt = `You are a structured planning agent. Your task is to solve the user's query by selecting and sequencing appropriate tools from the list below.

    Follow this process:
    1. Read the context to understand what the user wants and what actions have already been taken.
    2. Select up to 3 tools that help solve the user's request.
    3. Ensure you only call a tool if all of its "requiredInputs" are available AND all tools in its "recommendedAfter" list have either already been run or are being included in this same list.
    4. Output your answer as a JSON array ONLY. Do not include markdown, backticks, or extra text.
    
    Each tool call must follow this format:
    [
      {
        "tool": "tool_id",
        "args": { key: value },
        "reason": "why this tool helps the user",
        "announcement": "what to tell the user when this tool runs"
      }
    ]
    
    🧠 Example:
    To run getDevelopmentPlan, you must also run getCapabilityGaps and getSemanticSkillRecommendations if they haven't already been completed.
    
    🚫 If a required input is unknown or a dependency has not been satisfied, SKIP the tool.
       
    Available tools (in CSV format):
    ${formatToolMetadataAsCSV(tools)}
    `;

    const userPrompt = `
    This is the request context from the user:
    - action: ${this.request.action || 'N/A'}
    - sessionId: ${this.request.sessionId || 'N/A'}
    - message: ${this.request.messages?.[this.request.messages.length - 1]?.content || this.context.latestMessage || 'N/A'}
    - profileId: ${this.request.profileId || this.context.profileId || 'N/A'}
    - roleId: ${this.request.roleId || this.context.roleId || 'N/A'}
    - roleTitle: ${this.context.roleTitle || 'N/A'}
    - actionId: ${this.context.actionId || 'N/A'}
    - mode: ${this.request.mode || 'N/A'}
    `;

    // Get AI plan
    const aiResponse = await this.deps.invokeChatModelV2({
      system: systemPrompt,
      user: userPrompt
    }, {
      model: 'openai:gpt-3.5-turbo',
      temperature: 0.2,
      max_tokens: 1000,
      supabase: this.supabase,
      sessionId: this.context.sessionId || 'default',
      actionType: 'mcp-loop'
    });

    if (!aiResponse.success || !aiResponse.output) {
      throw new Error(`AI planning failed: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    // Parse and validate plan
    try {
      const plan = JSON.parse(aiResponse.output);
      if (!Array.isArray(plan)) {
        throw new Error('Plan must be an array');
      }

      // Validate each action
      this.plan = plan.map((action: any) => {
        if (!action.tool) {
          throw new Error('Each action must have a tool property');
        }

        const loadedTool = ActionV2Registry.loadToolWithArgs(action.tool, this.context, action.args);
        if (!loadedTool) {
          throw new Error(`Unknown tool: ${action.tool}`);
        }

        return {
          tool: action.tool,
          args: loadedTool.args
        } as PlannedActionV2;
      });

      // Log plan
      console.log('Action plan created:', {
        actionCount: this.plan.length,
        actions: this.plan.map(a => a.tool)
      });

    } catch (error) {
      console.error('Error parsing plan:', error);
      throw new Error('Failed to create valid action plan');
    }
  }

  /**
   * Step 3: Execute
   * Executes each planned action in sequence, updating context with results
   */
  private async executeActions() {
    // Initialize downstream data context if not exists
    if (!this.context.downstreamData) {
      this.context.downstreamData = {};
    }

    for (const action of this.plan) {
      try {
        // Log the announcement from the planner if it exists and we have a session ID
        if (action.announcement && this.request.sessionId) {
          await logAgentProgress(
            this.supabase,
            this.request.sessionId,
            action.announcement,
            { phase: 'tool_announcement', tool: action.tool }
          );
        }

        // Validate action before execution
        await this.validateAction(action);

        const loadedTool = ActionV2Registry.loadToolWithArgs(action.tool, this.context, action.args);
        if (!loadedTool) {
          throw new Error(`Tool not found: ${action.tool}`);
        }

        // Generate request hash for deduplication
        const requestHash = generateRequestHash(loadedTool.args);

        // Check for existing results
        const existingResult = await this.findExistingActionResult(action, requestHash);
        if (existingResult && isResultStillValid(existingResult)) {
          console.log(`Reusing cached result for ${action.tool}`);
          
          // Store both result and downstream data in context
          this.context[action.tool] = existingResult;
          if (existingResult.dataForDownstreamPrompt) {
            this.context.downstreamData = {
              ...this.context.downstreamData,
              ...existingResult.dataForDownstreamPrompt
            };
          }

          this.intermediateResults.push({
            tool: action.tool,
            input: loadedTool.args,
            output: existingResult,
            success: true,
            reused: true
          });
          continue;
        }

        // Include supabase client in the execution context
        const executionContext = {
          ...this.context,
          supabase: this.supabase
        };

        const result = await loadedTool.tool.run({
          context: executionContext,
          args: loadedTool.args
        });

        // Log action and result
        await this.logMcpStep(action, result, requestHash);

        // Store both result and downstream data in context
        this.context[action.tool] = result;
        if (result.dataForDownstreamPrompt) {
          this.context.downstreamData = {
            ...this.context.downstreamData,
            ...result.dataForDownstreamPrompt
          };
        }

        // Store result
        this.intermediateResults.push({
          tool: action.tool,
          input: loadedTool.args,
          output: result,
          success: true
        });

      } catch (error) {
        console.error(`Action ${action.tool} failed:`, error);
        
        // Only log error to chat if it wasn't already logged by the action
        // We can check this by looking at the error object
        const errorWasLogged = error instanceof Error && (error as any).wasLogged;
        
        if (this.request.sessionId && !errorWasLogged) {
          await logAgentProgress(
            this.supabase,
            this.request.sessionId,
            `I encountered an error while ${action.tool}. Let me know if you'd like to try again.`,
            { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
          );
        }
        
        this.intermediateResults.push({
          tool: action.tool,
          input: action.args,
          output: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log execution summary
    console.log('Actions executed:', {
      total: this.plan.length,
      successful: this.intermediateResults.filter(r => r.success).length,
      failed: this.intermediateResults.filter(r => !r.success).length,
      results: this.intermediateResults.map(r => ({
        tool: r.tool,
        success: r.success,
        error: r.error
      }))
    });
  }

  /**
   * Validates an action's arguments against its schema
   */
  private async validateAction(action: PlannedActionV2): Promise<void> {
    const loadedTool = ActionV2Registry.loadToolWithArgs(action.tool, this.context, action.args);
    if (!loadedTool) {
      throw new Error(`Tool not found: ${action.tool}`);
    }

    if (loadedTool.tool.argsSchema) {
      const parseResult = loadedTool.tool.argsSchema.safeParse(loadedTool.args);
      if (!parseResult.success) {
        throw new Error(`Invalid arguments for ${action.tool}: ${JSON.stringify(parseResult.error.issues)}`);
      }
    }

    // Validate required context is available
    const requiredContext = loadedTool.tool.requiredContext || [];
    for (const key of requiredContext) {
      if (!(key in this.context)) {
        throw new Error(`Missing required context for ${action.tool}: ${key}`);
      }
    }
  }

  /**
   * Step 4: Finalize
   * Optionally generates a summary of the actions and results
   */
  private async finalize() {
    // Check if finalize_summary tool is available and was used in the plan
    const tools: ToolMetadataV2[] = ActionV2Registry.getToolMetadataList();
    const finalizeTool = tools.find(t => t.name === 'finalize_summary');

    if (finalizeTool && this.plan.some(p => p.tool === 'finalize_summary')) {
      try {
        // Generate summary using the finalize_summary tool
        const summary = await finalizeTool.run({
          context: {
            ...this.context,
            intermediateResults: this.intermediateResults,
            plan: this.plan
          },
          args: {}
        });

        this.summaryMessage = typeof summary === 'string' ? summary : JSON.stringify(summary);

        // Log summary generation
        console.log('Generated summary:', {
          length: this.summaryMessage.length,
          success: true
        });

      } catch (error) {
        console.error('Failed to generate summary:', error);
        // Don't throw error, just continue without summary
      }
    }

    // Log final state
    console.log('MCP Loop completed:', {
      actionsExecuted: this.intermediateResults.length,
      hasSummary: !!this.summaryMessage,
      contextKeys: Object.keys(this.context)
    });
  }
}
