## NSW Gov RAG System — Routing & Deno Functions

### Purpose

Defines how frontend URLs map to backend generation actions, what inputs are required, and how caching is managed using Supabase Edge Functions.

---

### URL → Action → Data Mapping

| URL Pattern                                | Action Called              | Input Source                                         | Data Type                   | Cache Key (`generated_content`)           |
| ----------------------------------------- | -------------------------- | ---------------------------------------------------- | --------------------------- | ----------------------------------------- |
| `/roles/general/:general_role_id`          | `generateGeneralRoleData`  | general\_role\_id                                    | `GeneratedGeneralRoleData`  | `('general_role', general_role_id)`       |
| `/roles/specific/:role_id`                 | `generateRoleData`         | role\_id                                             | `GeneratedRoleData`         | `('role', role_id)`                       |
| `/transitions/:source_id/:target_id`       | `generateTransitionData`   | source\_general\_role\_id, target\_general\_role\_id | `GeneratedTransitionData`   | `('transition', ${source_id}-${target_id})`|
| `/capabilities/:capability_id`             | `generateCapabilityData`   | capability\_id                                       | `GeneratedCapabilityData`   | `('capability', capability_id)`           |
| `/skills/:skill_id`                        | `generateSkillData`        | skill\_id                                            | `GeneratedSkillData`        | `('skill', skill_id)`                     |
| `/taxonomy/:taxonomy_id`                   | `generateTaxonomyData`     | taxonomy\_id                                         | `GeneratedTaxonomyData`     | `('taxonomy', taxonomy_id)`               |
| `/companies/:company_id`                   | `generateCompanyData`      | company\_id                                          | `GeneratedCompanyData`      | `('company', company_id)`                 |
| `/divisions/:division_id`                  | `generateDivisionData`     | division\_id                                         | `GeneratedDivisionData`     | `('division', division_id)`               |
| `/jobs/:job_id`                           | `generateJobData`          | job\_id                                              | `GeneratedJobData`          | `('job', job_id)`                        |
| `/profiles/:profile_id`                   | `generateProfileData`      | profile\_id                                          | `GeneratedProfileData`      | `('profile', profile_id)`                |

---

### Routing Logic Pseudocode

```ts
interface GenerateParams {
  type: string;
  id: string;
  additionalParams?: Record<string, any>;
}

async function getGeneratedContent({ type, id, additionalParams }: GenerateParams) {
  // For transitions, create a composite key
  const referenceId = type === 'transition' 
    ? `${additionalParams.sourceId}-${additionalParams.targetId}`
    : id;

  const cached = await supabase.from('generated_content')
    .select('data_json, embedding')
    .eq('content_type', type)
    .eq('reference_id', referenceId)
    .single();

  if (cached?.data_json) {
    return cached.data_json;
  }

  const generated = await generateContent({ type, id, additionalParams });

  // Store both content and its embedding for semantic search
  await supabase.from('generated_content').insert({
    content_type: type,
    reference_id: referenceId,
    data_json: generated.content,
    embedding: generated.embedding,
    generated_by: 'gpt-4-turbo',
    metadata: {
      version: '1.0',
      timestamp: new Date().toISOString(),
      params: additionalParams
    }
  });

  return generated.content;
}
```

---

### Deno Edge Functions

#### `getGeneratedContent(type, id, params?)`

* Returns cached content from `generated_content`
* Handles special cases like transition composite keys
* If missing, triggers generation
* Supports additional parameters for complex generations

#### `generateContent(type, id, params?)`

* Runs appropriate `generateXYZ` action based on `type`
* Generates both content and embeddings
* Used internally by `getGeneratedContent`

#### `refreshGeneratedContent(type, id, params?)` *(optional)*

* Forces regeneration of content
* Updates embeddings for semantic search
* Admin use or scheduled refresh

#### `getSemanticallySimilar(type, id, limit = 5)`

* Finds semantically similar content using embeddings
* Used for "Related Content" sections
* Supports cross-entity type recommendations

---

### Cache Invalidation Rules

* General role updates trigger related specific role refreshes
* Taxonomy updates trigger related general role refreshes
* Classification changes trigger widespread role refreshes
* Embeddings are regenerated with content updates

---

### Benefits

* Stateless routing via consistent URL patterns
* Easy to prefetch or embed content across sites
* Supports on-demand rendering and background re-generation
* Semantic search enabled via stored embeddings
* Efficient caching with smart invalidation
* Supports complex entity relationships

## NSW Gov RAG System — Routing & Data Access

### Purpose

Defines how frontend accesses data through the enhanced data edge function, including filtering, caching, and progressive enhancement patterns.

---

### Enhanced Data Edge Function

```typescript
// Extended DataRequest interface
interface DataRequest {
  entityType: string;          // e.g. 'role', 'capability', 'transition'
  entityId?: string;          // Primary entity ID
  insightId?: string;         // For insight-specific queries
  companyIds?: string[];      // For company-scoped queries
  filters?: FilterContext;     // Standard filters
  include?: string[];         // Related data to include
  mode?: 'db_only' | 'ai_enhanced'; // Data access mode
  browserSessionId?: string;  // For user session tracking
}

// Example implementation
serve(async (req) => {
  const input: DataRequest = await req.json();
  
  try {
    // 1. Validate request
    validateDataRequest(input);
    
    // 2. Get base data based on type
    let data;
    if (input.insightId) {
      // Handle insight-specific queries
      data = await getInsightData(input);
    } else {
      // Handle entity data queries
      data = await getEntityData(input);
    }

    // 3. Apply filters if present
    if (input.filters) {
      data = await applyFilters(data, input.filters);
    }

    // 4. Handle AI enhancement if requested
    if (input.mode === 'ai_enhanced') {
      data = await enhanceWithAI(data, input);
    }

    // 5. Cache results
    await cacheResults(input, data);

    return new Response(JSON.stringify({
      success: true,
      data,
      error: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return handleError(error);
  }
});
```

### Frontend Data Access Layer

```typescript
// Base data service
class CareerDataService {
  private cache = new Map<string, any>();

  constructor(private baseUrl: string) {}

  private generateCacheKey(request: DataRequest): string {
    return JSON.stringify({
      type: request.entityType,
      id: request.entityId,
      filters: request.filters,
      mode: request.mode
    });
  }

  async fetchData<T>(request: DataRequest): Promise<T> {
    const cacheKey = this.generateCacheKey(request);
    
    // Check cache for db_only requests
    if (request.mode === 'db_only' && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const response = await fetch(`${this.baseUrl}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const data = await response.json();
    
    // Cache db_only results
    if (request.mode === 'db_only') {
      this.cache.set(cacheKey, data);
    }

    return data;
  }

  // Specialized methods
  async getRole(roleId: string, options?: {
    filters?: FilterContext;
    include?: string[];
    mode?: 'db_only' | 'ai_enhanced';
  }) {
    return this.fetchData({
      entityType: 'role',
      entityId: roleId,
      ...options
    });
  }

  async getInsight(insightId: string, companyIds: string[]) {
    return this.fetchData({
      insightId,
      companyIds,
      mode: 'db_only'
    });
  }
}
```

### React Integration Patterns

```typescript
// 1. Basic Data Hook
function useEntityData<T>(
  type: string,
  id: string,
  options?: {
    filters?: FilterContext;
    mode?: 'db_only' | 'ai_enhanced';
  }
) {
  return useQuery(
    ['entity', type, id, options],
    () => dataService.fetchData({ entityType: type, entityId: id, ...options })
  );
}

// 2. Progressive Enhancement Hook
function useProgressiveEntityData<T>(
  type: string,
  id: string,
  filters?: FilterContext
) {
  // Fetch base data
  const baseQuery = useQuery(
    ['entity', type, id, 'base'],
    () => dataService.fetchData({ 
      entityType: type, 
      entityId: id,
      filters,
      mode: 'db_only' 
    })
  );

  // Fetch AI enhancements after base data loads
  const enhancedQuery = useQuery(
    ['entity', type, id, 'enhanced'],
    () => dataService.fetchData({
      entityType: type,
      entityId: id,
      filters,
      mode: 'ai_enhanced'
    }), 
    { enabled: !!baseQuery.data }
  );

  return {
    baseData: baseQuery.data,
    enhancedData: enhancedQuery.data,
    isLoading: baseQuery.isLoading || enhancedQuery.isLoading,
    error: baseQuery.error || enhancedQuery.error
  };
}

// 3. Component Example
function RolePage({ roleId }: { roleId: string }) {
  const { 
    baseData, 
    enhancedData, 
    isLoading 
  } = useProgressiveEntityData('role', roleId);

  if (isLoading) return <Loading />;

  return (
    <div>
      {/* Always render base data */}
      <RoleBasicInfo data={baseData} />
      
      {/* Progressively render AI insights */}
      {enhancedData && (
        <>
          <RoleTransitions data={enhancedData.transitions} />
          <CareerInsights data={enhancedData.insights} />
        </>
      )}
    </div>
  );
}
```

### Implementation Guidelines

1. **Data Loading Strategy**
   - Always fetch base data first (db_only)
   - Progressive enhancement for AI-generated content
   - Cache aggressively at multiple levels

2. **Filter Application**
   - Apply filters server-side when possible
   - Support client-side filtering for quick updates
   - Maintain filter state in URL for shareability

3. **Caching Strategy**
   ```typescript
   const CACHE_RULES = {
     db_only: {
       ttl: 5 * 60 * 1000, // 5 minutes
       level: ['browser', 'edge']
     },
     ai_enhanced: {
       ttl: 24 * 60 * 60 * 1000, // 24 hours
       level: ['edge']
     }
   };
   ```

4. **Error Handling**
   - Graceful degradation when AI enhancement fails
   - Clear error boundaries around enhanced content
   - Retry strategies for transient failures

---

### Benefits

* Efficient data loading with progressive enhancement
* Clear separation of base and enhanced data
* Flexible filtering system
* Strong typing throughout the stack
* Optimized caching strategies
* Resilient error handling
