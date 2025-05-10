# 🧠 Work Request: Implement Chat Message Embeddings + Session Context Loader

## Objective

Enable the AI to reference prior messages during chat interactions by embedding user/assistant messages and loading relevant context for each session.

This allows the MCP system to reason across multi-turn conversations and adapt to evolving questions and topics.

---

## ✅ Deliverables

### 1. Add Embedding Support to `chat_messages` (ALEADY DONE)

**Schema Change**  
Add a new column to `chat_messages`:

```sql
ALTER TABLE chat_messages ADD COLUMN embedding vector(1536);
```

> Use the same dimension as your existing embeddings (OpenAI = 1536, Google = 768, etc.)

---

### 2. Embed Messages on Insert

In `postUserMessage` and `logAgentResponse`, embed the message and store it:

import { getSemanticMatches, generateEmbedding } from '../semanticSearch.ts';
```ts
const embedding = await generateEmbedding(message);
await supabase.from('chat_messages').insert({
  session_id,
  sender,
  message,
  embedding
});
```

---

### 3. Add `getConversationContext(sessionId)` Helper

**New file**: `shared/context/getConversationContext.ts`

This should:
- Query the last N messages for the session (default: 10)
- Optionally rank by semantic similarity to the latest message
- Return:

```ts
export interface ConversationContext {
  history: ChatMessage[];
  summary?: string; // (optional) running summary from conversation_sessions
  contextEmbedding?: number[]; // averaged or recent embedding
}
```

Implementation notes:
- Consider excluding system/debug messages from history
- If available, use `conversation_sessions.summary` as fallback
- You can use average of the last 3 embeddings for `contextEmbedding`

---

### 4. Update MCPRequest Context

Update `MCPRequest.context` to accept full conversation context:

```ts
interface MCPContext {
  lastMessage: string;
  chatHistory?: ChatMessage[];
  contextEmbedding?: number[];
  summary?: string;
  semanticContext?: {
    previousFocus?: 'role' | 'job' | 'capability' | 'company';
    matchingTopic?: string;
  };
}
```

---

### 5. Usage in MCP Loop + Planner

Ensure:
- The `mcp-loop` passes `getConversationContext(sessionId)` to the planner
- The planner and chat summarizer have access to:
  - `chatHistory`
  - `summary`
  - `contextEmbedding`

---

## 🧪 Optional (Future-Ready)

- Add a `contextSimilarityScore` to returned context matches
- Precompute session summaries using a background agent or `after insert` trigger

---

## 📁 File Locations

- `shared/chatUtils.ts` — update insert functions to include embedding
- `shared/context/getConversationContext.ts` — new file
- `shared/mcpTypes.ts` — add `ConversationContext` and `MCPContext` types
