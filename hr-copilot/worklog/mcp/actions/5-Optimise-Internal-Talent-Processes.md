## 🎯 Metric 6: Optimise Internal Talent Processes

### 🌐 Workflow Goal

Automate and streamline repetitive talent operations to reduce manual effort, improve consistency, and increase speed of internal mobility workflows.

### 🧩 Actions & Descriptions

#### `getShortlistedRolesForPerson` (Implemented in hiring.ts)

* **Purpose:** Match a profile to open roles within the organisation
* **Input:** `profileId`
* **Output:** Ranked list of internal job opportunities
* **Used by:** Employee dashboards, career mobility tools

#### `getJobReadiness` (Implemented in candidate.ts)

* **Purpose:** Score how ready a candidate is for a given role
* **Input:** `profileId`, `roleId`
* **Output:** Readiness score with capability gap breakdown
* **Used by:** Internal hiring workflow, matching engines

#### `getCapabilityGaps` (Implemented in candidate.ts)

* **Purpose:** Identify skill or capability gaps for role transitions
* **Input:** `profileId`, `roleId`
* **Output:** List of capabilities to develop
* **Used by:** Learning and development, talent operations

#### `getDevelopmentPlan` *(New - Required)*

* **Purpose:** Generate personalised upskilling plan from gaps
* **Input:** `profileId`, `roleId`
* **Output:** Learning plan with goals, training, mentors, milestones
* **Used by:** LMS integration, career planning

#### `logPlannedTransitions` *(New - Required)*

* **Purpose:** Record a planned move from one role to another
* **Input:** `profileId`, `roleId`, `effectiveDate`, `status`
* **Output:** Transition record for workforce tracking
* **Used by:** People & Culture, managers, internal mobility tracking

### 👥 Users

* People & Culture
* Talent Acquisition Coordinators
* Employees
* Hiring Managers

### ⚡ Triggers

* Internal application received
* Manager initiates a transfer or promotion
* Employee completes upskilling plan
* Internal talent campaign or mobility window opens

### 🔗 Combined Workflow Logic

1. Internal application or nomination triggers `getShortlistedRolesForPerson`
2. Use `getJobReadiness` and `getCapabilityGaps` to assess fit
3. Generate plan via `getDevelopmentPlan`
4. Upon confirmation, log move with `logPlannedTransitions`

### 📊 KPIs for Success

* % of internal moves recorded and tracked
* Reduction in manual coordination effort (handoffs, spreadsheets)
* Time from interest to internal transfer completed
* Employee satisfaction with internal mobility process
* Decrease in duplicate manual effort (e.g. re-entering data)

### 🤖 Autonomous Agent Workflow (Optional Add-On)

#### 🎯 Role: Internal Mobility Automation Agent

Monitors mobility signals and automates internal job matching, readiness assessment, and transition tracking without manual intervention.

#### 🧠 Triggers (Agent Monitored)

* Employee completes key upskilling milestone
* High readiness score detected for a new vacancy
* Manager flags employee for rotation or development
* New internal opportunities arise that match known interests

#### 🔄 Agent Workflow Logic

1. Detect profile signals (e.g. completed learning, engagement)
2. Automatically run `getShortlistedRolesForPerson`
3. Assess fit with `getJobReadiness` and `getCapabilityGaps`
4. Generate personalised `getDevelopmentPlan` if needed
5. Auto-suggest transitions and log outcomes with `logPlannedTransitions`
6. Notify employee and manager with contextual guidance

#### 📌 Notes

* Supports proactive development and transition planning
* Reduces reliance on managers and coordinators to drive the process
* Strengthens system-driven internal talent mobility

### ✅ Outcome

* Faster, simpler internal mobility experience
* Consistent process across teams and divisions
* Improved visibility of mobility pipeline and progress
* Greater alignment between talent operations and employee experience

---

Next: Metric 7 — Enable Data-Driven Workforce Strategy.
