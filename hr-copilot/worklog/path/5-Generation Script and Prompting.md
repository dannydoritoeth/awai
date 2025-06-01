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

**Purpose:** Generate structured data for any entity type with filter context support

**Steps:**
1. Load entity and related data
2. Apply filter context if provided
3. Generate entity-specific data
4. Store in `generated_content` with embeddings and filter metadata

**Base Prompt Template:**
```md
System: Generate structured data for {entityType}. Focus on accurate, comprehensive information that supports career intelligence.

Entity: {entityData}
Related Entities: {semanticMatches}
Context: {
  filters: {filterContext},
  additionalContext: {additionalContext}
}

Required data structure:
1. Core Attributes
2. Relationships & Connections (filtered by context)
3. Career Pathways (within filter scope)
4. Insights & Analytics (contextualized)

Output must match interface:
{typescript interface for entity type}
```

#### 2. `refreshEntityData`

**Purpose:** Smart refresh of entity data considering filter contexts

**Triggers:**
- Entity data changes
- Related entity updates
- Filter context changes
- Classification system changes
- Periodic refresh (30 days)

**Process:**
1. Check data age and dependencies
2. Identify affected entities and filter combinations
3. Queue entity regeneration tasks
4. Update embeddings and version tracking

---

### Filtering Architecture

#### Filter Types

```typescript
interface FilterContext {
  taxonomy?: string[];      // e.g., ["Policy", "Environment"]
  region?: string[];        // e.g., ["Sydney", "Northern NSW"]
  division?: string[];      // e.g., ["DPIE", "Transport"]
  employmentType?: string[]; // e.g., ["Permanent", "Temporary"]
}

interface FilterConfig {
  type: 'inclusion' | 'exclusion';
  combineOperator: 'AND' | 'OR';
  allowMultiple: boolean;
}

const FILTER_CONFIGS: Record<keyof FilterContext, FilterConfig> = {
  taxonomy: {
    type: 'inclusion',
    combineOperator: 'OR',
    allowMultiple: true
  },
  region: {
    type: 'inclusion',
    combineOperator: 'OR',
    allowMultiple: true
  },
  division: {
    type: 'inclusion',
    combineOperator: 'OR',
    allowMultiple: true
  },
  employmentType: {
    type: 'inclusion',
    combineOperator: 'OR',
    allowMultiple: true
  }
};
```

#### URL Structure

Filters are applied via URL parameters for consistency and shareability:

```typescript
// Example URLs
/roles/general/123?division=DPIE,Transport&region=Sydney
/transitions/456/789?taxonomy=Policy,Environment
/capabilities/234?division=DPIE&employmentType=Permanent
```

---

### Caching Strategy

#### 1. Entity Type Classification

```typescript
interface EntityTypeConfig {
  type: 'db-only' | 'ai-generated';
  filterStrategy: 'per-combination' | 'base-plus-filter';
  ttl: number;
  maxFilterCombinations?: number;
}

const ENTITY_CONFIGS: Record<string, EntityTypeConfig> = {
  // DB-Only Entities
  'role.list': {
    type: 'db-only',
    filterStrategy: 'per-combination',
    ttl: 24 * 3600 // 1 day
  },
  'capability.list': {
    type: 'db-only',
    filterStrategy: 'per-combination',
    ttl: 7 * 24 * 3600 // 7 days
  },
  
  // AI-Generated Entities
  'transition.analysis': {
    type: 'ai-generated',
    filterStrategy: 'base-plus-filter',
    ttl: 7 * 24 * 3600, // 7 days
    maxFilterCombinations: 10
  },
  'career.pathway': {
    type: 'ai-generated',
    filterStrategy: 'base-plus-filter',
    ttl: 14 * 24 * 3600, // 14 days
    maxFilterCombinations: 5
  }
};
```

#### 2. Cache Key Generation

```typescript
function generateCacheKey(params: {
  entityType: string;
  entityId: string;
  filters: FilterContext;
}): string {
  const { entityType, entityId, filters } = params;
  const filterHash = createFilterHash(filters);
  return `${entityType}:${entityId}:${filterHash}`;
}
```

---

### Key Architecture Decisions & Recommendations

1. **Filter State Management**
   
   **Recommendation:** URL-based filter state
   ```typescript
   // Benefits:
   - Shareable filtered views
   - Browser history support
   - Easy state restoration
   - SEO-friendly
   ```

2. **Caching Strategy by Entity Type**

   **Recommendation:** Hybrid approach based on entity type
   ```typescript
   DB-Only Entities:
   - Cache per filter combination
   - Short TTL (24 hours)
   - No limit on combinations
   
   AI-Generated Entities:
   - Base content + filter logic
   - Longer TTL (7-14 days)
   - Limited filter combinations
   ```

3. **Filter Application Point**

   **Recommendation:** Multi-level filtering
   ```typescript
   1. Database Level:
      - Apply basic filters (division, region)
      - Handle exact matches
   
   2. Application Level:
      - Complex filter logic
      - Relationship filtering
      - Cross-entity filters
   
   3. AI Generation Level:
      - Only for significant context changes
      - When filtered view needs deep analysis
   ```

4. **Cost Optimization**

   **Recommendation:** Progressive generation
   ```typescript
   1. Try cached exact match
   2. Try filtered cached base
   3. Generate new if:
      - High-value filter combination
      - Frequently requested
      - Cannot be derived from base
   ```

---

### Implementation Example

```typescript
async function getFilteredEntityData(params: {
  entityType: string;
  entityId: string;
  filters: FilterContext;
}): Promise<EntityData> {
  const config = ENTITY_CONFIGS[params.entityType];
  const cacheKey = generateCacheKey(params);

  // 1. Try exact cache match
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // 2. For DB-only entities
  if (config.type === 'db-only') {
    const data = await queryDatabaseWithFilters(params);
    await cache.set(cacheKey, data, config.ttl);
    return data;
  }

  // 3. For AI-generated entities
  if (config.filterStrategy === 'base-plus-filter') {
    // Try to filter existing base content
    const baseData = await getBaseEntityData(params);
    if (canApplyFiltersToBase(baseData, params.filters)) {
      const filtered = applyFilters(baseData, params.filters);
      await cache.set(cacheKey, filtered, config.ttl);
      return filtered;
    }
  }

  // 4. Generate new content with filters
  const generated = await generateEntityData({
    ...params,
    context: { filters: params.filters }
  });
  
  await cache.set(cacheKey, generated, config.ttl);
  return generated;
}
```

---

### Monitoring & Analytics

Track filter usage and performance:

```typescript
interface FilterAnalytics {
  filterCombinations: Record<string, number>; // Usage count
  generationTriggers: number;                 // AI generations
  cacheHits: number;                          // Cache effectiveness
  averageResponseTime: Record<string, number>;// By strategy
  costByFilter: Record<string, number>;       // AI cost tracking
}
```

### Semantic Discovery & Filtering

#### 1. Semantic Search Integration

```typescript
interface SemanticSearchParams {
  query?: string;           // Free text search
  entityType: string;
  entityId?: string;
  filters: FilterContext;
  semanticConfig: {
    minSimilarity: number;  // e.g., 0.75
    maxResults: number;     // e.g., 20
    includeFiltered: boolean; // Whether to search before or after filters
  };
}

interface SemanticMatch {
  entityId: string;
  entityType: string;
  similarity: number;
  matchReason: string;
  matchingAttributes: string[];
}
```

#### 2. Hybrid Search Strategy

```typescript
async function findRelatedEntities(params: SemanticSearchParams): Promise<SemanticMatch[]> {
  const { entityType, entityId, filters, semanticConfig } = params;

  // 1. Get base embeddings
  const baseEmbedding = entityId 
    ? await getEntityEmbedding(entityType, entityId)
    : await generateQueryEmbedding(params.query);

  // 2. Strategy based on config
  if (semanticConfig.includeFiltered) {
    // Search first, then filter
    const matches = await semanticSearch(baseEmbedding, {
      minSimilarity: semanticConfig.minSimilarity,
      maxResults: semanticConfig.maxResults * 2 // Get more to allow for filtering
    });
    return filterSemanticMatches(matches, filters);
  } else {
    // Filter first, then search within filtered set
    const filteredIds = await getFilteredEntityIds(entityType, filters);
    return semanticSearchWithinSet(baseEmbedding, filteredIds, semanticConfig);
  }
}
```

#### 3. Emergent Relationship Discovery

```typescript
interface EmergentRelationship {
  type: 'skill_based' | 'capability_based' | 'domain_knowledge' | 'career_pathway';
  confidence: number;
  explanation: string;
  supporting_evidence: {
    shared_attributes: string[];
    semantic_similarity: number;
    historical_transitions?: number;
  };
}

async function findEmergentRelationships(params: {
  entityType: string;
  entityId: string;
  filters: FilterContext;
}): Promise<EmergentRelationship[]> {
  // 1. Get entity embedding and key attributes
  const entityData = await getEntityData(params.entityType, params.entityId);
  
  // 2. Find semantic matches across different entity types
  const crossEntityMatches = await Promise.all([
    findRelatedEntities({
      ...params,
      semanticConfig: { minSimilarity: 0.7, maxResults: 10, includeFiltered: true }
    }),
    // Look for matches in other domains/divisions
    findRelatedEntities({
      ...params,
      filters: removeConstraints(params.filters, ['division', 'taxonomy']),
      semanticConfig: { minSimilarity: 0.8, maxResults: 5, includeFiltered: true }
    })
  ]);

  // 3. Analyze patterns and generate insights
  return analyzeRelationships(entityData, crossEntityMatches);
}
```

#### 4. Integration with Entity Generation

Update the generateEntityData function to include semantic relationships:

```typescript
async function generateEntityData(params: GenerateEntityParams): Promise<GeneratedEntityData> {
  // ... existing loading code ...

  // Find semantic relationships
  const semanticRelationships = await findEmergentRelationships({
    entityType: params.entityType,
    entityId: params.entityId,
    filters: params.context?.filters || {}
  });

  // Generate content with semantic insights
  const content = await generateEntityContent(params.entityType, {
    entity: entityData,
    related: relatedData,
    semanticInsights: semanticRelationships,
    context: params.context
  });

  // ... rest of the function ...
}
```

#### 5. Semantic Search Prompts

```typescript
const SEMANTIC_PROMPTS = {
  relationship_analysis: `
    System: Analyze the semantic relationship between these entities and identify non-obvious connections:

    Source Entity: {entityData}
    Matched Entity: {matchData}
    Similarity Score: {similarity}
    
    Consider:
    1. Shared skill patterns
    2. Complementary capabilities
    3. Domain knowledge transfer
    4. Historical career transitions
    
    Output must include:
    1. Relationship type classification
    2. Confidence score
    3. Evidence-based explanation
    4. Suggested transition pathway
  `,

  emergent_pattern: `
    System: Identify emergent career patterns from these semantic matches:

    Entity: {entityData}
    Semantic Matches: {matches}
    Filter Context: {filters}

    Look for:
    1. Non-traditional career paths
    2. Cross-domain skill applications
    3. Emerging role clusters
    4. Novel capability combinations

    Output must match EmergentRelationship interface
  `
};
```

### Updated Implementation Example

```typescript
async function getFilteredEntityDataWithSemantics(params: {
  entityType: string;
  entityId: string;
  filters: FilterContext;
  semanticConfig?: SemanticSearchParams;
}): Promise<EntityData> {
  const config = ENTITY_CONFIGS[params.entityType];
  const cacheKey = generateCacheKey(params);

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // Get base data
  const baseData = await getFilteredEntityData(params);

  // Enhance with semantic relationships if configured
  if (params.semanticConfig) {
    const semanticRelationships = await findEmergentRelationships({
      entityType: params.entityType,
      entityId: params.entityId,
      filters: params.filters
    });

    // Merge semantic insights
    baseData.relationships = {
      ...baseData.relationships,
      emergent: semanticRelationships
    };

    // Cache enhanced data
    await cache.set(cacheKey, baseData, config.ttl);
  }

  return baseData;
}
```

### Core Interfaces

```typescript
interface GeneratedEntityRequest extends MCPRequest {
  entityType: string;
  entityId: string;
  filters?: FilterContext;
  semanticConfig?: {
    minSimilarity?: number;     // Default: 0.75
    maxResults?: number;        // Default: 20
    includeFiltered?: boolean;  // Default: true
    crossEntitySearch?: boolean;// Default: false
  };
  context?: {
    userContext?: Record<string, any>;
    systemContext?: Record<string, any>;
  };
}

// All our specific requests extend this base
interface GenerateRoleRequest extends GeneratedEntityRequest {
  entityType: 'role';
  // Role-specific additions if needed
}

interface GenerateTransitionRequest extends GeneratedEntityRequest {
  entityType: 'transition';
  sourceEntityId: string;
  targetEntityId: string;
  // Transition-specific additions if needed
}

interface GenerateCapabilityRequest extends GeneratedEntityRequest {
  entityType: 'capability';
  // Capability-specific additions if needed
}
```

### Updated Implementation Using Standard Request

```typescript
// Update our main function to use the standard request
async function generateEntityData(request: GeneratedEntityRequest): Promise<GeneratedEntityData> {
  const { entityType, entityId, filters, semanticConfig, context } = request;

  // Load entity data
  const entityData = await loadEntityData(entityType, entityId);

  // Find semantic relationships if configured
  let semanticRelationships = [];
  if (semanticConfig) {
    semanticRelationships = await findEmergentRelationships({
      entityType,
      entityId,
      filters: filters || {},
      semanticConfig
    });
  }

  // Generate content
  const content = await generateEntityContent({
    entity: entityData,
    semanticInsights: semanticRelationships,
    context: {
      filters,
      ...context
    }
  });

  return {
    entityType,
    content,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: CURRENT_VERSION,
      filters,
      semanticConfig
    }
  };
}

// Example usage for different entity types
async function generateRole(request: GenerateRoleRequest) {
  return generateEntityData(request);
}

async function generateTransition(request: GenerateTransitionRequest) {
  // Special handling for transitions that have source and target
  const enhancedRequest = {
    ...request,
    entityId: `${request.sourceEntityId}-${request.targetEntityId}`,
    context: {
      ...request.context,
      sourceEntity: await loadEntityData('role', request.sourceEntityId),
      targetEntity: await loadEntityData('role', request.targetEntityId)
    }
  };
  
  return generateEntityData(enhancedRequest);
}

// Edge function handler using standard request
export async function generateEntityHandler(req: Request) {
  const request: GeneratedEntityRequest = await req.json();
  
  // Validate request
  validateGeneratedEntityRequest(request);
  
  // Check cache using standardized request
  const cacheKey = generateCacheKey(request);
  const cached = await checkEntityCache(cacheKey);
  if (cached && !isStale(cached)) {
    return cached;
  }
  
  // Generate fresh data
  const data = await generateEntityData(request);
  
  // Cache result
  await cacheEntityData(cacheKey, data);
  
  return data;
}

// Batch processing with standard request
async function batchGenerateEntityData(requests: GeneratedEntityRequest[]) {
  return Promise.all(
    requests.map(request => generateEntityData(request))
  );
}
```

### Cache Key Generation with Standard Request

```typescript
function generateCacheKey(request: GeneratedEntityRequest): string {
  const {
    entityType,
    entityId,
    filters,
    semanticConfig
  } = request;

  // Create deterministic filter hash
  const filterHash = filters ? createFilterHash(filters) : 'no-filters';
  
  // Create semantic config hash if present
  const semanticHash = semanticConfig ? createSemanticHash(semanticConfig) : 'no-semantic';

  return `${entityType}:${entityId}:${filterHash}:${semanticHash}`;
}
```

### Standardized Action Interfaces

```typescript
// Base request interface all actions should extend
interface MCPActionRequest extends MCPRequest {
  args?: Record<string, any>;     // Action-specific arguments
  context: {                      // Shared context
    sessionId: string;
    mode: 'candidate' | 'hiring' | 'analyst' | 'general';
    filters?: FilterContext;      // Standard filters
    userContext?: Record<string, any>;
    systemContext?: Record<string, any>;
  };
  supabase: SupabaseClient;       // Database client
}

// Example action-specific request
interface GetRoleDetailsRequest extends MCPActionRequest {
  args: {
    roleId: string;
    includeCapabilities?: boolean;
    includeSkills?: boolean;
  };
}

// Example transition-specific request
interface GetTransitionDetailsRequest extends MCPActionRequest {
  args: {
    sourceRoleId: string;
    targetRoleId: string;
    assessmentType?: 'full' | 'quick';
  };
}
```

### Action Implementation Pattern

All actions should follow this standard pattern:

```typescript
import { z } from "zod";

export const actionId = 'getEntityDetails';

// 1. Define args schema
export const argsSchema = z.object({
  entityId: z.string().uuid("Must be a valid UUID"),
  includeRelated: z.boolean().optional().default(true),
  depth: z.number().min(1).max(3).optional().default(1)
});

// 2. Type inference from schema
type Args = z.infer<typeof argsSchema>;

// 3. Standard action implementation
export const action: MCPActionV2 = {
  id: actionId,
  title: "Get Entity Details",
  description: "Retrieves detailed information about an entity",
  applicableRoles: ["analyst", "general"],
  capabilityTags: ["Entity Analysis"],
  tags: ["entity", "details"],
  usesAI: false,
  argsSchema,
  
  // 4. Default args function (optional)
  getDefaultArgs: (context: Record<string, any>): Partial<Args> => ({
    includeRelated: true,
    depth: 1
  }),

  // 5. Main action function
  actionFn: async (request: MCPActionRequest): Promise<MCPResponse> => {
    // Validate args
    const args = argsSchema.parse(request.args);
    
    // Access context safely
    const { filters, userContext } = request.context;
    
    // Implementation
    const result = await generateEntityData({
      entityType: 'entity',
      entityId: args.entityId,
      filters,
      context: {
        ...userContext,
        depth: args.depth
      }
    });

    return {
      success: true,
      data: result
    };
  }
};
```

### Action Registration

Actions must be registered in the `actionRegistry.ts`:

```typescript
import { action as getEntityDetails } from './getEntityDetails/action.ts';

const actions: MCPActionV2[] = [
  getEntityDetails,
  // ... other actions
];
```

### Key Standardization Points

1. **Request Structure**
   ```typescript
   // CORRECT ✅
   actionFn: async (request: MCPActionRequest) => {
     const { args, context, supabase } = request;
   }

   // INCORRECT ❌
   actionFn: async ({ entityId, filters, supabase }) => {
     // Don't destructure at top level
   }
   ```

2. **Args Validation**
   ```typescript
   // CORRECT ✅
   const args = argsSchema.parse(request.args);

   // INCORRECT ❌
   const { entityId = request.args.entityId } = request.args;
   ```

3. **Context Usage**
   ```typescript
   // CORRECT ✅
   const { filters, userContext } = request.context;

   // INCORRECT ❌
   const { filters } = request; // Don't access at top level
   ```

4. **Filter Handling**
   ```typescript
   // CORRECT ✅
   const result = await generateEntityData({
     filters: request.context.filters,
     // ... other params
   });

   // INCORRECT ❌
   const result = await generateEntityData({
     filters: request.filters, // Wrong path
     // ... other params
   });
   ```

### Common Issues to Avoid

1. **Infrastructure Access**
   ```typescript
   // WRONG: Don't include infrastructure in args schema
   const argsSchema = z.object({
     supabase: z.any(),     // ❌ Wrong
     sessionId: z.string()  // ❌ Wrong
   });

   // CORRECT: Access from request
   const { supabase, sessionId } = request; // ✅ Correct
   ```

2. **Context Mixing**
   ```typescript
   // WRONG: Don't mix context and args
   const argsSchema = z.object({
     entityId: z.string(),
     userContext: z.any()  // ❌ Wrong
   });

   // CORRECT: Keep separate
   const argsSchema = z.object({
     entityId: z.string()  // ✅ Correct
   });
   // Then access context from request.context
   ```

3. **Filter Access**
   ```typescript
   // WRONG: Don't include filters in args
   const argsSchema = z.object({
     entityId: z.string(),
     filters: z.any()  // ❌ Wrong
   });

   // CORRECT: Access from context
   const { filters } = request.context;  // ✅ Correct
   ```
