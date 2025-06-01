# 🧠 MCP Loop Specification (v1)

This specification defines a **minimal but production-ready Model Context Protocol (MCP) loop** implementation that is structured into 4 clear stages: context loading, planning, looping through actions, and finalization. The implementation will be written as an **independent, testable class or function** suitable for both local use and integration into Supabase Edge Functions.

---

## 📦 System Overview

**Goal**: To process structured AI-assisted workflows using a simple, modular control loop compatible with Cursor/Claude MCP integrations and custom agent orchestration.

**Runtime**: Deno-compatible TypeScript class/function  
**Entry Function**: `runMcpLoop(request: MCPRequest): Promise<MCPResponse>`

---

## ✅ Success Criteria

To ensure the MCP loop implementation is fit for purpose, the following success criteria must be met:

### ✅ Functional
- [ ] Correctly embeds latest message and loads prior chat/context data
- [ ] Selects and plans appropriate tool actions using the planner
- [ ] Executes each planned action sequentially, enriching context
- [ ] Optionally summarizes the results using a `finalize_summary` tool

### ✅ Structural
- [ ] Implemented as a reusable class or function (e.g. `McpLoopRunner`)
- [ ] Fully testable in isolation without Supabase deployment
- [ ] Compatible with Supabase Edge Function runtime

### ✅ Interface Compliance
- [ ] Accepts input as defined in `MCPRequest`
- [ ] Returns output as defined in `MCPResponse`
- [ ] Tools registered using `ToolRegistry.register()` with Zod validation

### ✅ Performance
- [ ] Executes within 10s for 90% of use cases
- [ ] No memory leaks or large object retention across requests

### ✅ Extensibility
- [ ] Planner prompt uses dynamic tool listing with descriptions
- [ ] New tools can be added to registry without changing loop logic
- [ ] Planner logic configurable via prompt tuning or injected strategy

---

## 🔁 Loop Implementation Plan (Step-by-Step)

### Step 1: Context Loader

```ts
import { generateEmbedding } from '../shared/semanticSearch.ts';
import { getConversationContext } from '../shared/context/getConversationContext.ts';

const latestMessage = messages[messages.length - 1]?.content;
if (!latestMessage) throw new Error("No message content provided");

const embeddedMessage = await generateEmbedding(latestMessage);

const { recentMessages, semanticMatches } = await getConversationContext(
  supabaseClient,
  request.sessionId,
  embeddedMessage
);

const context: Record<string, any> = {
  embeddedMessage,
  recentMessages,
  semanticMatches,
  sessionId: request.sessionId,
  mode: request.mode,
  ...(request.context || {})
};
```

---

### Step 2: Planner

```ts
import { ActionV2Registry } from '../actions/actionRegistry.ts';
import { invokeChatModel } from '../ai/invokeAIModel.ts';

// Gather Available Tools
const tools: ToolMetadata[] = ActionV2Registry.getToolMetadataList();

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
${JSON.stringify(context, null, 2)}

${ActionV2Registry.buildPlannerPromptWithPathways()}`;

// Call the planner model
const planResponse = await invokeChatModel({
  prompt: {
    system: 'You are a planning agent.',
    user: plannerPrompt
  },
  options: {
    model: 'gpt-4o',
    temperature: 0.3,
    max_tokens: 1000
  }
});

const plan: PlannedAction[] = JSON.parse(planResponse.text);

// Validate tool IDs
for (const step of plan) {
  if (!ActionV2Registry.has(step.tool)) {
    throw new Error(`Planner returned unknown tool: ${step.tool}`);
  }
}
```

---

### Step 3: Loop Executor

```ts
const intermediateResults: ActionResult[] = [];

for (const step of plan) {
  const tool = ActionV2Registry.get(step.tool);
  if (!tool) throw new Error(`Tool not found: ${step.tool}`);

  const validation = tool.argsSchema?.safeParse(step.args);
  if (validation && !validation.success) {
    throw new Error(`Invalid args for ${step.tool}: ${JSON.stringify(validation.error.issues)}`);
  }

  const result = await tool.actionFn({ ...context, ...step.args });

  context[step.tool] = result;
  intermediateResults.push({
    tool: step.tool,
    input: step.args,
    output: result,
    success: true
  });
}
```

---

### Step 4: Finalize (optional)

```ts
let summaryMessage: string | undefined = undefined;

if (plan.some(p => p.tool === 'finalize_summary')) {
  const finalTool = ToolRegistry.get('finalize_summary');
  summaryMessage = await finalTool.run({ context, args: {} });
}
```

---

## 🧱 API Contract

### Input
```ts
{
  mode: "analyst" | "candidate" | "hiring" | "general",
  sessionId: string,
  messages: ChatMessage[],
  context?: Record<string, any>,
  plannerRecommendations?: any[],
  availableTools?: ToolMetadata[]
}
```

### Output
```ts
{
  success: true,
  data: {
    context: Record<string, any>,
    intermediateResults: ActionResult[],
    plan: PlannedAction[],
    semanticMatches?: any[],
    summaryMessage?: string
  }
}
```

---

## 🔧 Supporting Interfaces

### `ToolMetadata`
```ts
{
  name: string,
  description: string,
  argsSchema: ZodSchema,
  run: (params: { context: any, args: Record<string, any> }) => Promise<any>
}
```

### `PlannedAction`
```ts
{
  tool: string,
  args: Record<string, any>
}
```

### `ActionResult`
```ts
{
  tool: string,
  input: any,
  output: any,
  success: boolean,
  error?: string
}
```

---



---

## 🧪 Tests: Loop Execution with Mock Planner Plans

We will validate the loop execution logic using static mocked plans and mock tools. These tests should avoid calling the AI model or real actions.

### 🔍 Test Goals
- Verify the loop executes all valid actions returned by the planner.
- Validate argument schema (if present).
- Skip unknown tools gracefully.
- Confirm result objects are stored in context.
- Fail cleanly on schema validation errors.

### 🧪 Suggested Scenarios

#### ✅ Runs valid plan with mock tools
```ts
plan = [
  { tool: 'mock_tool_a', args: { foo: 'bar' } },
  { tool: 'mock_tool_b', args: { x: 1 } }
];
```
Expect: Both tools are called in order, outputs added to context.

#### 🚫 Plan includes unknown tool
```ts
plan = [
  { tool: 'mock_tool_a', args: {} },
  { tool: 'unknown_tool', args: {} }
];
```
Expect: Error or warning is thrown/logged for unknown_tool.

#### 🚫 Tool args fail validation
```ts
plan = [
  { tool: 'mock_tool_a', args: { invalidKey: 123 } }
];
```
Expect: Loop throws with schema validation failure.

#### 🌀 Loop with no plan steps
```ts
plan = [];
```
Expect: No errors, no tools executed.

### 🧰 Setup

These tests should run locally with Deno using `deno test`. We mock both the planner and tools:

#### 🔧 Mocking the AI planner
Use hardcoded plans instead of real `invokeChatModel` calls. Example:
```ts
vi.mock('../ai/invokeAIModel.ts', () => ({
  invokeChatModel: vi.fn(() => Promise.resolve({ text: JSON.stringify([
    { tool: 'getCapabilityGaps', args: { profileId: 'abc', roleId: '123' } },
    { tool: 'getDevelopmentPlan', args: { profileId: 'abc' } }
  ]) }))
}));
```

#### 🔧 Mocking actions
Register fake implementations for each tool name you expect to test:
```ts
ToolRegistry.register({
  name: 'getCapabilityGaps',
  description: 'mocked gap',
  argsSchema: z.object({ profileId: z.string(), roleId: z.string() }),
  run: async ({ args }) => ({ matched: [], missing: ['foo'] })
});
```

You can mock any of the following tools:
- `getCapabilityGaps`
- `getDevelopmentPlan`
- `getMatchingRolesForPerson`
- `getSemanticSkillRecommendations`
- `getSuggestedCaereerPaths`
Use `ToolRegistry.register()` to install mock tools with basic logic:
```ts
ToolRegistry.register({
  name: 'mock_tool_a',
  description: 'Mock A',
  argsSchema: z.object({ foo: z.string() }),
  run: async ({ context, args }) => `ran A with ${args.foo}`
});
```

---

## ✅ Implementation Plan

### Step-by-Step

#### 1. Load Context
- Embed the incoming user message using `generateEmbedding(text)`
- Load relevant messages and semantic matches via `getConversationContext()`
- Add the embedding and prior context to `context`

#### 2. Plan
- Use `ActionV2Registry.getToolMetadataList()` for tool listing
- Build prompt with `buildPlannerPromptWithPathways()`
- Call planner via `invokeChatModel()` with correct system prompt
- Parse JSON plan and validate each action with `ActionV2Registry.has(id)`

#### 3. Execute
- Loop over `plan`
- Validate inputs with `argsSchema.safeParse()`
- Execute with `actionFn({...context, ...args})`
- Store results back into `context` under `toolId`
- Track each result in an array `intermediateResults`

#### 4. Finalize
- Return final `context`, `intermediateResults`, and `plan`
- Let the final action result serve as the terminal output (if needed)

### ✅ Success Criteria
- ✅ Plan is parsed and validated with all tools checked
- ✅ Each action runs in order and respects argument schemas
- ✅ Results are stored in context by tool ID
- ✅ Unknown tools and invalid schemas are handled gracefully
- ✅ Full trace of the loop is captured for inspection

---

## ✅ Next Steps
- [ ] Implement `ToolRegistry` with `.register`, `.get`, `.list`
- [ ] Implement each step in `runMcpLoop()`
- [ ] Create testable `MockTool` set for local simulation
- [ ] Export final loop class/function for use in Supabase Edge Function or CI runner

> The final structure should be a class like `McpLoopRunner` or a function like `runMcpLoop()` which takes a request and returns the full response object. This makes it portable, testable, and callable from both edge functions and unit tests.
