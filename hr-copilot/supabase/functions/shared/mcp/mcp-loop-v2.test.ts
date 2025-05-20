import { assertEquals, assertExists } from 'https://deno.land/std@0.203.0/testing/asserts.ts';
import { McpLoopRunner } from './mcp-loop-v2.ts';
import { 
  MCPRequestV2, 
  MCPResponseV2, 
  ChatMessageV2 
} from './types/action.ts';
import { setupTestRegistry, getMockTools, getMockPlan } from './actions/testRegistry.ts';
import { ActionV2Registry } from './actions/actionRegistry.ts';

// Mock data
const mockMessage: ChatMessageV2 = {
  id: 'test-message-123',
  content: 'What skills do I need for this role?',
  role: 'user',
  timestamp: new Date().toISOString()
};

const mockRequest: MCPRequestV2 = {
  mode: 'candidate',
  sessionId: 'test-session-123',
  messages: [mockMessage],
  context: {
    lastMessage: mockMessage.content,
    profileId: '123',
    roleId: '456'
  },
  supabase: {} as any // Mock Supabase client
};

// Mock dependencies
const mockDeps = {
  generateEmbedding: async (text: string) => [0.1, 0.2, 0.3], // Mock embedding vector
  getConversationContext: async () => ({
    history: [mockMessage],
    agentActions: [],
    summary: 'Mock conversation summary',
    contextEmbedding: [0.4, 0.5, 0.6] // Mock context embedding
  }),
  invokeChatModel: async () => ({
    success: true,
    output: JSON.stringify(getMockPlan())
  })
};

// Test suite
Deno.test('McpLoopRunner', async (t) => {
  // Clear and setup registry before each test
  ActionV2Registry.clear();
  setupTestRegistry();

  await t.step('initializes with request data', () => {
    const runner = new McpLoopRunner({} as any, mockRequest, mockDeps);
    assertExists(runner);
  });

  await t.step('loads context correctly', async () => {
    const runner = new McpLoopRunner({} as any, mockRequest, mockDeps);
    await runner.run();
    
    // Context should contain the message and embedding
    assertEquals(runner['context'].latestMessage, mockMessage.content);
    assertExists(runner['context'].embeddedMessage);
    assertExists(runner['context'].summary);
    assertEquals(runner['context'].summary, 'Mock conversation summary');
    
    // Context should contain required fields
    assertEquals(runner['context'].profileId, '123');
    assertEquals(runner['context'].roleId, '456');
  });

  await t.step('plans actions using AI', async () => {
    const runner = new McpLoopRunner({} as any, mockRequest, mockDeps);
    await runner.run();

    // Should have planned actions
    assertEquals(runner['plan'], getMockPlan());
  });

  await t.step('executes planned actions in sequence', async () => {
    const runner = new McpLoopRunner({} as any, mockRequest, mockDeps);
    const response = await runner.run();

    // Should have executed all actions
    assertEquals(response.data?.intermediateResults.length, getMockPlan().length);
    
    // All actions should be successful
    assertEquals(
      response.data?.intermediateResults.every(r => r.success),
      true
    );

    // Results should match expected output
    assertEquals(response.data?.context.getCapabilityGaps, { gaps: ['Leadership', 'Project Management'] });
    assertEquals(response.data?.context.getDevelopmentPlan, {
      recommendations: [
        { skill: 'Leadership', actions: ['Take leadership course', 'Lead small team projects'] },
        { skill: 'Project Management', actions: ['Get PM certification', 'Shadow senior PM'] }
      ]
    });
    assertEquals(response.data?.context.getSemanticSkillRecommendations, {
      recommendations: [
        { skill: 'Strategic Planning', relevance: 0.9 },
        { skill: 'Team Leadership', relevance: 0.85 }
      ]
    });

    // Results should be in correct order
    assertEquals(
      response.data?.intermediateResults.map(r => r.tool),
      getMockPlan().map(p => p.tool)
    );
  });

  await t.step('handles action failures gracefully', async () => {
    // Clear registry and register failing tool
    ActionV2Registry.clear();
    const failingTools = [...getMockTools()];
    failingTools[0] = {
      ...failingTools[0],
      run: async () => { throw new Error('Tool failed'); }
    };
    failingTools.forEach(tool => ActionV2Registry.register(tool));

    const runner = new McpLoopRunner({} as any, mockRequest, mockDeps);
    const response = await runner.run();

    // Should still complete
    assertEquals(response.success, true);

    // Should have one failed action
    assertEquals(
      response.data?.intermediateResults.filter(r => !r.success).length,
      1
    );

    // First action should have failed
    assertEquals(response.data?.intermediateResults[0].success, false);
    assertEquals(response.data?.intermediateResults[0].error, 'Tool failed');

    // Other actions should still succeed
    assertEquals(
      response.data?.intermediateResults.slice(1).every(r => r.success),
      true
    );
  });

  await t.step('validates tool arguments if schema is provided', async () => {
    // Clear registry and register tool with failing schema
    ActionV2Registry.clear();
    const toolsWithSchema = [...getMockTools()];
    toolsWithSchema[0] = {
      ...toolsWithSchema[0],
      argsSchema: {
        safeParse: () => ({
          success: false,
          error: { issues: ['Invalid args'] }
        })
      }
    };
    toolsWithSchema.forEach(tool => ActionV2Registry.register(tool));

    const runner = new McpLoopRunner({} as any, mockRequest, mockDeps);
    const response = await runner.run();

    // Should have failed validation
    assertEquals(
      response.data?.intermediateResults[0].success,
      false
    );
    assertExists(response.data?.intermediateResults[0].error);
    assertEquals(
      response.data?.intermediateResults[0].error,
      'Invalid arguments for getCapabilityGaps: ["Invalid args"]'
    );
  });
}); 