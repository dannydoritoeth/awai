# HubSpot Process Scoring Edge Function

This edge function handles the periodic AI lead scoring process for HubSpot accounts. It can be triggered automatically via cron job or manually via API call.

## Overview

The function:
1. Checks if accounts have enough training data (≥10 high scores and ≥10 low scores)
2. Processes unscored records in batches of 100, prioritizing most recent records first
3. Calls the batch scoring function for each batch

## Processing Order

Records are processed in the following order:
- Most recent records first (sorted by `createdate` in descending order)
- This ensures that new records are scored before older ones
- Helps maintain up-to-date scoring for active records

## Endpoints

### Base URL
```
https://[YOUR_PROJECT_REF].supabase.co/functions/v1/hubspot-process-scoring
```

### Manual Trigger

Process all accounts:
```bash
curl -X POST "https://[YOUR_PROJECT_REF].supabase.co/functions/v1/hubspot-process-scoring?manual=true" \
  -H "Authorization: Bearer [YOUR_JWT_TOKEN]"
```

Process a specific account:
```bash
curl -X POST "https://[YOUR_PROJECT_REF].supabase.co/functions/v1/hubspot-process-scoring?manual=true&portal_id=[PORTAL_ID]" \
  -H "Authorization: Bearer [YOUR_JWT_TOKEN]"
```

### Cron Job
The function runs automatically every 6 hours via cron job. No authentication required.

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `manual` | boolean | No | Set to `true` for manual triggers. Required for authenticated requests. |
| `portal_id` | string | No | Specific HubSpot portal ID to process. If not provided, processes all accounts. |

## Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes (manual only) | JWT token for authenticated requests. Format: `Bearer [token]` |

## Response

### Success Response
```json
{
  "message": "Scoring process completed successfully",
  "manual": true,
  "portal_id": "123",
  "accounts_processed": 1
}
```

### Error Response
```json
{
  "error": "Error message",
  "manual": true,
  "portal_id": "123"
}
```

## Requirements

### Training Data Requirements
For each object type (contact, company, deal), the account must have:
- ≥10 records with `training_score >= 80`
- ≥10 records with `training_score <= 50`

### Environment Variables
Required environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`

## Rate Limits

- Manual triggers: Requires authentication
- Cron job: Runs every 6 hours
- Batch size: 100 records per batch
- Concurrent requests: 10 (configurable in webhook settings)

## Error Handling

The function:
- Logs errors for each account separately
- Continues processing other accounts if one fails
- Returns detailed error messages in the response
- Validates environment variables and authentication

## Monitoring

The function logs:
- Account processing start/end
- Number of unscored records found
- Batch processing progress
- Any errors encountered 