## 🎯 Metric 2: Reduce External Recruitment Costs

### 🌐 Workflow Goal

Prioritise internal candidates and talent pool members before advertising roles externally, to reduce spend on external recruitment and agency panels.

### 🧩 Actions & Descriptions

#### `getTalentPoolCandidates` (Implemented in hiring.ts)

* **Purpose:** Retrieve potential candidates who are part of pre-identified internal talent pools.
* **Input:** `roleId`, optional filters (e.g. location, readiness)
* **Output:** List of candidates with tags and scores
* **Used by:** Recruiters, hiring managers, mobility leads

#### `getSimilarInternalCandidates` (Implemented in hiring.ts)

* **Purpose:** Match internal candidates to a role using profile embeddings and skill alignment
* **Input:** `roleId`
* **Output:** Ranked list of internal profiles
* **Used by:** Hiring flow, vacancy intake workflow

#### `getJobReadiness` (Implemented in candidate.ts)

* **Purpose:** Assess how ready a person is to fill a specific role
* **Input:** `profileId`, `roleId`
* **Output:** Readiness score with capability match breakdown
* **Used by:** Talent review panels, shortlist refinement

#### `getShortlistedRolesForPerson` (Implemented in hiring.ts)

* **Purpose:** Reverse-match an internal person to open roles
* **Input:** `profileId`
* **Output:** List of best-fit open roles with matching score
* **Used by:** Candidate dashboard, internal job mobility

#### `getRoleShortlist` *(New - Required)*

* **Purpose:** Return the top internal candidates for a given vacancy based on fit, readiness, and availability
* **Input:** `roleId`
* **Output:** Ranked internal shortlist
* **Used by:** Recruiters during job intake or before panel referral

### 👥 Users

* Recruiters
* Hiring Managers
* People & Culture
* Internal Mobility Advisors

### ⚡ Triggers

* New vacancy created
* Role flagged as difficult to fill
* Business directive to prioritise internal talent
* Internal referral window prior to external advertisement

### 🔗 Combined Workflow Logic

1. New role is created in SAP/PageUp
2. System runs `getTalentPoolCandidates` and `getSimilarInternalCandidates`
3. Use `getJobReadiness` for each match to refine shortlist
4. Call `getRoleShortlist` to finalise top internal candidates
5. Share shortlist with hiring manager before going external

### 📊 KPIs for Success

* % of roles filled internally without external ad or panel
* Reduction in time to hire (internal vs external)
* Cost savings from reduced panel spend
* Hiring manager satisfaction with internal candidate quality
* Increased usage of talent pool functionality

### 🤖 Autonomous Agent Workflow (Optional Add-On)

#### 🎯 Role: Internal Match Agent (Pre-Ad Automation)

Automatically detects new or upcoming roles and proactively generates an internal shortlist before advertising externally.

#### 🧠 Triggers (Agent Monitored)

* New vacancy created in PageUp/SAP
* Backfill or known upcoming vacancy
* Internal referral or "expression of interest" window opens

#### 🔄 Agent Workflow Logic

1. Detects creation of `roleId` or hiring request
2. Runs `getTalentPoolCandidates`, `getSimilarInternalCandidates`
3. Uses `getJobReadiness` to evaluate fit
4. Calls `getRoleShortlist` to finalise shortlist
5. Notifies recruiter and hiring manager
6. Optionally alerts candidates and tags profiles

#### 📌 Notes

* Enables internal-first sourcing policy automation
* Reduces panel dependency and advertising cost
* May be extended with learning from previous successful placements

### ✅ Outcome

* Drives cost-effective recruitment
* Increases mobility and talent visibility
* Builds confidence in internal capability pipeline
* Reduces over-reliance on external sourcing and panels

---

This page defines the structure for implementing Metric 2. Next: Design the workflows and actions for Metric 3 — Reduce Time to Fill.
