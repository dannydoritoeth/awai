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
