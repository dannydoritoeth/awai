Profile
  └── has many Skills (via ProfileSkill)
  └── may have inferred or recommended Capabilities
  └── may have CareerPath interests (via ProfileCareerPath)

Role
  └── belongs to Division
  └── has many Capabilities (via RoleCapability)
  └── may have Skills (optional, for technical roles)
  └── is source or target in CareerPaths
  └── has KeyAccountabilities, Challenges, Requirements
  └── is linked to many Jobs

Job
  └── belongs to Role
  └── has open/close dates, conditions, location, recruiter
  └── may highlight capabilities or skills (optional)

Capability
  └── has name, group, level, source_framework
  └── linked to Role (via RoleCapability)
  └── linked to Profile (via ProfileCapability if needed)

Skill
  └── optional — useful for more granular, technical roles

CareerPath
  └── links Role to Role
  └── may be tagged by transition type (e.g. lateral, upward)

AgentAction
  └── logs match scores, recommendations, skill inferences, gaps

Division
  └── owns many Roles, may be structured hierarchically
