## NSW Gov RAG System — Generation Scripts & Prompting

### Purpose

This document outlines the backend generation logic used to populate key data entities like `general_roles`, transitions, and taxonomy metadata using semantic clustering and prompt-based AI generation.

---

### General Role Generation

#### Script: `generateGeneralRoles`

**Steps:**

1. Embed all `roles` (title + description)
2. Cluster semantically similar roles
3. Assign a canonical label (e.g. “Policy Officer G6/7”)
4. Create `general_roles` with average embedding
5. Link `roles.general_role_id`

#### Outputs:

* `general_roles`
* Role-to-general-role links

---

### Prompt Template for General Role

**System Prompt:**

> You are a classification and workforce analyst. Group NSW Government job titles into generalized roles based on function (e.g. Policy, Project Delivery). Normalize role groups first, then infer typical classification levels using the table below.

**Example Instruction:**

```md
Role titles:
- Senior Policy Advisor
- Policy Analyst Grade 6
- Legislative Policy Officer

Return JSON format:
{
  "classifications": [
    {"roleTitle": "Policy Analyst Grade 6", "taxonomyGroups": ["Policy"]}
  ]
}
```

---

### Classification Mapping Table

Used during clustering to infer normalized bands:


| Jurisdiction | Code                | Mapped Band | Label                      |
|--------------|---------------------|-------------|----------------------------|
| APS          | APS1                | APS1        | APS Level 1                |
| APS          | APS2                | APS2        | APS Level 2                |
| APS          | APS3                | APS3        | APS Level 3                |
| APS          | APS4                | APS4        | APS Level 4                |
| APS          | APS5                | APS5/6      | APS Level 5                |
| APS          | APS6                | APS5/6      | APS Level 6                |
| APS          | EL1                 | EL1         | Executive Level 1          |
| APS          | EL2                 | EL2         | Executive Level 2          |
| APS          | SES1                | SES1        | Senior Executive Service 1 |
| APS          | SES2                | SES2        | Senior Executive Service 2 |
| APS          | SES3                | SES3        | Senior Executive Service 3 |
| NSW          | General Scale       | APS1        | General Scale              |
| NSW          | Level 1             | APS2        | Level 1                    |
| NSW          | Level 2             | APS3        | Level 2                    |
| NSW          | Level 3             | APS4        | Level 3                    |
| NSW          | Level 4             | APS5        | Level 4                    |
| NSW          | Level 5             | APS6        | Level 5                    |
| NSW          | Level 6             | EL1         | Level 6                    |
| NSW          | Level 7             | EL2         | Level 7                    |
| QLD          | L1                  | APS1        | Level 1                    |
| QLD          | L2                  | APS2        | Level 2                    |
| QLD          | L3                  | APS3        | Level 3                    |
| QLD          | L4                  | APS4        | Level 4                    |
| QLD          | L5                  | APS5        | Level 5                    |
| QLD          | L6                  | APS6        | Level 6                    |
| QLD          | L7 / L8             | EL1         | Level 7/8                  |
| QLD          | Senior officer      | EL2         | Senior Officer             |
| VIC          | VPS1                | APS1        | VPS Grade 1                |
| VIC          | VPS2                | APS2        | VPS Grade 2                |
| VIC          | VPS3                | APS3        | VPS Grade 3                |
| VIC          | VPS3/4              | APS4        | VPS Grade 3/4              |
| VIC          | VPS4                | APS5        | VPS Grade 4                |
| VIC          | VPS5                | APS6        | VPS Grade 5                |
| VIC          | VPS5/6              | EL1         | VPS Grade 5/6              |
| VIC          | VPS6                | EL2         | VPS Grade 6                |
| SA           | ASO1                | APS1        | ASO Level 1                |
| SA           | ASO2                | APS2        | ASO Level 2                |
| SA           | ASO3                | APS3        | ASO Level 3                |
| SA           | ASO4                | APS4        | ASO Level 4                |
| SA           | ASO5                | APS5        | ASO Level 5                |
| SA           | ASO6                | APS6        | ASO Level 6                |
| SA           | ASO7 / MAS1         | EL1         | ASO7/MAS1                  |
| SA           | ASO8 / MAS2 / MAS3  | EL2         | ASO8/MAS2/MAS3             |
| TAS          | GS Band 1           | APS1        | General Stream Band 1      |
| TAS          | GS Band 2           | APS2        | General Stream Band 2      |
| TAS          | GS Band 3           | APS3        | General Stream Band 3      |
| TAS          | GS Band 4           | APS4        | General Stream Band 4      |
| TAS          | GS Band 5           | APS5        | General Stream Band 5      |
| TAS          | GS Band 6           | APS6        | General Stream Band 6      |
| TAS          | GS Band 6/7         | EL1         | General Stream Band 6/7    |
| TAS          | GS Band 7           | EL2         | General Stream Band 7      |
| ACT          | ASO1                | APS1        | ASO Grade 1                |
| ACT          | ASO2                | APS2        | ASO Grade 2                |
| ACT          | ASO3                | APS3        | ASO Grade 3                |
| ACT          | ASO4                | APS4        | ASO Grade 4                |
| ACT          | ASO5                | APS5        | ASO Grade 5                |
| ACT          | ASO6                | APS6        | ASO Grade 6                |
| ACT          | Snr Officer Grade C | EL1         | Senior Officer Grade C     |
| ACT          | Snr Officer Grade B | EL2         | Senior Officer Grade B     |
| ACT          | Exec Level 1        | SES1        | Executive Level 1          |
| ACT          | Exec Level 2        | SES2        | Executive Level 2          |
| ACT          | Exec Level 3        | SES3        | Executive Level 3          |

---

### Other Planned Generators

#### `generateGeneralRoleTransitions`

* From pairwise general\_roles with high similarity
* Generates:

  * Summary of what’s required to make the move
  * Readiness score
  * Skill/capability gaps
  * Suggested development plan

#### `generateTaxonomyClassification`

* Groups general\_roles into functional taxonomies (e.g. Policy, Field, Project)
* Uses embedding + keyword + AI clustering

#### `generateCapabilityMetadata`

* For each capability:

  * Title, description
  * Indicators by level
  * Related roles/skills (semantic match)

---

### Notes

* Scripts should be idempotent — safe to re-run with same input
* All outputs are stored via `supabase` bulk upload or seeders
* Generation happens once → then cached via `generated_content`
* You can use OpenAI or local embedding model for clustering

---

### Maintenance & Retraining

* Regeneration can be triggered manually or scheduled
* Prompt templates should be versioned and traceable
* Model choice (e.g. `gpt-4`, `claude`) should be logged in metadata
