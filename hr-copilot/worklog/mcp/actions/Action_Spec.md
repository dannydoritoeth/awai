# 📄 MCP Action Specification v2

This spec defines the implementation guidelines for each MCP Action. It ensures consistency, separation of concerns, and safe AI interaction.

---

## 🧱 Core Structure

Each action must:
- Live in its own directory (e.g. `getCapabilityGaps/`)
- Export a valid `MCPActionV2` implementation from `action.ts`
- Include comprehensive JSDoc comments describing purpose, inputs, outputs, and related actions
- Implement clear separation between internal context and AI context
- Register itself in the `actionRegistry.ts` by adding to the `actions` array

### Required Files
```
actionName/
├── action.ts       # Main action implementation
├── buildPrompt.ts  # AI prompt construction (if uses AI)
```

---

## 🔄 Implementation Requirements

### MCPActionV2 Interface
```typescript
interface MCPActionV2 {
  id: string;                 // Unique identifier
  title: string;             // Human-readable name
  description: string;       // Purpose description
  applicableRoles: string[]; // Which user roles can use this
  capabilityTags: string[]; // Relevant capability areas
  requiredInputs: string[]; // DEPRECATED: Use argsSchema for required args
  tags: string[];           // Search/categorization tags
  suggestedPrerequisites: string[]; // Suggested action ordering
  suggestedPostrequisites: string[];
  usesAI: boolean;          // Whether action uses AI
  
  // Schema defining expected arguments and their types
  argsSchema?: z.ZodObject<any>;  // Required args and their validation
  
  // Function to get default values for args based on context
  getDefaultArgs?: (context: Record<string, any>) => Record<string, any>;
  
  // Main action implementation
  actionFn: (request: MCPRequest) => Promise<MCPResponse>;
}

interface MCPRequest {
  args?: Record<string, any>;     // Arguments specific to this action
  context: Record<string, any>;   // Shared context across actions
  supabase: SupabaseClient;       // Database client
  sessionId?: string;             // Current session identifier
}
```

## 📝 Argument Handling

### 1. Infrastructure vs Arguments

There are three distinct types of inputs to actions:

1. **Infrastructure Components** (from `request` directly)
   - `supabase`: Database client
   - `sessionId`: Current session identifier
   - These should NEVER be included in args or argsSchema
   - Always access these directly from the request object: `request.supabase`, `request.sessionId`

2. **Shared Context** (from `request.context`)
   - Cross-action state (e.g. user info, selected role)
   - Shared data needed by multiple actions
   - Access via `request.context.someValue`

3. **Action Arguments** (from `request.args`)
   - Action-specific parameters
   - Defined in `argsSchema`
   - Examples: queryText, limit, filters
   - Access via validated args object

### 2. Defining Arguments
Arguments should ONLY include action-specific parameters:

```typescript
argsSchema: z.object({
  // ✅ CORRECT: Action-specific parameters
  queryText: z.string().min(1, "Query text cannot be empty")
    .describe("The text to search for matches"),
  limit: z.number().positive().optional()
    .describe("Maximum number of results to return"),

  // ❌ INCORRECT: Infrastructure components should not be in args
  // supabase: z.any(),     // WRONG - This comes from request
  // sessionId: z.string(), // WRONG - This comes from request
})
```

### 3. Default Values
`getDefaultArgs` should only provide defaults for action-specific arguments:

```typescript
getDefaultArgs: (context) => ({
  // ✅ CORRECT: Action-specific defaults
  queryText: context.lastMessage || '',
  limit: 10,

  // ❌ INCORRECT: Don't include infrastructure
  // supabase: context.supabase,  // WRONG
  // sessionId: context.sessionId // WRONG
})
```

### 4. Accessing Values in actionFn

```typescript
actionFn: async (request: MCPRequest) => {
  // ✅ CORRECT: Infrastructure from request
  const { supabase, sessionId } = request;
  
  // ✅ CORRECT: Shared context from request.context
  const { userId, selectedRole } = request.context;
  
  // ✅ CORRECT: Action args from request.args
  const { queryText, limit } = request.args;
  
  // ❌ INCORRECT: Don't mix sources
  // const { supabase } = request.args; // WRONG
  // const { queryText } = request;     // WRONG
}
```

### 5. Base Function Parameters
When creating helper functions, be explicit about parameter sources:

```typescript
// ✅ CORRECT: Explicitly combine MCPRequest with args interface
async function actionBase(
  request: MCPRequest & ActionSpecificArgs
): Promise<Result> {
  // Infrastructure from request
  const { supabase, sessionId } = request;
  
  // Action-specific args
  const { queryText, limit } = request;
}

// ❌ INCORRECT: Don't use separate parameters
async function actionBase(
  args: ActionSpecificArgs,
  supabase: SupabaseClient  // WRONG - Should come with request
): Promise<Result>
```

### 4. Validation Flow
1. System checks `argsSchema` for required fields
2. Merges with defaults from `getDefaultArgs`
3. Validates final args against schema
4. Passes validated args to `actionFn`

### 5. Context vs Args
- `context`: Shared state across actions (e.g. sessionId, user info)
- `args`: Action-specific parameters
- Use `argsSchema` to define action-specific parameters
- Use `requiredContext` in registry for shared context requirements

Example:
```typescript
// In action definition
argsSchema: z.object({
  queryText: z.string().min(1)
})

// In registry
{
  ...action,
  requiredContext: ['sessionId'],  // Shared context requirements
  requiredArgs: ['queryText']      // Action-specific requirements
}
```

---

## 🗃️ Database Integration

- Use strongly typed Supabase client
- Reference table structure from migrations
- Key tables to consider:
  - `profiles`
  - `roles`
  - `skills`
  - `capabilities`
  - `agent_actions`
  - `conversation_sessions`
  - `chat_messages`

---

## 🔍 Success Criteria

### 🔧 Structure & Type Safety
- [ ] Implements MCPActionV2 interface completely
- [ ] Uses TypeScript interfaces for all data structures
- [ ] Includes comprehensive JSDoc documentation
- [ ] Maintains separation between action.ts and buildPrompt.ts
- [ ] Properly registered in actionRegistry.ts

### 📊 Data & Error Handling
- [ ] Validates all inputs before processing
- [ ] Handles database errors gracefully
- [ ] Implements proper error typing and messages
- [ ] Uses structured logging via logAgentProgress

### 🧠 AI Integration (if applicable)
- [ ] Maintains clean separation of internal/AI contexts
- [ ] Uses buildSafePrompt for all AI interactions
- [ ] Configures AI model explicitly
- [ ] Handles AI errors gracefully

### 📤 Response Format
- [ ] Returns valid MCPResponse structure
- [ ] Includes dataForDownstreamPrompt when relevant
- [ ] Provides structured data for planner
- [ ] Includes clear error information when needed

### 🔄 Default Arguments
- [ ] Implements getDefaultArgs if action can be suggested
- [ ] Returns sensible defaults based on context
- [ ] Handles missing context gracefully

### 📝 Documentation
- [ ] Includes clear purpose and usage examples
- [ ] Documents all inputs and outputs
- [ ] Lists related actions
- [ ] Explains any special considerations

### 🎯 Quality Assurance (Optional)
- [ ] Includes basic test cases in test.ts
- [ ] Tests error handling paths
- [ ] Validates prompt construction
- [ ] Checks response format