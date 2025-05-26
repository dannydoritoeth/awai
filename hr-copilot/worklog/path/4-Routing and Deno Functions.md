## NSW Gov RAG System — Routing & Deno Functions

### Purpose

Defines how frontend URLs map to backend generation actions, what inputs are required, and how caching is managed using Supabase Edge Functions.

---

### URL → Action → Data Mapping

| URL Pattern                          | Action Called              | Input Source                                         | Data Type                   | Cache Key (`generated_content`)     |
| ------------------------------------ | -------------------------- | ---------------------------------------------------- | --------------------------- | ----------------------------------- |
| `/roles/general/:general_role_id`    | `generateGeneralRoleData`  | general\_role\_id                                    | `GeneratedGeneralRoleData`  | `('general_role', general_role_id)` |
| `/roles/specific/:role_id`           | `generateSpecificRoleData` | role\_id                                             | `GeneratedSpecificRoleData` | `('role', role_id)`                 |
| `/transitions/:source_id-:target_id` | `generateTransitionData`   | source\_general\_role\_id, target\_general\_role\_id | `GeneratedTransitionData`   | `('transition', transition_id)`     |
| `/capabilities/:capability_id`       | `generateCapabilityData`   | capability\_id                                       | `GeneratedCapabilityData`   | `('capability', capability_id)`     |
| `/skills/:skill_id`                  | `generateSkillData`        | skill\_id                                            | `GeneratedSkillData`        | `('skill', skill_id)`               |
| `/taxonomy/:taxonomy_id`             | `generateTaxonomyPage`     | taxonomy\_id                                         | TBD                         | `('taxonomy', taxonomy_id)`         |
| `/division/:division_id`             | `generateDivisionPage`     | division\_id                                         | TBD                         | `('division', division_id)`         |

---

### Routing Logic Pseudocode

```ts
const { type, id } = parseUrlPath('/roles/general/abc123');

const cached = await supabase.from('generated_content')
  .select('data_json')
  .eq('content_type', type)
  .eq('reference_id', id)
  .single();

if (cached?.data_json) {
  return cached.data_json;
} else {
  const generated = await callGenerateAction(type, id);

  await supabase.from('generated_content').insert({
    content_type: type,
    reference_id: id,
    data_json: generated.content,
    generated_by: 'gpt-3.5-turbo'
  });

  return generated.content;
}
```

---

### Deno Edge Functions

#### `getGeneratedContent(type, id)`

* Returns cached content from `generated_content`
* If missing, triggers generation

#### `generateContent(type, id)`

* Runs a `generateXYZ` action based on `type`
* Used internally by `getGeneratedContent`

#### `refreshGeneratedContent(type, id)` *(optional)*

* Forces regeneration
* Admin use or scheduled refresh

---

### Benefits

* Stateless routing via consistent URL patterns
* Easy to prefetch or embed content across sites
* Supports on-demand rendering and background re-generation
