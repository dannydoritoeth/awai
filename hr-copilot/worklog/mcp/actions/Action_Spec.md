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
  requiredInputs: string[]; // Required input fields
  tags: string[];           // Search/categorization tags
  suggestedPrerequisites: string[]; // Suggested action ordering
  suggestedPostrequisites: string[];
  usesAI: boolean;          // Whether action uses AI
  actionFn: (ctx: Record<string, any>) => Promise<MCPResponse>;
  getDefaultArgs?: (context: Record<string, any>) => Record<string, any>;
}
```

### Action Function Structure
1. Input Validation
   - Validate all required inputs are present
   - Type check inputs using TypeScript interfaces
   - Return early with error if validation fails

2. Data Gathering
   - Use supabase client for database queries
   - Log progress using `logAgentProgress`
   - Handle database errors gracefully

3. Context Preparation
   - Maintain clear separation between:
     - `context`: Internal execution state
     - `aiContext`: Minimal data needed for AI
   - Use TypeScript interfaces to enforce structure

4. AI Processing (if applicable)
   - Use `buildPrompt.ts` for prompt construction
   - Apply `buildSafePrompt` for safety checks
   - Use `invokeChatModel` with explicit configuration
   - Handle AI errors gracefully

5. Response Structure
   ```typescript
   interface MCPResponse {
     success: boolean;
     data?: any;
     error?: {
       type: string;
       message: string;
       details?: any;
     };
     dataForDownstreamPrompt?: {
       [actionId: string]: {
         dataSummary: string;
         structured: Record<string, any>;
         truncated: boolean;
       }
     };
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