## NSW Gov RAG System — Generated Content Specs

### Purpose

This document defines the structured outputs expected from each `generateXYZ` action, including the data structure returned, how it is cached, and how the frontend renders it.

All generation actions return structured JSON conforming to `GeneratedEntityData` and stored in `generated_content.data_json`.

---

### Base Interface

```ts
interface GeneratedEntityData extends MCPResponse {
  entityType: string;
  metadata?: Record<string, any>;
  content: Record<string, any>;
}

// Common types used across entities
interface SemanticMatch {
  id: string;
  title: string;
  match: number;
  description?: string;
}

interface DemandInsights {
  hiring_agencies: string[];
  open_roles: number;
  trend: string;
}

interface ClassificationInfo {
  band: string;
  jurisdiction: string;
  code: string;
  label: string;
}
```

---

### `generateGeneralRoleData`

**Used on:** General Role Pages (The normalized, cross-department view of a role type)

```ts
interface GeneratedGeneralRoleData extends GeneratedEntityData {
  entityType: 'general_role';
  content: {
    title: string;
    description: string;
    classification_band: string;
    family: string;
    taxonomies: Array<{
      id: string;
      name: string;
      type: string;
    }>;
    specific_roles: Array<{
      role: SemanticMatch;
      division: { id: string; name: string };
      company: { id: string; name: string };
    }>;
    transitions: {
      next_roles: Array<{
        role: SemanticMatch;
        gap_score: number;
        transition_summary: string;
        recommended_actions: string[];
      }>;
      lateral_moves: Array<{
        role: SemanticMatch;
        similarity_score: number;
      }>;
      previous_roles: Array<{
        role: SemanticMatch;
        gap_score: number;
      }>;
    };
    required_capabilities: Array<{
      capability: SemanticMatch;
      level: string;
      type: 'focus' | 'complementary';
    }>;
    required_skills: SemanticMatch[];
    demand_insights: DemandInsights;
  };
}
```

---

### `generateRoleData`

**Used on:** Specific Role Pages (Division/Company specific implementations)

```ts
interface GeneratedRoleData extends GeneratedEntityData {
  entityType: 'role';
  content: {
    title: string;
    division: { id: string; name: string };
    company: { id: string; name: string };
    general_role: {
      id: string;
      title: string;
      classification_band: string;
    };
    classification: ClassificationInfo;
    grade_band: string;
    primary_purpose: string;
    reporting_line: string;
    direct_reports?: string;
    budget_responsibility?: string;
    similar_roles: Array<{
      role: SemanticMatch;
      division: { id: string; name: string };
    }>;
    required_capabilities: Array<{
      capability: SemanticMatch;
      level: string;
      type: 'focus' | 'complementary';
    }>;
    required_skills: SemanticMatch[];
    related_jobs: Array<{
      id: string;
      title: string;
      department: string;
      close_date?: string;
    }>;
  };
}
```

---

### `generateTaxonomyData`

**Used on:** Taxonomy Pages

```ts
interface GeneratedTaxonomyData extends GeneratedEntityData {
  entityType: 'taxonomy';
  content: {
    name: string;
    description: string;
    taxonomy_type: string;
    general_roles: Array<{
      role: SemanticMatch;
      classification_band: string;
      specific_role_count: number;
    }>;
    similar_taxonomies: SemanticMatch[];
    key_capabilities: SemanticMatch[];
    common_skills: SemanticMatch[];
    career_insights: {
      entry_level_roles: Array<{
        role: SemanticMatch;
        classification_band: string;
      }>;
      senior_roles: Array<{
        role: SemanticMatch;
        classification_band: string;
      }>;
      critical_capabilities: string[];
      typical_progression: Array<{
        from_role: string;
        to_role: string;
        typical_timeframe: string;
      }>;
    };
  };
}
```

---

### `generateTransitionData`

**Used on:** Transition Pages (Between General Roles)

```ts
interface GeneratedTransitionData extends GeneratedEntityData {
  entityType: 'transition';
  content: {
    source_role: {
      id: string;
      title: string;
      classification_band: string;
    };
    target_role: {
      id: string;
      title: string;
      classification_band: string;
    };
    gap_score: number;
    similarity_score: number;
    transition_summary: string;
    capability_gaps: Array<{
      capability: SemanticMatch;
      current_level: string;
      required_level: string;
      development_actions: string[];
    }>;
    skill_gaps: Array<{
      skill: SemanticMatch;
      importance: number;
      development_resources: string[];
    }>;
    recommended_actions: string[];
    alternative_paths: Array<{
      steps: Array<{
        role: SemanticMatch;
        duration: string;
        key_learnings: string[];
      }>;
      total_time: string;
      difficulty: 'easy' | 'moderate' | 'challenging';
    }>;
    success_stories?: Array<{
      current_division: string;
      time_taken: string;
      key_enablers: string[];
    }>;
  };
}
```

---

### `generateCompanyData`

**Used on:** Company Pages

```ts
interface GeneratedCompanyData extends GeneratedEntityData {
  entityType: 'company';
  content: {
    name: string;
    description: string;
    website?: string;
    divisions: SemanticMatch[];
    similar_companies: SemanticMatch[];
    top_roles: SemanticMatch[];
    key_capabilities: SemanticMatch[];
    hiring_trends: {
      total_open_roles: number;
      most_hired_roles: string[];
      growth_areas: string[];
    };
  };
}
```

---

### `generateDivisionData`

**Used on:** Division Pages

```ts
interface GeneratedDivisionData extends GeneratedEntityData {
  entityType: 'division';
  content: {
    name: string;
    cluster?: string;
    agency: string;
    description: string;
    parent_company: { id: string; name: string };
    similar_divisions: SemanticMatch[];
    key_roles: SemanticMatch[];
    core_capabilities: SemanticMatch[];
    workforce_insights: {
      role_count: number;
      capability_focus: string[];
      common_career_paths: Array<{
        from: string;
        to: string;
        frequency: number;
      }>;
    };
  };
}
```

---

### `generateJobData`

**Used on:** Job Pages

```ts
interface GeneratedJobData extends GeneratedEntityData {
  entityType: 'job';
  content: {
    title: string;
    role: { id: string; title: string };
    company: { id: string; name: string };
    division: { id: string; name: string };
    job_type: string;
    locations: string[];
    remuneration: string;
    similar_jobs: SemanticMatch[];
    required_capabilities: SemanticMatch[];
    required_skills: SemanticMatch[];
    related_roles: SemanticMatch[];
    career_progression: {
      potential_next_roles: SemanticMatch[];
      typical_pathways: string[];
    };
  };
}
```

---

### `generateCapabilityData`

**Used on:** Capability Pages

```ts
interface GeneratedCapabilityData extends GeneratedEntityData {
  entityType: 'capability';
  content: {
    name: string;
    group: string;
    description: string;
    framework_source: string;
    is_occupation_specific: boolean;
    indicators_by_level: Record<string, string[]>;
    roles_requiring: SemanticMatch[];
    similar_capabilities: SemanticMatch[];
    related_skills: SemanticMatch[];
    development_recommendations: string[];
    usage_by_division: Array<{
      division: { id: string; name: string };
      role_count: number;
    }>;
  };
}
```

---

### `generateSkillData`

**Used on:** Skill Pages

```ts
interface GeneratedSkillData extends GeneratedEntityData {
  entityType: 'skill';
  content: {
    name: string;
    category: string;
    description: string;
    source: string;
    is_occupation_specific: boolean;
    usage_examples: string[];
    roles_requiring: SemanticMatch[];
    similar_skills: SemanticMatch[];
    related_capabilities: SemanticMatch[];
    development_paths: Array<{
      level: string;
      activities: string[];
      resources: string[];
    }>;
    demand_trends: {
      growing_roles: string[];
      emerging_areas: string[];
    };
  };
}
```

---

### `generateProfileData`

**Used on:** Profile Pages

```ts
interface GeneratedProfileData extends GeneratedEntityData {
  entityType: 'profile';
  content: {
    name: string;
    role_title: string;
    division: { id: string; name: string };
    capabilities: Array<{
      capability: SemanticMatch;
      level: string;
    }>;
    skills: Array<{
      skill: SemanticMatch;
      rating?: string;
    }>;
    career_recommendations: {
      next_roles: SemanticMatch[];
      skill_gaps: Array<{
        skill: string;
        importance: number;
      }>;
      suggested_actions: string[];
    };
    similar_profiles: SemanticMatch[];
    matching_jobs: Array<{
      job: SemanticMatch;
      match_reasons: string[];
    }>;
  };
}
```

---

### Caching

* Stored in `generated_content.data_json`
* Indexed by: `(content_type, reference_id)`
* Supports regeneration on-demand or via expiry
* Semantic matches are computed at generation time using embedding similarity
* Transitions and taxonomies are cached separately from their related entities

---

### Frontend Mapping

* `entityType` is used to route rendering to the correct template/component
* `content` block contains all data needed for structured UI assembly
* All semantic matches include navigation links to their respective entity pages
* General roles serve as the primary navigation hub for role-based exploration

---

### Benefits

* Easy to update or re-render frontend without AI re-generation
* Data is portable across web, PDF, and report use cases
* Can support localization, A/B testing, and personalization with minimal logic
* Semantic navigation creates a rich, interconnected browsing experience
* Consistent structure makes it easy to add new entity types
* Clear separation between general roles and their specific implementations
* Taxonomy-based navigation complements semantic similarity
