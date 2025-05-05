✅ Updated MCP Action Summary (With Capabilities)
👤 For Profiles (Users)
Action	Description
getProfileContext(profileId)	Load profile details, capabilities, skills, interests
getSuggestedCareerPaths(profileId)	Show best-fit career paths based on capability match
getRecommendedJobs(profileId)	Suggest live jobs based on role match and readiness
getCapabilityGaps(profileId, targetRoleId)	Compare profile vs. role capability requirements
getSkillGaps(profileId, targetRoleId)	Compare granular skill gaps for technical roles
expressInterestInPath(profileId, pathId)	Log user interest in moving toward a role
uploadResume(profileId)	Parse and infer skills or capabilities from text
updateCapability(profileId, capabilityId)	Add/update self-assessed capability level

🧱 For Roles
Action	Description
getRoleDetail(roleId)	Return required capabilities, division, and description
getMatchingProfiles(roleId)	Find top-fit profiles by capability + skill match
getCareerPathsFrom(roleId)	View all potential mobility paths from this role
getCareerPathsTo(roleId)	See incoming paths that land at this role
updateRoleCapabilities(roleId)	Modify required capability set
addCareerPath(fromRoleId, toRoleId)	Define or confirm valid internal mobility path

📢 For Jobs
Action	Description
postJob(roleId, metadata)	Create a job tied to a role with structured data
getOpenJobs(roleId?)	List open positions (optionally filtered by role)
matchProfilesToJob(jobId)	Recommend internal candidates based on fit
getJobReadiness(profileId, jobId)	Score candidate’s alignment with job requirements
highlightRoleCapabilities(jobId)	Show capability emphasis in job ads (if present)

🤖 For Agents / System Actions
Action	Description
scoreProfileFit(profileId, roleId)	AI scoring engine compares profile to role capability matrix
inferCapabilitiesFromResume(profileId)	AI tags profile with PSC-style capabilities
logAgentAction(entityType, entityId, payload)	Save scored match, reasoning, and timestamp
suggestCareerPaths()	Periodic agent generation of new Role→Role paths
embedContext(entityType, entityId)	Generate and store vector embeddings for AI search/retrieval

🧩 Advanced / Optional
Action	Description
trackLearningPath(profileId)	Recommend upskilling modules based on capability gap
compareProfiles(profileA, profileB)	Useful for HR or AI to benchmark candidates
findSuccessorCandidates(roleId)	Succession planning view based on readiness & interest
summarizeProfileFit(profileId, roleId)	Natural language justification of fit for AI/chat responses