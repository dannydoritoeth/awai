## 🧩 MCP Loop Action Execution and Logging Canvas

### 🎯 Objective

Standardize action execution and tracking in the MCP loop by:

* Using `MCPResponse` as the canonical format for outputs
* Logging each action invocation in `agent_actions`
* Supporting context-aware, multi-step orchestration using session tracking
* Avoiding redundant execution by checking for prior input-matching results

---

### ✅ Action Execution Contract

Each action must:

* Implement `MCPActionV2`
* Take `MCPRequest` as input
* Return a structured `MCPResponse<T>` as output

---

### 📦 MCPResponse Format (stored in `response` field)

```ts
interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    message: string;
    details?: any;
  };
  actionsTaken?: ActionStep[];
  nextActions?: SuggestedNextAction[];
  inputs?: Record<string, any>; // For traceability
  aiPrompt?: { system: string; user: string }; // For AI-based actions
  aiResponse?: { summary: string; raw: string }; // For AI-based actions
}
```

---

### 🗃 `agent_actions` Table Schema

#### ✅ Current Schema

```sql
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name text,
  action_type text,
  target_type text,
  target_id uuid,
  outcome text,
  payload jsonb,
  confidence_score numeric,
  session_id uuid,
  timestamp timestamptz DEFAULT now()
);
```

#### 🆕 Updated Schema (Recommended)

```sql
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name text,
  action_type text,
  target_type text,
  target_id uuid,
  outcome text,
  request jsonb,        -- structured inputs
  request_hash text,     -- hash of normalized inputs
  response jsonb,        -- result in MCPResponse format
  confidence_score numeric,
  session_id uuid,
  step_index integer,    -- index in session loop
  timestamp timestamptz DEFAULT now()
);
```

> `payload` is now renamed to `response`. `input` becomes `request`, and `input_hash` becomes `request_hash` for clarity.

---

### 🔁 Execution Pattern

```ts
import { createHash } from 'some-hash-lib';

function generateRequestHash(request: Record<string, any>): string {
  const ordered = Object.keys(request)
    .sort()
    .reduce((acc, key) => {
      acc[key] = request[key];
      return acc;
    }, {});
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}

async function runActionWithContext(actionId, sessionId, currentInputs) {
  const context = loadSessionContext(sessionId);
  const action = actionRegistry[actionId];
  const requestHash = generateRequestHash(currentInputs);

  const existing = await findExistingActionResult(sessionId, actionId, requestHash);
  if (existing?.response?.success && isResultStillValid(existing)) {
    console.log(`Reusing result for ${actionId} from session ${sessionId} with matching hash`);
    return existing.response;
  }

  const result = await action.actionFn(context);

  await logMcpStep({
    sessionId,
    actionId,
    request: currentInputs,
    request_hash: requestHash,
    response: result,
    outcome: result.success ? 'success' : 'error',
    agentName: 'planner',
    stepIndex: getStepIndex(sessionId),
    targetType: 'profile',
    targetId: context.profileId
  });

  return result;
}
```

---

### 📊 Benefits

* ✅ Avoids repeated action execution when inputs haven't changed
* ✅ Allows consistent logging and replay of results
* ✅ Simplifies comparison/debugging of action flows
* ✅ Works seamlessly with AI and data-based actions
* ✅ Forms a robust foundation for agent orchestration or audit

---

### 🧾 Logging Responsibilities

To ensure consistency and separation of concerns:

* ⛔ **Actions must not perform their own logging**. They should only focus on returning a valid `MCPResponse`.
* ✅ **All logging to `agent_actions` must be handled by the MCP loop orchestrator** (e.g. `mcp-loop-v2`), after the action has been executed.
* ✅ This ensures centralization of logging logic, allows consistent schema usage, and enables pre-execution deduplication based on `request_hash`.

---

### ✅ Next Steps

* [ ] Update schema: rename `payload` to `response`; add `request` and `request_hash`
* [ ] Update `runActionWithContext` to compute and store request hash
* [ ] Ensure `logMcpStep` stores `request`, `request_hash`, and `response`
* [ ] Refactor all logs and queries to use the updated column names

---

### 🏁 Success Criteria

* ✅ All MCP actions return a valid `MCPResponse` with consistent structure
* ✅ No action writes directly to `agent_actions`; only the orchestrator does
* ✅ All action executions are deduplicated using `request_hash` within a session
* ✅ Replayed sessions can reconstruct full decision context using `agent_actions`
* ✅ Schema updates are live and queries reflect `response`, `request`, `request_hash`
* ✅ Orchestrator properly skips or reuses results based on past successful inputs
* ✅ Audit logs and planners can trace decisions based on logged `response` outputs; add `request` and `request_hash`
* [ ] Update `runActionWithContext` to compute and store request hash
* [ ] Ensure `logMcpStep` stores `request`, `request_hash`, and `response`
* [ ] Refactor all logs and queries to use the updated column names
