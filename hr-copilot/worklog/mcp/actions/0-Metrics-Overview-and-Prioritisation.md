## 🧩 Metrics Overview and Prioritisation

This canvas maps **DCCEEW’s desired outcomes** to the user workflows and MCP actions. Metrics are now reordered based on **potential business impact**, from greatest to least.

Each includes a short summary and rationale to guide prioritisation, funding, and sequencing.

---

### 🔝 Prioritised Key Metrics → Workflows → Value

#### 1. **Employee Retention**

* **Why it matters:** Retaining at-risk (especially temporary) staff avoids churn, protects IP, and reduces recruitment load.
* **Potential value:** 10–20% reduction in temp staff turnover → \$2M+ saved p.a.
* **Core actions:** `getShortlistedRolesForPerson`, `getCapabilityGaps`, `getSuggestedCareerPaths`, `getSemanticSkillRecommendations`, `logPlannedTransitions`

#### 2. **Redundancy Cost Avoidance**

* **Why it matters:** Proactively reassigning permanent staff avoids payout costs and maintains workforce continuity.
* **Potential value:** Saving \$50K–\$150K per avoided redundancy event
* **Core actions:** `getSuggestedCareerPaths`, `getCapabilityGaps`, `getDevelopmentPlan`, `logPlannedTransitions`

#### 3. **Reduce External Recruitment Costs**

* **Why it matters:** Filling roles internally lowers cost, improves speed, and improves staff engagement.
* **Potential value:** \~\$5K–\$10K saved per role avoided from panel
* **Core actions:** `getRoleShortlist`, `getTalentPoolCandidates`, `getSimilarInternalCandidates`, `getJobReadiness`

#### 4. **Reduce Time to Fill**

* **Why it matters:** Faster hires = reduced project delay + reduced cost of vacancy
* **Potential value:** Each day of vacancy avoided in critical roles = \$1K–\$5K in delivery value recovered
* **Core actions:** `getTalentPoolCandidates`, `flagReadinessLevels`, `getJobReadiness`, `getRoleShortlist`

#### 5. **Optimise Internal Talent Processes**

* **Why it matters:** Saves time, removes friction, improves employee experience
* **Potential value:** 1000s of hours saved + better adoption of internal mobility workflows
* **Core actions:** `getShortlistedRolesForPerson`, `getDevelopmentPlan`, `logPlannedTransitions`

#### 6. **Strengthen Succession Planning**

* **Why it matters:** Ensures continuity for critical roles and strengthens leadership pipeline
* **Potential value:** Prevents urgent external exec hiring (\$100K+ per mistake)
* **Core actions:** `getCapabilityReadinessScores`, `buildSuccessionBench`, `getDevelopmentPlan`

#### 7. **Support Equitable Talent Decisions**

* **Why it matters:** Builds trust, improves fairness, supports participation and compliance
* **Potential value:** Improved culture, less bias risk, greater L\&D uptake across groups
* **Core actions:** `getProfileContext`, `getJobReadiness`, `getAnalyticsSummary`, `getCapabilityReadinessScores`

#### 8. **Enable Data-Driven Workforce Strategy**

* **Why it matters:** Ensures exec decisions are grounded in real workforce data
* **Potential value:** Reduces cost of poor planning, improves capability investment ROI
* **Core actions:** `getCapabilityHeatmap`, `getForecastingInsights`, `generateForecastPlan`, `getAnalyticsSummary`

#### 9. **Improve Workforce Capability Visibility**

* **Why it matters:** A foundational layer for all other workflows to be useful
* **Potential value:** Unlocks other metrics (e.g. readiness, redeployment, planning)
* **Core actions:** `getProfileContext`, `getCapabilityHeatmap`, `getSkillGaps`, `compareTeamCapabilities`

---

### 📌 Use This Canvas To:

* Prioritise your roadmap
* Allocate implementation budget and effort
* Communicate value to executive sponsors
* Anchor future stakeholder workshops and planning

---

This canvas is a living framework. Review it quarterly or when strategic needs evolve.
