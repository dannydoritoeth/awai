## NSW Gov RAG System — Generation Scripts & Prompting

### Purpose

This document outlines the backend generation logic used to populate key data entities and their relationships using semantic clustering, embeddings, and prompt-based AI generation.

---

### Core Generation Scripts

#### 1. `generateGeneralRoles`

**Purpose:** Create normalized role types across departments

**Steps:**
1. Embed all `roles` (title + description) using OpenAI embeddings
2. Cluster semantically similar roles (cosine similarity > 0.85)
3. Assign canonical labels (e.g., "Policy Officer G6/7")
4. Create `general_roles` entries with:
   - Average embedding of cluster
   - Normalized classification band
   - Functional family
5. Link `roles.general_role_id`
6. Generate taxonomies and link via `general_role_taxonomies`

**Example Prompt:**
```md
System: You are a classification and workforce analyst. Group NSW Government job titles into generalized roles based on function (e.g., Policy, Project Delivery). Normalize role groups first, then infer typical classification levels.

Input roles:
- Senior Policy Advisor (Grade 9/10)
- Policy Analyst Grade 6
- Legislative Policy Officer Grade 7/8
- Principal Policy Officer

Output format:
{
  "generalRole": {
    "title": "Policy Officer",
    "classificationBand": "G6-8",
    "family": "Policy & Legislation",
    "taxonomies": ["Policy Development", "Government Services"]
  },
  "variants": [
    {"title": "Policy Analyst", "typicalGrade": "G6"},
    {"title": "Senior Policy Officer", "typicalGrade": "G7/8"},
    {"title": "Principal Policy Officer", "typicalGrade": "G9/10"}
  ]
}
```

#### 2. `generateTransitions`

**Purpose:** Identify and characterize possible role transitions

**Steps:**
1. Calculate pairwise similarity between general_roles
2. For high-similarity pairs (>0.75):
   - Generate transition metadata
   - Calculate capability/skill gaps
   - Create development recommendations
3. Store in `general_role_transitions`

**Example Prompt:**
```md
System: Analyze the transition path between these two roles, focusing on capability gaps and development needs.

Source Role: Policy Officer G6/7
{role details...}

Target Role: Senior Policy Officer G9/10
{role details...}

Required Output:
{
  "transitionSummary": "string",
  "gapScore": number,
  "similarityScore": number,
  "capabilityGaps": [{
    "capability": "string",
    "currentLevel": "string",
    "requiredLevel": "string",
    "developmentActions": ["string"]
  }],
  "recommendedActions": ["string"]
}
```



---

### Content Generation Scripts

#### 1. `generatePageContent`

**Purpose:** Generate structured content for entity pages

**Steps:**
1. Load entity and related data
2. Find semantic matches
3. Generate content sections
4. Store in `generated_content`

**Base Prompt Template:**
```md
System: Generate structured content for a {entityType} page. Focus on accurate, helpful information that aids career planning.

Entity: {entityData}
Related Items: {semanticMatches}
Context: {additionalContext}

Required sections:
1. Overview/Summary
2. Key Relationships
3. Development Pathways
4. Insights & Recommendations

Output must match interface:
{typescript interface for entity type}
```

#### 2. `refreshContent`

**Purpose:** Smart refresh of generated content

**Triggers:**
- Entity data changes
- Related entity updates
- Classification system changes
- Periodic refresh (30 days)

**Process:**
1. Check content age and dependencies
2. Identify affected content
3. Queue regeneration tasks
4. Update with version tracking

---

### Embedding Strategy

All semantic objects use OpenAI embeddings (1536 dimensions):

**Embedding Templates:**
```md
Roles:
{title} - {grade} - {primary_purpose}
Key responsibilities: {responsibilities}
Required capabilities: {capabilities}

Capabilities:
{name} - {group}
Description: {description}
Behavioral indicators: {indicators}

Skills:
{name} - {category}
Description: {description}
Usage examples: {examples}

Taxonomies:
{name} - {type}
Description: {description}
Related terms: {terms}
```

---

### Classification Mapping

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

Use this mapping to support generating a field like classification_band with values such as "Mid Level (e.g., G6/7, APS5/6)".

Only generate a classification_band after clustering roles by function.
The generateGeneralRoles script is responsible for clustering and creating entries in the general_roles table. It works by:

Embedding Role Titles and Descriptions: All role titles and descriptions are embedded using a vector embedding model (e.g., OpenAI, Cohere).

Clustering Similar Roles: Roles with high semantic similarity are grouped into candidate clusters.

Assigning Canonical Labels: A generalized role title is assigned to each cluster, such as "Policy Officer G7/8" or "Project Manager G6/7".

Generating General Role Entries: For each cluster, a new entry in the general_roles table is created with metadata such as classification_band, family, and average embedding.

Linking Roles: All original roles within each cluster are updated with a general_role_id linking them to the new generalized role.

This script allows downstream systems to:

Generate reusable development plans

Enable generalized transitions

Aggregate statistics across agencies

Support filtering and capability analytics by general role

This process runs regularly to ensure new or changed roles are properly clustered and linked.

---

### Other Planned Generators

#### `generateGeneralRoleTransitions`

* From pairwise general\_roles with high similarity
* Generates:

  * Summary of what's required to make the move
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

#### Version Control
- Prompt templates versioned in git
- Generated content includes prompt version
- Model versions logged in metadata

#### Quality Assurance
- Semantic validation of outputs
- Consistency checks across related entities
- Human review for taxonomy changes

#### Regeneration Rules
- Entity update → regenerate content
- Taxonomy change → refresh affected roles
- Classification change → update role bands
- New roles → rerun clustering

#### Performance Optimization
- Batch similar generation tasks
- Cache intermediate embeddings
- Use parallel processing for independence tasks
- Smart invalidation based on dependency graph

---

### Monitoring & Logging

Each generation task logs:
```json
{
  "taskId": "uuid",
  "type": "generation|refresh|update",
  "entity": {
    "type": "string",
    "id": "uuid"
  },
  "model": {
    "embedding": "text-embedding-ada-002",
    "generation": "gpt-4-turbo"
  },
  "timing": {
    "started_at": "timestamp",
    "completed_at": "timestamp"
  },
  "stats": {
    "tokens": number,
    "cost": number,
    "cacheHits": number
  }
}
```

### Entity Data Generation Scripts

#### 1. `generateEntityData`

**Purpose:** Generate structured data for any entity type

**Steps:**
1. Load entity and related data
2. Find semantic matches and relationships
3. Generate entity-specific data
4. Store in `generated_content` with embeddings

**Base Prompt Template:**
```md
System: Generate structured data for {entityType}. Focus on accurate, comprehensive information that supports career intelligence.

Entity: {entityData}
Related Entities: {semanticMatches}
Context: {additionalContext}

Required data structure:
1. Core Attributes
2. Relationships & Connections
3. Career Pathways
4. Insights & Analytics

Output must match interface:
{typescript interface for entity type}
```

#### 2. `refreshEntityData`

**Purpose:** Smart refresh of entity data

**Triggers:**
- Entity data changes
- Related entity updates
- Classification system changes
- Periodic refresh (30 days)

**Process:**
1. Check data age and dependencies
2. Identify affected entities
3. Queue entity regeneration tasks
4. Update embeddings and version tracking
