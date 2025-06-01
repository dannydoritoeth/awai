## 🎯 Metric 4: Improve Workforce Capability Visibility

### 🌐 Workflow Goal

Enable organisation-wide visibility into employee skills, experience, qualifications, and workforce distribution to support strategic planning and decision-making.

### 🧩 Actions & Descriptions

#### `getProfileContext` (Implemented in candidate.ts)

* **Purpose:** Retrieve a structured capability and skills profile for an individual
* **Input:** `profileId`
* **Output:** Profile object including embeddings, declared/verified skills, qualifications, history
* **Used by:** Talent reviewers, internal profile viewers, matching workflows

#### `getCapabilityHeatmap` (Implemented in analyst.ts)

* **Purpose:** Aggregate and visualise capability coverage by division, team, taxonomy
* **Input:** `taxonomy` or `capabilityGroup`
* **Output:** Percentage coverage + gaps
* **Used by:** Strategy, L\&D, capability managers

#### `getAnalyticsSummary` (Implemented in analyst.ts)

* **Purpose:** Generate high-level metrics across profiles and capabilities
* **Input:** Filter options (org unit, date range, tags)
* **Output:** Summary report with counts, ratios, and time-based trends
* **Used by:** Dashboards, executive reporting

#### `compareTeamCapabilities` *(New - Required)*

* **Purpose:** Compare capabilities of multiple team members against a standard or target role
* **Input:** `teamProfileIds`, `referenceRoleId`
* **Output:** Gap analysis per person and team-wide summary
* **Used by:** Team leads, org design analysts

#### `getCapabilitySnapshot` *(New - Required)*

* **Purpose:** Snapshot capability distribution across business units
* **Input:** None or organisational hierarchy level
* **Output:** JSON/map-style structure summarising capabilities held, gaps, and distribution
* **Used by:** Planning tools, quarterly review packs

### 👥 Users

* Executive Leadership
* People & Capability
* L\&D Leads
* Division Managers
* Strategic Workforce Planners

### ⚡ Triggers

* Org restructure or strategic planning window
* Capability uplift investment planning
* Annual review or audit cycle
* Leadership offsite or capability briefing

### 🔗 Combined Workflow Logic

1. Load individual and team profiles with `getProfileContext`
2. Aggregate org-level view via `getCapabilityHeatmap` and `getAnalyticsSummary`
3. Use `compareTeamCapabilities` to identify gaps by business unit
4. Run `getCapabilitySnapshot` to export for planning or reporting

### 📊 KPIs for Success

* % of workforce with validated skills profiles
* Frequency of capability reporting use in planning meetings
* Time taken to generate workforce insights
* Coverage across critical capability groups
* Executive satisfaction with capability reporting

### 🤖 Autonomous Agent Workflow (Optional Add-On)

#### 🎯 Role: Capability Intelligence Agent

Continuously monitors workforce data to maintain up-to-date capability heatmaps and trigger alerts or insights for decision-makers.

#### 🧠 Triggers (Agent Monitored)

* New employee profiles created or updated
* Capability gaps detected across key business units
* Strategic initiative launched requiring capability review
* Scheduled cadence (e.g., weekly, monthly refresh)

#### 🔄 Agent Workflow Logic

1. Detect profile or workforce changes (e.g. new hire, training completion)
2. Auto-refresh `getCapabilityHeatmap` and `getAnalyticsSummary`
3. Identify areas below coverage thresholds or at-risk teams
4. Call `getCapabilitySnapshot` and generate alerts or export packs
5. Notify workforce planners, capability leads, or execs with summaries

#### 📌 Notes

* Keeps strategic dashboards fresh without manual refresh
* Allows data-driven response to changing workforce conditions
* Enables just-in-time leadership insights

### ✅ Outcome

* Creates a shared view of workforce capability
* Supports proactive planning, budget prioritisation, and L\&D focus
* Improves trust in internal mobility and promotion decisions
* Reduces duplicated or anecdotal capability assessments

---

Next: Metric 5 — Strengthen Succession Planning Capability.
