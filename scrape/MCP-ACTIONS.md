✅ Updated MCP Action Summary (With Capabilities)
👤 For Profiles (Users)
| Action                                       | Description                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `getProfileContext(profileId)`               | Load full profile details, including skills, capabilities, interests       |
| `getSuggestedCareerPaths(profileId)`         | Show top-matching CareerPaths from current or nearby roles                 |
| `getRecommendedJobs(profileId)`              | Suggest live Jobs based on capability fit and interest history             |
| `getCapabilityGaps(profileId, targetRoleId)` | Compare Profile vs. Role capabilities for readiness scoring                |
| `getSkillGaps(profileId, targetRoleId)`      | Show granular technical skill gaps if Role has defined RoleSkills          |
| `expressInterestInPath(profileId, pathId)`   | Log that a user is interested in a suggested CareerPath                    |
| `uploadResume(profileId)`                    | Parse resume text to infer Skills, Capabilities, and possible current Role |
| `updateCapability(profileId, capabilityId)`  | Add or edit a self-assessed capability with level or evidence              |
| `rateJobFit(profileId, jobId)`               | Show readiness or suitability score for a specific Job                     |
| `compareToPeerProfiles(profileId)`           | Benchmark a profile's strength and weaknesses against peer set             |


🧱 For Roles
| Action                                | Description                                                               |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `getRoleDetail(roleId)`               | Return Role title, description, capabilities, accountabilities, structure |
| `getMatchingProfiles(roleId)`         | List top-matching Profiles by capability/skill similarity                 |
| `getCareerPathsFrom(roleId)`          | Show outward transitions (where people often go *from* this role)         |
| `getCareerPathsTo(roleId)`            | Show inbound transitions (who is likely to move *into* this role)         |
| `updateRoleCapabilities(roleId)`      | Add or revise capability matrix for the Role                              |
| `addCareerPath(fromRoleId, toRoleId)` | Define or approve a CareerPath (manual or AI-aided)                       |
| `getRoleDocumentSet(roleId)`          | Retrieve all attached documents for this Role                             |
| `getSuccessorCandidates(roleId)`      | List Profiles most ready to take over this Role                           |


📢 For Jobs
| Action                                        | Description                                                     |
| --------------------------------------------- | --------------------------------------------------------------- |
| `postJob(roleId, metadata)`                   | Create a new Job posting tied to an existing Role definition    |
| `getOpenJobs(roleId?)`                        | List current vacancies, optionally filtered by Role or Division |
| `matchProfilesToJob(jobId)`                   | Show top-ranked Profiles for this Job using full match logic    |
| `getJobReadiness(profileId, jobId)`           | Assess how prepared a Profile is to apply or succeed in the Job |
| `highlightRoleCapabilities(jobId)`            | Extract and show emphasized Capabilities in a Job posting       |
| `trackJobInteraction(profileId, jobId, type)` | Log clicks, saves, applications, interest                       |


🤖 For Agents / System Actions
| Action                                          | Description                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `scoreProfileFit(profileId, roleId)`            | Generate a numerical + semantic match score between Profile and Role |
| `inferCapabilitiesFromResume(profileId)`        | Use AI to tag public sector-style capabilities from freeform resume  |
| `suggestCareerPaths()`                          | Periodic AI-generated new Role→Role transitions for guidance         |
| `embedContext(entityType, entityId)`            | Generate vector embeddings for AI search & retrieval                 |
| `logAgentAction(entityType, entityId, payload)` | Save structured interaction history with timestamp                   |
| `nudge(profileId, targetType, targetId)`        | Send a prompt (e.g. “explore this job” or “fill in skills”)          |


🧩 Advanced / Optional
| Action                                   | Description                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `trackLearningPath(profileId)`           | Recommend upskilling modules based on skills/capabilities not yet mastered |
| `compareProfiles(profileA, profileB)`    | Compare two candidates side-by-side (succession/selection use case)        |
| `summarizeProfileFit(profileId, roleId)` | Generate a plain-English fit summary for use in coaching or chatbots       |
| `generateRoleSummary(roleId)`            | Create a concise summary of Role expectations (for job seekers)            |
| `generateCareerNarrative(profileId)`     | Draft a story arc based on current → target roles, showing growth path     |



✅ Recommended Actions for Gap Detection & Structural Inference
🧠 For Structural Insight
| Action                                   | Description                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `analyzeDivisionCoverage(divisionId)`    | Return summary of roles, jobs, capability coverage, grade spread                     |
| `suggestMissingRoles(divisionId)`        | Infer potentially missing roles based on job patterns or inter-division comparisons  |
| `suggestMissingCapabilities(divisionId)` | Identify capabilities underrepresented vs. known cluster norms                       |
| `clusterRoleComparison(clusterId)`       | Compare role distribution and capability presence across divisions in a cluster      |
| `analyzeJobRoleMismatch(jobId)`          | Check if job duties/capabilities align with the linked role, flag mismatch           |
| `inferRoleVariants(roleId)`              | Identify if a role likely has variants (e.g., by grade or function) that are missing |


💡 For Metadata Health & Completeness
| Action                         | Description                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `getDataCompletenessSummary()` | For all entities, list % with missing key fields (e.g., capability matrix, gradeBand)       |
| `flagIncompleteRoles()`        | Return list of roles with missing core fields like key accountabilities, focus capabilities |
| `flagJobsWithUnlinkedRoles()`  | Detect jobs not associated with any role (or linked generically)                            |
| `inferDivisionFromJob(jobId)`  | Suggest correct division if job’s metadata is incomplete or ambiguous                       |

🧩 Nice-to-Have (Analyst / Admin Support)
| Action                                              | Description                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `logInferredRoleGap(divisionId, roleTitle, reason)` | Save suggested role into a `SuggestedRole` table for analyst review            |
| `rankDivisionAnomalies()`                           | Return top divisions with most signs of structural gaps or metadata mismatches |
