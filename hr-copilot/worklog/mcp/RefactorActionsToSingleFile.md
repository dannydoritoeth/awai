## 🛠️ Refactor Work Request: Modularise MCP Actions into Per-File Structure

### 🎯 Objective

Refactor the existing Modular Capability Profile (MCP) actions currently grouped by role (e.g. `candidate.ts`, `hiring.ts`, `analyst.ts`) into a **per-action file structure**.

This will:

* Improve maintainability and discoverability
* Support consistent patterns across all actions
* Enable scalable integration with workflows and autonomous agents

---

### 📁 Proposed File Structure

```
/actions
  /candidate
    getSuggestedCareerPaths.ts
    getCapabilityGaps.ts
    getSemanticSkillRecommendations.ts
  /hiring
    getShortlistedRolesForPerson.ts
    getTalentPoolCandidates.ts
  /shared
    getJobReadiness.ts
    getDevelopmentPlan.ts
    logPlannedTransitions.ts
```

---

### 📐 Action File Template

Each file should:

* Export a single default async function
* Accept a typed `input` object and return a typed output
* Include error handling and telemetry hooks

```ts
import { ActionInput, ActionOutput } from '../types';

export default async function getJobReadiness(input: ActionInput): Promise<ActionOutput> {
  // 1. Validate input
  // 2. Fetch necessary context (e.g. profile, role)
  // 3. Compute score
  // 4. Return result
}
```

---

### 🧩 Steps to Implement

1. Create `/actions` directory with subfolders for role categories
2. Move each current function from the `candidate.ts`, `hiring.ts`, etc., files into its own dedicated file
3. Rename functions to match file names (if necessary)
4. Replace internal module references with new imports via an `actionRegistry.ts`
5. Ensure all references in the orchestrators and agents use the new structure
6. Add shared test templates if not already covered

---

### 🧪 Acceptance Criteria

* All actions exist as isolated modules
* Tests continue to pass with the new structure
* ActionRegistry can list and dispatch all available actions by ID or name
* Refactor does not alter any action logic (pure structure migration)

---

### 🧠 Optional Enhancements

* Add shared decorators (e.g. `withTelemetry()`, `withValidation()`, `withAuthorization()`)
* Use zod or similar for input schema validation
* Scaffold action metadata (ID, description, tags) for dynamic workflow mapping

---

This request ensures the MCP action architecture is scalable, maintainable, and agent-compatible going forward.
