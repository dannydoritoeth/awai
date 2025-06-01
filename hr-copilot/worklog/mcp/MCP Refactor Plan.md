
# 🔧 MCP System: Targeted Refactoring Plan

This document outlines **must-do refactors** to standardize and improve maintainability across MCP modules. It **does not request functional changes**—only shared logic consolidation and consistency improvements.

---

## 📁 1. Shared Context Loader Utility

### ✅ Why
Context loading logic (e.g., embeddings, profile data, role data) is duplicated in:
- `candidate.ts`
- `hiring.ts`
- `analyst.ts`

### 🔧 Action
**Create new file**: `/utils/contextLoader.ts`

Move context-loading functions into this file:

```ts
// contextLoader.ts
export async function loadProfileContext(profileId: string): Promise<ProfileContext> { ... }

export async function loadRoleContext(roleId: string): Promise<RoleContext> { ... }
```

### 📍 Update Call Sites
Replace existing inline logic in:
- `getProfileContext` in `candidate.ts`
- `getShortlistedRolesForPerson` in `hiring.ts`
- `getCapabilityHeatmap` in `analyst.ts`

---

## 📁 2. Standardize Prompt Construction

### ✅ Why
Prompt generation is inconsistent. Some use inline strings, others use `promptBuilder.ts`.

### 🔧 Action
Update all modules to use central `buildPrompt()` from `promptBuilder.ts`.

### 📍 Update Call Sites
Update actions like:
- `getSuggestedCareerPaths` in `candidate.ts`
- `getShortlistedRolesForPerson` in `hiring.ts`
- `getAnalyticsSummary` in `analyst.ts`

Ensure each action uses:

```ts
const prompt = buildPrompt({ type: 'careerPath', data });
```

Do **not** refactor the logic inside `buildPrompt()` itself.

---

## 📁 3. Create Action Metadata Definitions

### ✅ Why
Improve consistency and documentation of actions.

### 🔧 Action
Create a shared registry in a new file `/registry/actionDefinitions.ts`:

```ts
export const MCP_ACTIONS = {
  getSuggestedCareerPaths: {
    id: 'getSuggestedCareerPaths',
    role: 'candidate',
    description: 'Recommend future roles based on profile',
    requiresProfileId: true
  },
  ...
}
```

Update `candidate.ts`, `hiring.ts`, and `analyst.ts` to import metadata from this file where needed.

---

## 📁 4. Centralize AI Call Logic

### ✅ Why
Avoid duplicated logic, simplify error handling, add observability and audit logs in one place.

### 🔧 Action
**Create** `/utils/aiCaller.ts`:

```ts
export async function callAI(prompt: string, config?: { temperature?: number }): Promise<string> {
  const result = await OpenAIClient.generateCompletion({
    prompt,
    temperature: config?.temperature ?? 0.3,
    maxTokens: 1024,
  });
  return result.choices[0].text.trim();
}
```

### 📍 Replace AI Calls
Update all direct calls to AI (e.g. OpenAI, Anthropic, Azure OpenAI) to use `callAI()` instead.

---

## 📁 5. Externalize Prompt Text to Files

### ✅ Why
Make it easy to view, edit, audit, and eventually version control all prompt content.

### 🔧 Action
Store all prompt templates under:

```
/prompts/
  candidate/
    getSuggestedCareerPaths.txt
    getJobReadiness.txt
  hiring/
    getTalentPoolCandidates.txt
```

**Create utility** `/utils/promptLoader.ts`:

```ts
import { readFile } from 'fs/promises';
import path from 'path';

export async function loadPrompt(promptPath: string): Promise<string> {
  const fullPath = path.resolve('prompts', `${promptPath}.txt`);
  return await readFile(fullPath, 'utf-8');
}
```

Use in action files like:

```ts
const raw = await loadPrompt('candidate/getSuggestedCareerPaths');
const prompt = raw.replace('{{capabilityGaps}}', gaps.join(', '));
```

---

## ✅ Existing Functionality That Must Be Maintained

The following modules implement essential role-specific logic that must be preserved during refactoring. No functionality should be broken or altered unless explicitly scoped in this plan.

### 📂 `candidate.ts`
Implements actions for individual career guidance:
- `getProfileContext`: loads full profile details and embedding
- `getSuggestedCareerPaths`: recommends next roles based on embeddings
- `getJobReadiness`: scores how ready a profile is for a target job
- `getOpenJobs`: retrieves open jobs
- `getCapabilityGaps`: compares profile to role and returns capability delta
- `getSkillGaps`: same as above but focused on skills
- `getSemanticSkillRecommendations`: AI-suggested skills to focus on

### 📂 `hiring.ts`
Handles internal mobility and shortlisting logic:
- `getSimilarInternalCandidates`: embedding-based candidate search
- `getRoleShortlist`: generates ranked shortlist for a role
- `getTalentPoolCandidates`: retrieves flagged talent pool members
- `getShortlistedRolesForPerson`: reverse-match a person to open roles
- `getProfileSummaryForHiring`: profile-level summary for hiring

### 📂 `analyst.ts`
Supports strategic workforce analytics:
- `getCapabilityHeatmap`: returns % coverage of capabilities across org
- `getForecastingInsights`: interprets skill/role shortages
- `getAnalyticsSummary`: aggregates high-level metrics from stored embeddings
- `getRoleGapInsight`: high-level summary of why a role is hard to fill

### 📂 `planner.ts`
Focuses on modeling future scenarios and pipeline planning:
- `generateForecastPlan`: workforce scenario planner
- `suggestWorkforceChanges`: recommends interventions (hire/train/etc.)

### 📂 `matchingUtils.ts`
Shared logic used by both `hiring.ts` and `analyst.ts`:
- Embedding similarity
- Profile and role comparison
- Capability overlap metrics

⚠️ These utilities are called widely—do not refactor or move unless unit tested thoroughly.

### 📂 `promptBuilder.ts` + `promptTypes.ts`
Used by multiple roles to assemble structured prompts.
- Types must remain consistent with action logic
- Builders may be updated for compatibility but not altered in behavior

---

## 🚫 Don't Do These Yet

- ❌ Don't modify `matchingUtils.ts`
- ❌ Don't change return signatures
- ❌ Don't merge modules
- ❌ Don't add new logic or validations

---

## 📅 Recommended Order

1. Create `contextLoader.ts` and update call sites.
2. Update prompt usage to go through `promptBuilder.ts`.
3. Register actions in a central `actionDefinitions.ts`.
4. Centralize all AI calls using `aiCaller.ts`.
5. Move all static prompt text to `prompts/` folder and reference them via `promptLoader.ts`.

After this refactor, the codebase will be ready for modular test coverage, bulk metadata reporting, and easier extension.

---

## 📝 Logging Behavior That Must Be Maintained

The system currently logs AI interactions (prompts and responses) to the `chat_messages` table. This behavior is **mandatory and must be preserved** during all refactoring efforts.

### ✅ Why It Matters
- Enables context-aware conversations
- Supports session memory and RAG pipelines
- Provides traceability for audits and debugging

### 🔧 Requirements
- Each call to the AI (whether refactored through `callAI()` or not) must:
  - Log the **user message** with metadata (e.g. role, action, input)
  - Log the **AI response** after completion
  - Link both to the correct session ID
- If batching or queueing is introduced, logging must happen before and after inference.

Do **not remove or bypass** the logging integration with the database.
