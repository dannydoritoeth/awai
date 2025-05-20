# 📄 Action Spec Template

This spec defines the implementation guidelines for each MCP Action. It ensures consistency, separation of concerns, and safe AI interaction.

---

## 🧱 Structure & Contracts

- Action lives in its own directory (e.g. `getCapabilityGaps/`)
- Main file is `action.ts` and must export a valid `MCPActionV2`
- Must implement `MCPActionV2`, take `MCPRequest` as input and return `MCPResponse` as output
- Include header comments at the top describing the purpose, inputs, outputs, and related actions

---

## 🔄 Data Handling

- Gather all relevant internal data (e.g., profiles, roles, gaps) from `MCPRequest`
- Internal data should be used to inform logic, but not all of it should go to the AI
- Define a **clean separation** between:
  - `context`: internal execution state
  - `aiContext`: only the minimal structured data needed for AI

---

## 🧠 Prompt Construction

- All AI prompt construction must be done in a separate file: `buildPrompt.ts`
- `buildPrompt.ts` must export `buildPromptInput(context: Record<string, any>): AIPromptInput`
- `buildPromptInput` should:
  - Select relevant fields from context
  - Trim or summarize unnecessary data
  - Format a clean, structured prompt for AI use
- Pass all prompt data through `buildSafePrompt()` before sending to AI

---

## 🤖 AI Invocation

- Use `invokeChatModel()` with:
  - Explicit `model`, `temperature`, and `max_tokens`
- AI-based actions must return:
  - `output`: core content or result
  - `explanation`: (if applicable) a plain-language rationale
  - `rawAiResponse`: full AI response for debugging/logging

---

## 📜 Logging

- Log steps to the chat stream:
  - `data_gathered`
  - `prompt_built`
  - `ai_invoked`
  - `response_received`
- Use `logAgentAction()` for final logging:
  - Inputs used
  - Prompt passed
  - AI model config
  - AI response (summary and raw)

## 📜 Get Default Args

 - Implement a function to return the default arguments to call with the parameters from the context:
   - implement getDefaultArgs?: (context: Record<string, any>) => Record<string, any>
   - pass in the current context
   - returns what args this action would need to be passed
   - Used by the planner to get what actions are recommended next

## 🧪 Testing Guidance

- Include a Deno + supabase compatible `test.ts` file for:
  - Snapshot testing of `buildPromptInput()`
  - Verifying output structure of the action
- Ensure graceful handling of:
  - Missing inputs
  - Empty AI responses
  - Unexpected data structures
---

## ✅ Success Criteria for Actions

Each action implementation should meet the following criteria:

### 🔧 Structure & Type Safety
- [ ] Resides in its own directory with clear naming
- [ ] Exports a valid `MCPActionV2` from `action.ts`
- [ ] Accepts `MCPRequest` and returns `MCPResponse`
- [ ] Has a header comment explaining purpose, inputs, outputs, related actions

### 📊 Data Handling
- [ ] Gathers only required data based on `requiredInputs`
- [ ] Maintains clean separation between internal `context` and AI `aiContext` (if applicable)
- [ ] Handles missing or malformed inputs gracefully

### 🧠 AI Usage (if applicable)
- [ ] Prompt is built via `buildPromptInput()` in a separate `buildPrompt.ts` file
- [ ] Uses `buildSafePrompt()` to enforce safety and size constraints
- [ ] Calls `invokeChatModel()` with explicit configuration (model, temp, max_tokens)
- [ ] Returns structured `output`, optional `explanation`, and full `rawAiResponse`

### 📜 Logging
- [ ] Logs key steps to chat: `data_gathered`, `prompt_built`, `ai_invoked`, `response_received`
- [ ] Uses `logAgentAction()` to record all relevant inputs, prompt, and AI outputs

### 🧪 Testing
- [ ] Includes a `test.ts` file for logic and prompt snapshot testing
- [ ] Produces correct output with example/mock input
- [ ] Can be tested independently without full orchestrator

### 📈 Result Quality
- [ ] Outputs are relevant to the purpose of the action
- [ ] Any explanations are clear and grounded in the inputs
- [ ] Handles edge cases (e.g. no data, overly long prompts) reliably