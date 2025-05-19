## 🎯 Metric 2: Redundancy Cost Avoidance

### 🌐 Workflow Goal

Prevent unnecessary terminations of ongoing staff by proactively identifying redeployment opportunities before formal redundancy occurs.

---

## 🧩 Pathways

### 1. Tactical Redeployment Pathway (Immediate Fit)

- **Purpose**: Find current internal vacancies the employee could fill with little to no upskilling.

#### 🔄 Steps
1. `getShortlistedRolesForPerson` 📊 Data Processing
2. `getCapabilityGaps` 📊 Data Processing
3. `getDevelopmentPlan` 🔮 Uses AI
4. `logPlannedTransitions` 📊 Data Processing

#### 🎯 Trigger Scenarios
- Staff with no assignment past project end
- Role flagged for removal or funding expiry
- Redeployment required within tight timeframes

### 2. Strategic Career Pivot Pathway (Broader Opportunity)

- **Purpose**: Explore long-term or alternate roles for employees affected by changes or realignment.

#### 🔄 Steps
1. `getSuggestedCareerPaths` 🔮 Uses AI
2. `getCapabilityGaps` 📊 Data Processing
3. `getDevelopmentPlan` 🔮 Uses AI
4. `logPlannedTransitions` 📊 Data Processing

#### 🎯 Trigger Scenarios
- Redeployment required, but immediate matches are limited
- Long-term transformation or realignment
- Aspirational redeployment

---

## 🛠 Action Reference

#### `getShortlistedRolesForPerson` (Implemented in hiring.ts) 📊 Data Processing

* **Purpose:** Identify internal vacancies that the employee is at least partially suited for
* **Input:** `profileId`
* **Output:** Ranked list of internal opportunities
* **Used by:** P&C, mobility leads, HRBPs

#### `getCapabilityGaps` (Implemented in candidate.ts) 📊 Data Processing

* **Purpose:** Show what development is required to shift into a target role
* **Input:** `profileId`, `roleId`
* **Output:** Gap list
* **Used by:** Upskilling analysis and redeployment readiness

#### `getSuggestedCareerPaths` (Implemented in candidate.ts) 🔮 Uses AI

* **Purpose:** Highlight logical transition paths
* **Input:** `profileId`, optionally `goalText`
* **Output:** Feeder roles or pivots with match explanation
* **Used by:** P&C teams, impacted employees

#### `getDevelopmentPlan` *(New - Reused)* 🔮 Uses AI

* **Purpose:** Build capability development roadmap to support transition
* **Input:** 
  * `profileId`, `roleId`  
  * `capabilityGaps` (from `getCapabilityGaps`)  
  * `recommendedSkills?` (from `getSemanticSkillRecommendations`, if used)
* **Output:** Personalised upskilling plan
* **Used by:** L&D, mobility support

#### `logPlannedTransitions` *(New - Reused)* 📊 Data Processing

* **Purpose:** Track intended redeployments with dates and approval
* **Input:** `profileId`, `roleId`, `status`, `effectiveDate`
* **Output:** Logged transition plan
* **Used by:** P&C, audit, planning

---

## 👥 Users

* P&C Business Partners
* People Leaders
* HR Coordinators
* Redeployment Coordinators

---

## ⚡ Triggers

* Restructure or cost reduction plan approved
* Role flagged for removal or funding expiry
* Staff with no future assignment beyond project date

---

## 🔗 Combined Workflow Logic

1. P&C flags impacted employee
2. Run `getSuggestedCareerPaths` or `getShortlistedRolesForPerson`
3. Review fit using `getCapabilityGaps`
4. Create support plan via `getDevelopmentPlan`
5. Log movement attempt via `logPlannedTransitions`
6. Track outcome and measure redeployment success

---

## 📊 KPIs for Success

* % of impacted staff redeployed successfully
* Reduction in redundancy-related terminations
* Time from flag to redeployment confirmation
* Cost savings from avoided payouts
* Satisfaction of impacted staff with redeployment support

---

## 🤖 Autonomous Agent Workflow (Optional Add-On)

### 🎯 Role: Redeployment Trigger Agent

Proactively detects roles at risk of termination and surfaces internal options for affected staff.

### 🧠 Triggers (Agent Monitored)

* Role flagged for deletion or project closure
* End-of-contract milestone within 60 days and no future assignment
* Staff assigned to roles with expiring funding

### 🔄 Agent Workflow Logic

1. Identify at-risk employees based on job/funding metadata
2. Auto-run `getShortlistedRolesForPerson` or `getSuggestedCareerPaths`
3. Use `getCapabilityGaps` to highlight reskill potential
4. Generate draft `getDevelopmentPlan`
5. Notify mobility team and log potential path in `logPlannedTransitions`

### 📌 Notes

* Reduces reactive HR response to job loss
* Strengthens just-in-time internal workforce reallocation

---

## ✅ Outcome

* Fewer forced separations  
* Greater agility in staff movement  
* Improved financial efficiency in workforce management  
* Higher trust in internal support during change