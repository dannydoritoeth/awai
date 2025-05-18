# 🧠 Work Request: Implement Chat Message Embeddings + Session Context Loader (Incremental Steps Only)

## Objective

Enable the AI to reference prior messages and actions during chat interactions by embedding user/assistant messages and agent actions, then loading relevant context for each session — **implemented in small, verifiable steps**.

---

## ✅ Step-by-Step Deliverables

### ✅ STEP 1: Embed Messages on Insert (No Other Changes)

Update only the insert logic in `postUserMessage` and `logAgentResponse` to include embedding.

**Changes**:
```ts
import { generateEmbedding } from '../semanticSearch.ts';

const embedding = await generateEmbedding(message);
await supabase.from('chat_messages').insert({
  session_id,
  sender,
  message,
  embedding
});
```

**Test**:
- Confirm that new rows in `chat_messages` contain the embedding vector.
- Existing logic should be untouched.

---

### ✅ STEP 1a: Add `embedding` Column to `agent_actions`

**Schema Change**:
```sql
ALTER TABLE agent_actions ADD COLUMN embedding vector(1536);
```

---

### ✅ STEP 1b: Set `session_id` + Embed on Insert

Ensure `session_id` is properly set when inserting into `agent_actions`, and generate an embedding based on a stringified action summary:

```ts
import { generateEmbedding } from '../semanticSearch.ts';

const actionSummary = `${action_type}: ${JSON.stringify(input_data)} -> ${JSON.stringify(output_data)}`;
const embedding = await generateEmbedding(actionSummary);

await supabase.from('agent_actions').insert({
  session_id,
  action_type,
  input_data,
  output_data,
  embedding
});
```

**Test**:
- Check that recent `agent_actions` include the session ID and a valid embedding.

---

### 🟡 STEP 2 (After Approval): Create `getConversationContext(sessionId)` Helper

(New file: `shared/context/getConversationContext.ts`)

**Functionality**:
- Retrieve the last N chat messages (default 10)
- Retrieve the last M agent actions (default 5)
- Return interface:

```ts
export interface ConversationContext {
  history: ChatMessage[];
  agentActions?: AgentAction[];
  summary?: string;
  contextEmbedding?: number[];
}
```

**Implementation Notes**:
- Exclude system/debug messages
- Pull `summary` from `conversation_sessions`
- Compute `contextEmbedding` as average of last 3 embeddings (chat + actions)

**Test**:
- Call with a mock session ID; confirm correct return shape and values

---

### 🟡 STEP 3: Update MCP Types

Update `shared/mcpTypes.ts`:

```ts
export interface MCPContext {
  lastMessage: string;
  chatHistory?: ChatMessage[];
  agentActions?: AgentAction[];
  contextEmbedding?: number[];
  summary?: string;
  semanticContext?: {
    previousFocus?: 'role' | 'job' | 'capability' | 'company';
    matchingTopic?: string;
  };
}
```

**Test**:
- Ensure types compile and reflect new context

---

### 🟡 STEP 4: Pass `getConversationContext` into MCP Loop

**Changes**:
- Inside `mcp-loop`, call `getConversationContext(sessionId)`
- Pass returned `ConversationContext` into planner

**Test**:
- Confirm `chatHistory`, `summary`, `contextEmbedding`, and `agentActions` are passed into planner input

---

### 🟡 STEP 5: Use Context in Planner + Summarizer

Ensure planner/summarizer access:

- `context.chatHistory`
- `context.agentActions`
- `context.summary`
- `context.contextEmbedding`

**Test**:
- Add logging/validation in planner/summarizer to confirm access

---

## ❗ Do Not

- Refactor unrelated files or logic
- Add new features not listed above
- Change database or table structure beyond what's defined

---

## 📁 File Locations

- `shared/chatUtils.ts` — embed on insert ✅
- `shared/context/getConversationContext.ts` — context helper
- `shared/mcpTypes.ts` — context type update
- `shared/mcpLoop.ts` — load context + pass to planner
- `planner.ts` / `summarizer.ts` — consume context
- `agent_action_logger.ts` — update insert logic

---

Once STEP 1 and STEP 1a/1b are approved, proceed to STEP 2.