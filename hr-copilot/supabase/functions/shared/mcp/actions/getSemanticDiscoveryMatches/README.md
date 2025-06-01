# Get Semantic Discovery Matches

This MCP action enables semantic discovery of relevant roles, capabilities, skills, and other entities directly from a text-based query — without requiring a selected profile or role context. It is primarily used by the general chat agent to identify and suggest structured entry points based on user intent.

## Usage

```typescript
const response = await mcp.execute('getSemanticDiscoveryMatches', {
  queryText: "senior legal or policy roles",
  targetTables: ['roles', 'capabilities', 'skills'], // optional
  limit: 10,                                         // optional
  threshold: 0.6                                     // optional
});
```

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| queryText | string | Yes | - | The text query to search for |
| targetTables | Tables[] | No | ['roles', 'capabilities', 'skills'] | Which tables to search in |
| limit | number | No | 10 | Maximum number of total results |
| threshold | number | No | 0.6 | Minimum similarity score (0-1) |

## Response Format

The action returns matches in the following format:

```typescript
interface SemanticMatch {
  id: string;
  type: 'role' | 'skill' | 'capability' | 'company' | 'profile';
  name: string;
  similarity: number;
  metadata?: any;
}
```

## Example Response

```json
{
  "success": true,
  "data": [
    {
      "id": "role_123",
      "type": "role",
      "name": "Senior Legal Officer",
      "similarity": 0.89,
      "metadata": {
        "title": "Senior Legal Officer",
        "division": "Legal Services"
      }
    },
    {
      "id": "capability_456",
      "type": "capability",
      "name": "Policy Development",
      "similarity": 0.82,
      "metadata": {
        "group_name": "Policy & Governance"
      }
    }
  ],
  "dataForDownstreamPrompt": {
    "getSemanticDiscoveryMatches": {
      "truncated": false,
      "structured": {
        "totalMatches": 2,
        "matchesByType": {
          "role": [...],
          "capability": [...]
        },
        "topMatch": {...}
      },
      "dataSummary": "Found 2 matches across 2 entity types."
    }
  }
}
```

## Use Cases

1. **General Chat Discovery**
   - User asks about certain types of roles or capabilities
   - Action finds relevant matches to structure the conversation

2. **Exploratory Search**
   - User wants to explore available roles or skills
   - Action returns semantically similar items

3. **Cross-Entity Search**
   - Search spans multiple entity types
   - Results are ranked by relevance across types

## Implementation Details

- Uses OpenAI embeddings for semantic search
- Distributes search limit across target tables
- Returns unified, ranked results
- Includes rich metadata for UI display
- No AI generation, pure vector search 