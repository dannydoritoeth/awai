## 🎯 Metric 1: Employee Retention (Temporary Staff)

### 🌐 Workflow Goal

Proactively identify and match temporary employees to new internal roles to reduce avoidable turnover.

### 🧩 Actions & Descriptions

#### `getShortlistedRolesForPerson` (Implemented in hiring.ts)

* **Purpose:** Identify internal roles where a person meets at least 70% of the requirements.
* **Input:** `profileId`, optional filters like `location`, `interest areas`
* **Output:** List of matching internal roles with similarity/relevance score
* **Used by:** Candidate profile view, Exit risk dashboard, Career support chat

#### `getCapabilityGaps` (Implemented in candidate.ts)

* **Purpose:** Compare a person's current capabilities to the requirements of a selected role
* **Input:** `profileId`, `roleId`
* **Output:** List of capability gaps with severity level (minor/critical)
* **Used by:** Career planning tools, personalised upskilling suggestions

#### `getSuggestedCareerPaths` (Implemented in candidate.ts)

* **Purpose:** Suggest logical next roles for a candidate based on their history and embedding similarity
* **Input:** `profileId`
* **Output:** List of recommended roles and how closely they match
* **Used by:** Career portal, individual development plans

#### `getSemanticSkillRecommendations` (Implemented in candidate.ts)

* **Purpose:** Recommend skills to acquire based on gaps to preferred roles
* **Input:** `profileId`, optionally `targetRoleId`
* **Output:** List of skills + recommended learning steps or microcredentials
* **Used by:** LMS integrations, candidate dashboards

#### `logPlannedTransitions` *(New - Required)*

* **Purpose:** Record a planned future move for a candidate into another role
* **Input:** `profileId`, `plannedRoleId`, `effectiveDate`, `status`
* **Output:** Confirmation with ability to update, delete, or mark complete
* **Used by:** Talent acquisition team, workforce mobility planning

### 🔗 Combined Workflow Logic

1. Detect high-turnover risk: Temp contract end, no pipeline, flagged by manager
2. Call `getSuggestedCareerPaths` to suggest possible directions
3. For top matches, run `getCapabilityGaps`
4. Use `getSemanticSkillRecommendations` to recommend development
5. Record outcome with `logPlannedTransitions`

### ✅ Outcome

* Enables visibility into internal redeployment options
* Supports career guidance at point of exit risk
* Reduces cost and disruption from unnecessary external hiring

---

This page provides a build-ready plan for implementing Metric 1. Next: Define similar structure for Metric 2 — Reduce External Recruitment Costs.
