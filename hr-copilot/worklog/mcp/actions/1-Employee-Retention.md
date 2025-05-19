# 🧭 Workforce Mobility Canvas — Metric 1: Employee Retention

## 🎯 Goal

Proactively identify and support at-risk or disengaged employees (including temporary, ongoing, and high-potential staff) to improve retention and internal mobility across the workforce.

---

## 🧩 Key Pathways

### 1. Tactical Internal Mobility Pathway (Immediate Move)

- **Purpose**: Help employees find roles they are mostly ready for and close the remaining gaps.

#### 🔄 Steps
1. `getMatchingRolesForPerson`
2. `getCapabilityGaps`
3. `getSemanticSkillRecommendations`
4. `getDevelopmentPlan`
5. `logPlannedTransitions`

#### 🎯 Triggers
- Contract approaching end
- Disengagement flagged
- Internal mobility interest

### 2. Strategic Career Growth Pathway (Aspirational or Alternate Role)

- **Purpose**: Guide employees toward long-term or alternate roles, even if far from their current path.

#### 🔄 Steps
1. `getSuggestedCareerPaths` or user-selected target role
2. `getCapabilityGaps` (to selected/aspirational role)
3. `getSemanticSkillRecommendations`
4. `getDevelopmentPlan` (multi-stage)
5. `logPlannedTransitions`

#### 🧭 Alternate Career Targeting (New Flow)

- Users can search/select a distant or aspirational role (e.g., "UX Designer")
- System maps path from current role to target:
  - Skills to acquire
  - Suggested learning or training
  - Recommended interim "bridge" roles
  - Mentor or stretch assignment suggestions
- Outputs a staged plan with reachability insight

#### 🎯 Triggers
- Career planning interest
- Disengagement due to stagnation
- Exploration of non-obvious opportunities

---

## ⚙️ Action Descriptions

### `getDevelopmentPlan` *(New - Required)*
- Purpose-built for use after identifying gaps and recommended skills. Consolidates input from `getCapabilityGaps` and `getSemanticSkillRecommendations` to generate a personal development roadmap.

### `getMatchingRolesForPerson`
- Finds internal roles where the employee already meets a high percentage of requirements.

### `getCapabilityGaps`
- Measures difference between the employee’s current capabilities and a target role’s expectations.

### `getSuggestedCareerPaths`
- Uses semantic embeddings and (optionally) user goals to find promising next roles or career pivots.

### `getSemanticSkillRecommendations`
- Recommends targeted skills based on gaps between current profile and selected role.

### `logPlannedTransitions` *(New - Required)*
- Stores a structured record of an intended internal move, optionally linked to a development plan.

---

## 🤖 Autonomous Agent Workflow (Optional)

### 🎯 Goal
Automatically trigger the tactical or strategic workflow when retention risk signals are detected.

### 🧠 Monitored Signals
- Drop in engagement or performance
- Long time in role without development
- High performer at risk
- Underutilisation or role mismatch

### 🔁 Agent Actions
1. Detect signal
2. Call `getSuggestedCareerPaths`
3. Call `getCapabilityGaps`
4. Call `getSemanticSkillRecommendations`
5. Generate `getDevelopmentPlan`
6. Pre-fill `logPlannedTransitions` or notify manager

---

## 📊 KPIs

- % of at-risk employees redeployed
- Voluntary turnover reduction
- Internal mobility before contract end
- Time from risk detection to transition planned
- % of development plans executed in 90 days
- Manager satisfaction with process

---

## ✅ Outcome

- Increased visibility into mobility options
- Scalable career support for all staff
- Lower cost and disruption from turnover

---

## 🛠 Action Reference

#### `getSuggestedCareerPaths` (Enhanced – candidate.ts) 🔮 Uses AI

* **Purpose:** Highlight logical next roles or career pivots, optionally guided by user-entered goals or interests.
* **Input:**
  * `profileId`
  * `goalText?` – optional free-text input (e.g. "interested in sustainability" or "want to move into UX design")
* **Output:**
  * Ranked list of roles with similarity explanation:
    * Matches based on past role/capability history
    * Related to user-entered goal (if provided)
    * Indicates potential career pivots or feeder roles
* **Used by:**
  * P&C teams
  * Career support chatbots
  * Self-service dashboards and development planners

#### `getMatchingRolesForPerson` (Implemented in hiring.ts) 📊 Data Processing

* **Purpose:** Identify internal roles with 70%+ fit
* **Input:** `profileId`, optional filters (location, interests)
* **Output:** Ranked list of suitable internal roles
* **Used by:** Self-service portals, workforce planning

#### `getCapabilityGaps` (Implemented in candidate.ts) 📊 Data Processing

* **Purpose:** Compare a profile to a target role
* **Input:** `profileId`, `roleId`
* **Output:** Capability gaps and severity indicators
* **Used by:** Career planners, dashboards

#### `getSemanticSkillRecommendations` (Implemented in candidate.ts) 🔮 Uses AI

* **Purpose:** Recommend skills based on role gap
* **Input:** `profileId`, `roleId`
* **Output:** Skills + learning suggestions
* **Used by:** Learning & development, LMS

#### `getDevelopmentPlan` (Planned) 🔮 Uses AI

* **Purpose:** Generate a structured learning and career progression roadmap based on known gaps and target role(s).
* **Input:**
  * `profileId`
  * `roleId` – the target role
  * `capabilityGaps` – output from `getCapabilityGaps`
  * `recommendedSkills?` – output from `getSemanticSkillRecommendations`
* **Output:**
  * Development plan including:
    * Skills to acquire
    * Learning resources or microcredentials
    * Suggested bridge roles or stepping stones
    * Internal mentors or training programs
* **Used by:**
  * Employees
  * Managers
  * L&D teams
  * Workforce planning dashboards

#### `logPlannedTransitions` (Planned) 📊 Data Processing

* **Purpose:** Record planned future movement
* **Input:** `profileId`, `plannedRoleId`, `effectiveDate`, `status`
* **Output:** Confirmation and tracking details
* **Used by:** Workforce mobility coordinators
---

## 🌟 Optional Enhancements & Additional Alignment Features

These capabilities further align with DCCEEW's stated goals and may strengthen the solution during the evaluation phase.

### 🧠 Explainability of Matches (Recommended Enhancement)

#### 🔍 Description:
All role matches or capability gap outputs should include a plain-language rationale or explanation. This helps users and decision-makers understand "why" a match was made or a gap identified.

#### ✅ Suggested Field Additions:
- `matchExplanation` for:
  - `getSuggestedCareerPaths`
  - `getMatchingRolesForPerson`
- `gapExplanation` for:
  - `getCapabilityGaps`

### 🆚 Compare Roles Side-by-Side (Optional New Action)

#### `compareRolesSideBySide` (Optional – candidate.ts) 📊 Data Processing

* **Purpose:** Compare two roles to identify differences in capabilities and recommend the most efficient transition path.
* **Input:** `roleIdA`, `roleIdB`
* **Output:**
  * Shared and unique capabilities
  * Estimated gap severity
  * Narrative explanation of differences
* **Used by:** Career planners, workforce mobility advisors

### 📈 Link Suggestions to Real Vacancies (Data Integration Enhancement)

#### 🔍 Description:
Align role suggestions with current open positions in SAP/PageUp to:
- Prioritize actionable moves
- Enable redeployment over recruitment

#### ✅ Implementation Option:
- Add `isVacant` or `vacancyId` fields to outputs of `getSuggestedCareerPaths` and `getMatchingRolesForPerson`

---

## 🛠 Updated Action Reference Notes

#### `getSuggestedCareerPaths` (Enhanced – candidate.ts) 🔮 Uses AI

* **New Output Field:** `matchExplanation` — explains why each role is a relevant suggestion
* **Optional Output Field:** `vacancyId` — links to current matching openings

#### `getMatchingRolesForPerson` (Implemented in hiring.ts) 📊 Data Processing

* **New Output Field:** `matchExplanation`
* **Optional Output Field:** `vacancyId`

#### `getCapabilityGaps` (Implemented in candidate.ts) 📊 Data Processing

* **New Output Field:** `gapExplanation` — describes key capability differences from target role