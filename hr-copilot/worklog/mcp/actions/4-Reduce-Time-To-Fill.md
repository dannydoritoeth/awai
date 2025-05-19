## 🎯 Metric 3: Reduce Time to Fill

### 🌐 Workflow Goal

Streamline internal processes and leverage pre-qualified talent to reduce the time between vacancy creation and candidate offer.

### 🧩 Actions & Descriptions

#### `getTalentPoolCandidates` (Implemented in hiring.ts)

* **Purpose:** Identify ready-to-move internal candidates from curated talent pools
* **Input:** `roleId`, readiness filters
* **Output:** Candidate list with tags (e.g. "ready now", "EOI submitted")
* **Used by:** Recruiters, hiring coordinators

#### `getSimilarInternalCandidates` (Implemented in hiring.ts)

* **Purpose:** Semantic match between role requirements and employee profiles
* **Input:** `roleId`
* **Output:** Ranked list of internal matches
* **Used by:** Intake or sourcing workflows

#### `getJobReadiness` (Implemented in candidate.ts)

* **Purpose:** Evaluate how close a person is to being ready for a given role
* **Input:** `profileId`, `roleId`
* **Output:** Score + match breakdown
* **Used by:** Candidate comparisons, shortlist validations

#### `getRoleShortlist` *(New - Required)*

* **Purpose:** Auto-generate shortlist for new roles using readiness, match, and availability
* **Input:** `roleId`
* **Output:** Internal shortlist
* **Used by:** Recruiter at intake stage

#### `flagReadinessLevels` *(New - Required)*

* **Purpose:** Assign and maintain readiness scores/tags for individuals based on talent pool engagement and recency of match
* **Input:** `profileId`, `readinessLevel`
* **Output:** Status indicator for use in matching algorithms
* **Used by:** Talent management UI, shortlist automation

#### `getShortlistMatchingTime` *(New - Optional Report)*

* **Purpose:** Track time from role creation to first matched candidate recommendation
* **Input:** `roleId`
* **Output:** Time delta in hours/days
* **Used by:** Recruitment performance dashboards

### 👥 Users

* Recruiters
* Internal Mobility Advisors
* Hiring Managers
* Workforce Planning Analysts

### ⚡ Triggers

* Vacancy marked urgent
* Key role unfilled after X days
* SLA for time-to-shortlist exceeded
* High-priority project dependency on vacant role

### 🔗 Combined Workflow Logic

1. New vacancy enters system
2. Automatically fetch talent pool and internal matches
3. Score matches via `getJobReadiness`
4. Rank and deliver shortlist via `getRoleShortlist`
5. Use `flagReadinessLevels` to prioritize internal outreach
6. Measure cycle time via `getShortlistMatchingTime`

### 📊 KPIs for Success

* Median days from vacancy to offer
* % of roles filled within SLA window
* Time to first shortlist generated
* Recruiter time saved per role
* Improved candidate response time

### 🤖 Autonomous Agent Workflow (Optional Add-On)

#### 🎯 Role: Vacancy Response Agent

Proactively initiates internal search and shortlisting as soon as a vacancy is detected, reducing manual intake delays.

#### 🧠 Triggers (Agent Monitored)

* New job requisition created
* Vacancy marked as urgent or SLA-monitored
* Delays in progressing candidates

#### 🔄 Agent Workflow Logic

1. Detect vacancy creation (`roleId`) from SAP/PageUp
2. Run `getTalentPoolCandidates`, `getSimilarInternalCandidates`
3. Use `getJobReadiness` to score top matches
4. Auto-run `getRoleShortlist` and notify recruiter
5. Optionally flag "ready now" candidates via `flagReadinessLevels`
6. Track `getShortlistMatchingTime` and report delays

#### 📌 Notes

* Helps meet service-level timelines
* Reduces recruiter lag in starting search
* Supports internal-first and talent pool reuse

### ✅ Outcome

* Faster hiring for critical roles
* Improved recruiter efficiency
* Increased use of internal talent pipeline
* Greater agility for project-based hiring

---

This canvas outlines the actions needed to address Metric 3: Reduce Time to Fill. Metric 4 — Improve Workforce Capability Visibility — is next.
