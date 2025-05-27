# Testing Edge Functions

This document outlines the test cases for Edge functions, showing both simple and filtered requests for each entity.

## General Roles
General roles are semantic groupings of similar roles across different organizations. They help identify potential career paths and similar positions across different departments or companies.

### Simple Case
```json
{
  "insightId": "getGeneralRoles",
  "limit": 10,
  "offset": 0
}
```

### With Filters
```json
{
  "insightId": "getGeneralRoles",
  "limit": 10,
  "offset": 0,
  "functionArea": "Policy",
  "classificationLevel": "Senior",
  "searchTerm": "analyst",
  "filters": {
    "taxonomies": ["d290f1ee-6c54-4b01-90e6-d701748f0851", "d290f1ee-6c54-4b01-90e6-d701748f0852"],
    "regions": ["d290f1ee-6c54-4b01-90e6-d701748f0853", "d290f1ee-6c54-4b01-90e6-d701748f0854"],
    "divisions": ["d290f1ee-6c54-4b01-90e6-d701748f0855", "d290f1ee-6c54-4b01-90e6-d701748f0856"],
    "employmentTypes": ["d290f1ee-6c54-4b01-90e6-d701748f0857", "d290f1ee-6c54-4b01-90e6-d701748f0858"],
    "capabilities": ["d290f1ee-6c54-4b01-90e6-d701748f0859", "d290f1ee-6c54-4b01-90e6-d701748f0860"],
    "skills": ["d290f1ee-6c54-4b01-90e6-d701748f0861", "d290f1ee-6c54-4b01-90e6-d701748f0862"],
    "companies": ["d290f1ee-6c54-4b01-90e6-d701748f0863", "d290f1ee-6c54-4b01-90e6-d701748f0864"]
  }
}
```

### Expected Response
```json
{
  "success": true,
  "data": [{
    "id": "gen_role_123",
    "title": "Senior Policy Analyst",
    "description": "Policy analysis and development roles across departments",
    "function_area": "Policy",
    "classification_level": "Senior",
    "similar_roles": ["Policy Officer", "Policy Advisor", "Senior Policy Officer"],
    "role_category": "Policy Development",
    "semantic_keywords": ["policy", "analysis", "governance", "stakeholder management"],
    "taxonomies": [
      { "id": "d290f1ee-6c54-4b01-90e6-d701748f0851", "name": "Environment" },
      { "id": "d290f1ee-6c54-4b01-90e6-d701748f0852", "name": "Policy" }
    ],
    "regions": [
      { "id": "d290f1ee-6c54-4b01-90e6-d701748f0853", "name": "Sydney" }
    ],
    "divisions": [
      { "id": "d290f1ee-6c54-4b01-90e6-d701748f0855", "name": "DCCEEW" }
    ]
  }]
}
```

## Company Roles
These are actual positions within specific organizations.

### Get Role by ID
```json
{
  "insightId": "getRole",
  "roleId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### With Related Data
```json
{
  "insightId": "getRole",
  "roleId": "123e4567-e89b-12d3-a456-426614174000",
  "includeSkills": true,
  "includeCapabilities": true,
  "includeDocuments": true
}
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "role": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Senior Policy Officer",
      "division": {
        "id": "div_123",
        "name": "DCCEEW",
        "cluster": "Environment",
        "agency": "Department of Climate Change, Energy, Environment and Water"
      },
      "grade_band": "Grade 11/12",
      "location": "Sydney",
      "primary_purpose": "Lead policy development and stakeholder engagement",
      "general_role_id": "gen_role_123"
    },
    "skills": [
      {
        "id": "d290f1ee-6c54-4b01-90e6-d701748f0861",
        "name": "Data Analysis",
        "category": "Technical",
        "description": "Ability to analyze and interpret complex data sets"
      }
    ],
    "capabilities": [
      {
        "id": "d290f1ee-6c54-4b01-90e6-d701748f0859",
        "name": "Policy Development",
        "group_name": "Core Capabilities",
        "description": "Develop and implement effective policies",
        "type": "Core",
        "level": "Advanced"
      }
    ],
    "documents": [
      {
        "id": "doc_123",
        "title": "Role Description",
        "url": "https://example.com/docs/role_123.pdf",
        "type": "Position Description"
      }
    ]
  }
}
```

## Capability Heatmap

### By Taxonomy
```json
{
  "insightId": "generateCapabilityHeatmapByTaxonomy",
  "companyIds": ["d290f1ee-6c54-4b01-90e6-d701748f0863"]
}
```

### By Division
```json
{
  "insightId": "generateCapabilityHeatmapByDivision",
  "companyIds": ["d290f1ee-6c54-4b01-90e6-d701748f0863"]
}
```

### By Region
```json
{
  "insightId": "generateCapabilityHeatmapByRegion",
  "companyIds": ["d290f1ee-6c54-4b01-90e6-d701748f0863"]
}
```

### By Company
```json
{
  "insightId": "generateCapabilityHeatmapByCompany",
  "companyIds": ["d290f1ee-6c54-4b01-90e6-d701748f0863"]
}
```

## Testing with cURL

You can test these endpoints using cURL. Here's an example:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/data' \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ANON_KEY" \
-d '{
  "insightId": "getGeneralRoles",
  "limit": 10,
  "offset": 0,
  "filters": {
    "taxonomies": ["Environment"],
    "regions": ["Sydney"]
  }
}'
```

## Testing Notes

1. General Roles:
   - Represent semantic groupings of similar roles
   - Help identify career pathways and similar positions
   - Include semantic metadata like similar roles and keywords
   - Can be filtered by various criteria using UUIDs

2. Company Roles:
   - Represent actual positions within organizations
   - Link to a general role for semantic grouping
   - Include specific details like division, grade band, location
   - Can include related data like skills and capabilities
   - All relationships use UUIDs for references

3. Filter Behavior:
   - All filter fields are optional
   - Empty arrays in filters are ignored
   - Multiple values in filter arrays use OR logic within the same category
   - Different filter categories use AND logic between them
   - The `searchTerm` parameter searches across multiple fields using full-text search
   - Pagination is handled by `limit` and `offset` parameters
   - All filter values should be valid UUIDs
