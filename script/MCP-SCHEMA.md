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



Job
| Field                        | Maps To                               |
| ---------------------------- | ------------------------------------- |
| `title`                      | `Job.title`                           |
| `postingDate`, `closingDate` | `Job.openDate`, `Job.closeDate`       |
| `department`, `organization` | `Job.department` / via `Division`     |
| `locations`                  | `Job.location[]`                      |
| `jobType`                    | `Job.workType`                        |
| `jobId`                      | `Job.externalId`                      |
| `jobUrl`                     | `Job.sourceUrl`                       |
| `remuneration`               | `Job.gradeBand` or `Job.remuneration` |
| `contactInfo`                | `Job.recruiter` (embedded)            |
| `documents`                  | `Job.roleDocument[]`                  |

Role
| Field                         | Maps To / Purpose                                                                |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `title`                       | `Role.title` – Role name (e.g. "Director Regulatory Initiatives")                |
| `roleId`                      | `Role.roleId` – Unique ID (from filename, jobId, or URL param)                   |
| `gradeBand`                   | `Role.gradeBand` – Pay level or classification band                              |
| `division`                    | `Division.name` – Organisational unit this role belongs to                       |
| `cluster`                     | `Division.cluster` – Higher-level grouping of divisions (NSW cluster structure)  |
| `agency`                      | `Division.agency` – Agency responsible for the role                              |
| `location`                    | `Role.location` – Primary office or hybrid info (can be free text or normalized) |
| `anzscoCode`                  | `Role.anzscoCode` – Optional occupational code                                   |
| `pcatCode`                    | `Role.pcatCode` – Public sector classification code                              |
| `dateApproved`                | `Role.dateApproved` – When the role was defined or updated                       |
| `primaryPurpose`              | `Role.primaryPurpose` – One-paragraph summary                                    |
| `keyAccountabilities[]`       | `Role.keyAccountabilities` – Bullet list of major duties                         |
| `keyChallenges[]`             | `Role.keyChallenges` – Bullet list of known or expected challenges               |
| `essentialRequirements[]`     | `Role.essentialRequirements` – Any mandatory skills, qualifications, experience  |
| `focusCapabilities[]`         | `RoleCapability[]` (type: "focus") – Assessed capabilities (name + level)        |
| `complementaryCapabilities[]` | `RoleCapability[]` (type: "complementary") – Secondary/optional capabilities     |
| `reportingLine`               | `Role.reportingLine` – Who this role reports to                                  |
| `directReports`               | `Role.directReports` – Who this role manages (if any)                            |
| `budgetResponsibility`        | `Role.budgetResponsibility` – Budget oversight responsibilities                  |
| `sourceDocumentUrl`           | `Role.sourceDocumentUrl` – Original PDF/DOC URL for traceability                 |

Profile
| Field                   | Maps To / Purpose                                                              |
| ----------------------- | ------------------------------------------------------------------------------ |
| `profileId`             | `Profile.profileId` – Unique ID for this user/candidate                        |
| `name`                  | `Profile.name` – Full name or preferred name (if public)                       |
| `email`                 | `Profile.email` – Optional contact (for logged-in or known users)              |
| `currentRole`           | `Profile.currentRole` – Free text or foreign key to `Role` (if known)          |
| `division`              | `Profile.division` – Optional, inferred from org unit                          |
| `skills[]`              | `ProfileSkill[]` – List of linked skills with optional self-rating or evidence |
| `careerPathInterests[]` | `ProfileCareerPath[]` – Roles or paths they’re exploring or have chosen        |
| `recommendations[]`     | `AgentAction[]` – Recommendations by AI or human agents                        |
| `capabilityGaps[]`      | Derived – Based on difference between profile and selected/target role         |
| `agentInteractions[]`   | `AgentAction[]` – History of interactions with the AI or coaching agents       |
| `lastActive`            | `Profile.lastActive` – Last interaction timestamp                              |
| `createdAt`             | `Profile.createdAt` – When the profile was first created                       |
| `updatedAt`             | `Profile.updatedAt` – Last updated timestamp                                   |


Capability
| Field                  | Maps To / Purpose                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `capabilityId`         | `Capability.capabilityId` – Unique ID or slug for this capability                                                        |
| `name`                 | `Capability.name` – Capability name (e.g. “Deliver Results”)                                                             |
| `group`                | `Capability.group` – One of: `Personal Attributes`, `Relationships`, `Results`, `Business Enablers`, `People Management` |
| `description`          | `Capability.description` – Summary of what the capability entails                                                        |
| `levels[]`             | `CapabilityLevel[]` – List of defined behavioral indicators per level                                                    |
| `sourceFramework`      | `Capability.sourceFramework` – e.g., `"NSW Capability Framework v3.0"`                                                   |
| `isOccupationSpecific` | `Capability.isOccupationSpecific` – True if tied to a specialist stream                                                  |
| `createdAt`            | `Capability.createdAt` – When added to the system                                                                        |
| `updatedAt`            | `Capability.updatedAt` – Last update timestamp                                                                           |

CapabilityLevel
| Field                    | Purpose                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `level`                  | e.g. `Foundational`, `Intermediate`, `Adept`, `Advanced`, `Highly Advanced` |
| `behavioralIndicators[]` | List of example behaviors at that level                                     |
| `summary`                | One-line description of what this level looks like                          |

Skill
| Field                  | Maps To / Purpose                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `skillId`              | `Skill.skillId` – Unique ID or slug for the skill                                      |
| `name`                 | `Skill.name` – Human-readable name (e.g. "Data Analysis", "Stakeholder Engagement")    |
| `category`             | `Skill.category` – Optional grouping (e.g. "Technical", "Communication", "Leadership") |
| `description`          | `Skill.description` – Plain-English explanation of what the skill involves             |
| `source`               | `Skill.source` – Where the skill came from (e.g., inferred, curated, framework)        |
| `isOccupationSpecific` | `Skill.isOccupationSpecific` – True if domain-specific                                 |
| `createdAt`            | `Skill.createdAt` – Timestamp when added                                               |
| `updatedAt`            | `Skill.updatedAt` – Last updated timestamp                                             |

CareerPath
| Field                  | Maps To / Purpose                                                                 |
| ---------------------- | --------------------------------------------------------------------------------- |
| `careerPathId`         | `CareerPath.careerPathId` – Unique ID for the path                                |
| `sourceRoleId`         | FK to `Role.roleId` – The role a person would typically move *from*               |
| `targetRoleId`         | FK to `Role.roleId` – The role a person would typically move *to*                 |
| `pathType`             | `"inferred"` or `"curated"` – How the path was established                        |
| `recommendedBy`        | Name of AI agent, analyst, or system that suggested the path (if known)           |
| `supportingEvidence[]` | Optional – List of documents, examples, or datasets backing the transition        |
| `popularityScore`      | Optional – Numeric value indicating frequency of this transition in your data     |
| `skillGapSummary`      | Optional – Summary of skills/capabilities typically needed to make the transition |
| `createdAt`            | `CareerPath.createdAt` – When the path was first generated                        |
| `updatedAt`            | `CareerPath.updatedAt` – Last update timestamp                                    |

ActionAction
| Field             | Maps To / Purpose                                                                  |
| ----------------- | ---------------------------------------------------------------------------------- |
| `actionId`        | `AgentAction.actionId` – Unique ID for the action                                  |
| `agentName`       | Name of the agent (e.g. `"CareerGPT"`, `"HRAdmin"`)                                |
| `actionType`      | Type of action performed (e.g. `"recommend-role"`, `"highlight-gap"`, `"chat"`)    |
| `targetType`      | What the action applies to: `"Profile"`, `"Role"`, `"Job"`, `"CareerPath"`         |
| `targetId`        | ID of the entity the action references (e.g. `profileId`, `jobId`, etc.)           |
| `outcome`         | Summary of what the action achieved (e.g. "accepted", "dismissed", "viewed")       |
| `payload`         | Optional JSON object storing detailed input/output of the action                   |
| `timestamp`       | When the action occurred                                                           |
| `confidenceScore` | Optional numeric (0–1) if AI-generated; shows certainty in recommendation          |
| `sessionId`       | Optional ID to group related interactions (e.g. a live chat or onboarding journey) |

Examples of actionType Values
| Action Type           | Purpose Example                                          |
| --------------------- | -------------------------------------------------------- |
| `recommend-role`      | Suggests a Role to a Profile                             |
| `highlight-gap`       | Notifies a user about missing skills for a target Role   |
| `suggest-career-path` | Recommends a `CareerPath` transition                     |
| `rate-suitability`    | Evaluates match between Profile and Role or Job          |
| `chat`                | Captures freeform agent interaction                      |
| `confirm-skill`       | Adds or validates a skill on a Profile                   |
| `nudge`               | Sends a prompt to explore jobs, complete a profile, etc. |


Related Tables
| Join Table          | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `ProfileSkill` | Links a `Profile` to a `Skill` with optional rating, evidence, or recency              |
| `RoleSkill`    | Links a `Role` to a `Skill`, used in skill matching and capability modeling            |
| `JobSkill`     | Optional – links specific `Job` postings to `Skills` (if granular requirements listed) |
| `ProfileCareerPath` | Links a `Profile` to an expressed or inferred interest in a path |
| `ProfileCareerPath`     | Links a `Profile` to an expressed or inferred interest in a path             |
| `ProfileSkill`          | Links a `Profile` to a `Skill` with optional rating, evidence, or recency    |
| `RoleSkill`             | Links a `Role` to a `Skill`, used in skill matching and capability modeling  |
| `JobSkill`              | (Optional) Links a `Job` to specific `Skills` if listed in posting           |
| `ProfileCapability`     | Links a `Profile` to a `Capability`, enabling gap analysis or assessments    |
| `RoleCapability`        | Links a `Role` to `Capabilities` (focus and complementary separately tagged) |
| `ProfileJobInteraction` | Tracks which `Jobs` a `Profile` has viewed, saved, applied to, etc.          |
| `ProfileAgentAction`    | Explicitly links a `Profile` to its `AgentActions` for fast retrieval        |
| `RoleDocument`          | Links a `Role` to multiple related documents (PDFs, briefs, criteria)        |
| `JobDocument`           | Links a `Job` to one or more supporting documents (e.g. role description)    |

Many to Many Join Tables
| Join Table              | Entity A    | Entity B       | Notes                                                                   |
| ----------------------- | ----------- | -------------- | ----------------------------------------------------------------------- |
| `ProfileSkill`          | `profileId` | `skillId`      | A profile can have many skills; a skill can appear in many profiles     |
| `RoleSkill`             | `roleId`    | `skillId`      | A role may require many skills; a skill can apply to many roles         |
| `JobSkill`              | `jobId`     | `skillId`      | Optional: granular skill requirements for specific jobs                 |
| `ProfileCapability`     | `profileId` | `capabilityId` | Tracks which capabilities a person has (assessed, inferred, self-rated) |
| `RoleCapability`        | `roleId`    | `capabilityId` | A role needs many capabilities; each capability spans many roles        |
| `ProfileCareerPath`     | `profileId` | `careerPathId` | A person may be exploring multiple paths; a path may interest many      |
| `ProfileJobInteraction` | `profileId` | `jobId`        | Tracks many interactions per person across many jobs                    |
| `ProfileAgentAction`    | `profileId` | `actionId`     | You may want this indexed for fast lookup of all actions per profile    |
| `RoleDocument`          | `roleId`    | `documentId`   | A role may have multiple documents (PD, criteria, briefing, etc.)       |
| `JobDocument`           | `jobId`     | `documentId`   | Similar to above, per job advert or contract                            |

What's Covered Well
| Area                     | Notes                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| **Job structure**        | Covers metadata, links to source docs, recruiter info, location etc.  |
| **Role definition**      | Captures purpose, structure, requirements, capabilities, reporting    |
| **Profile modeling**     | Tracks skills, paths, recommendations, and dynamic interaction logs   |
| **Skill + Capability**   | Split clearly and usable for both inferred and framework-based models |
| **Career Pathing**       | Inferred + curated transitions between roles with metadata            |
| **Action logging (MCP)** | Agent actions track nudges, recs, guidance – core to MCP loop         |


| Join Table              | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |

