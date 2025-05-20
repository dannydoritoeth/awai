import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js';
import type { Database } from '../../database.types.ts';
import { generateEmbedding } from '../semanticSearch.ts';
import { getConversationContextV2, ConversationContextV2 } from '../context/getConversationContext.ts';
import { invokeChatModel } from '../ai/invokeAIModel.ts';
import { ActionV2Registry } from './actions/actionRegistry.ts';
import { 
  MCPRequestV2, 
  MCPResponseV2, 
  ToolMetadataV2, 
  PlannedActionV2, 
  ActionResultV2 
} from './types/action.ts';

interface DependenciesV2 {
  generateEmbedding: typeof generateEmbedding;
  getConversationContext: typeof getConversationContextV2;
  invokeChatModel: typeof invokeChatModel;
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

  constructor(supabase: SupabaseClient<Database>, request: MCPRequestV2, deps: Partial<DependenciesV2> = {}) {
    this.supabase = supabase;
    this.request = request;
    this.context = request.context || {};
    this.intermediateResults = [];
    this.plan = [];
    this.deps = {
      generateEmbedding,
      getConversationContext: getConversationContextV2,
      invokeChatModel,
      ...deps
    };
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

    // Initialize base context with request-specific fields
    this.context = {
      ...this.context,
      embeddedMessage,
      mode: this.request.mode,
      messages: this.request.messages || [],
      latestMessage,
      // Add request-specific fields
      profileId: this.request.profileId,
      roleId: this.request.roleId,
      // Preserve any existing context fields
      ...(this.request.context || {})
    };

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
    const plannerPrompt = `You are a structured planning agent. Your task is to solve the user's query by selecting and sequencing appropriate tools from the list below. 

Follow this process:
1. Read the context carefully to understand what has already been done and what the user wants.
2. Select 1–5 tools that will help solve the user's request.
3. Order the tools logically, ensuring each step has the required inputs.
4. Output your answer as a JSON array only.

IMPORTANT: Respond with ONLY the JSON array. Do not include any markdown formatting, backticks, or explanatory text.

Each tool call must follow this format:
[
  { "tool": "tool_id", "args": { key: value } },
  { "tool": "tool_id", "args": { key: value } }
]

If any required argument is unknown, skip that tool.

Here is the current user context:
${JSON.stringify(this.context, null, 2)}

Available tools:
${JSON.stringify(tools.map(t => ({
  id: t.name,
  description: t.description,
  args: t.argsSchema
})), null, 2)}`;

    // Get AI plan
    const aiResponse = await this.deps.invokeChatModel({
      system: plannerPrompt,
      user: '',
      messages: [{
        role: 'system',
        content: plannerPrompt
      }]
    }, {
      model: 'openai:gpt-3.5-turbo',
      temperature: 0.2,
      max_tokens: 1000,
      supabase: this.supabase,
      entityType: this.context.profileId ? 'profile' : 
                 this.context.roleId ? 'role' : 
                 this.context.sessionId ? 'chat' : undefined,
      entityId: this.context.profileId || 
                this.context.roleId || 
                this.context.sessionId
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
        if (!action.tool || !action.args) {
          throw new Error('Each action must have tool and args properties');
        }
        if (!tools.find(t => t.name === action.tool)) {
          throw new Error(`Unknown tool: ${action.tool}`);
        }
        return action as PlannedActionV2;
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
    for (const action of this.plan) {
      try {
        // Validate action before execution
        await this.validateAction(action);

        const tool = ActionV2Registry.getTool(action.tool);
        if (!tool) {
          throw new Error(`Tool not found: ${action.tool}`);
        }

        // Log detailed execution context
        console.log(`Executing tool ${action.tool} with:`, {
          args: action.args,
          contextKeys: Object.keys(this.context),
          contextValues: {
            profileId: this.context.profileId,
            roleId: this.context.roleId,
            mode: this.context.mode,
            // Add other relevant context values
          },
          toolRequirements: {
            requiredContext: tool.requiredContext || [],
            hasArgsSchema: !!tool.argsSchema
          }
        });

        // Include supabase client in the execution context
        const executionContext = {
          ...this.context,
          supabase: this.supabase
        };

        const result = await tool.run({
          context: executionContext,
          args: action.args
        });

        // Log successful execution
        console.log(`Tool ${action.tool} executed successfully:`, {
          inputArgs: action.args,
          resultKeys: result ? Object.keys(result) : [],
          success: true
        });

        // Store result
        this.intermediateResults.push({
          tool: action.tool,
          input: action.args,
          output: result,
          success: true
        });

        // Update context with result
        this.context[action.tool] = result;

      } catch (error) {
        console.error(`Action ${action.tool} failed:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          args: action.args,
          contextKeys: Object.keys(this.context),
          contextValues: {
            profileId: this.context.profileId,
            roleId: this.context.roleId,
            mode: this.context.mode
          }
        });
        
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
    const tool = ActionV2Registry.getTool(action.tool);
    if (!tool) {
      throw new Error(`Tool not found: ${action.tool}`);
    }

    if (tool.argsSchema) {
      const parseResult = tool.argsSchema.safeParse(action.args);
      if (!parseResult.success) {
        throw new Error(`Invalid arguments for ${action.tool}: ${JSON.stringify(parseResult.error.issues)}`);
      }
    }

    // Validate required context is available
    const requiredContext = tool.requiredContext || [];
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
