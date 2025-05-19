## 🎯 Metric 1: Employee Retention (All Staff)

### 🌐 Workflow Goal

Proactively identify and support at-risk or disengaged employees (including temporary, ongoing, and high-potential staff) to improve retention and internal mobility across the workforce.

### 🧩 Actions & Descriptions

#### `getDevelopmentPlan` *(New - Required)*

* **Purpose:** Convert capability gaps into a development roadmap
* **Input:** `profileId`, `roleId`
* **Output:** Structured development plan including:

  * Recommended skills to develop
  * Relevant training/learning modules
  * Interim roles to build experience
  * Suggested mentors from internal workforce
* **Used by:** Learning & development, candidate dashboards, career planning tools

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

### 👥 Users

* People & Culture
* People Leaders / Managers
* Career Coaches / Internal Mobility Leads
* Individual Employees (Self-Service)

### ⚡ Triggers

* Contract approaching end (temporary staff)
* Manager flags exit risk or disengagement
* Employee interest in change or development
* Underutilisation or career stagnation risk

### 🔗 Combined Workflow Logic

1. Detect high-turnover risk: Temp contract end, no pipeline, flagged by manager
2. Call `getSuggestedCareerPaths` to suggest possible directions
3. For top matches, run `getCapabilityGaps`
4. Use `getSemanticSkillRecommendations` to recommend development
5. Call `getDevelopmentPlan` to generate a concrete plan
6. Record outcome with `logPlannedTransitions`

### 🤖 Autonomous Agent Workflow (Optional Add-On)

#### 🎯 Goal

Automatically monitor for signals of disengagement or retention risk and activate internal mobility support without manual initiation.

#### 🧠 Triggers (Agent Monitored)

* Drop in engagement metrics or survey responses
* No recent internal applications or development activity
* Time in role exceeds typical progression window
* Underutilisation or skill mismatch with current role
* High performer at risk (based on known patterns)

#### 🔄 Agent Workflow Logic

1. Agent identifies at-risk profile via defined rules or ML model
2. Call `getSuggestedCareerPaths` to generate mobility options
3. Run `getShortlistedRolesForPerson` and `getCapabilityGaps`
4. Call `getSemanticSkillRecommendations` for tailored advice
5. Generate `getDevelopmentPlan`
6. Notify manager or P\&C, optionally pre-fill `logPlannedTransitions`

#### 📌 Notes

* This workflow supplements the user-driven one
* Requires telemetry and integration with engagement/activity systems
* Could trigger nudges to the employee or manager dashboard

### 📊 KPIs for Success

* % of at-risk employees successfully redeployed
* Reduction in voluntary turnover (especially post-probation and end-of-contract)
* Increase in internal moves before contract end
* Time from risk detection to transition planned
* % of development plans executed within 90 days
* Manager satisfaction with internal redeployment experience

### ✅ Outcome

* Enables visibility into internal redeployment options
* Supports career guidance at point of exit risk
* Reduces cost and disruption from unnecessary external hiring

---

This page provides a build-ready plan for implementing Metric 1. Next: Define similar structure for Metric 2 — Reduce External Recruitment Costs.
