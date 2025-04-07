# Account Training Business Rules

## Overview
This document outlines the business rules and processes for training HubSpot account data in the sales copilot system.

## Training Parameters

### Deal Classification
- **Ideal Deals**: Deals marked as `closedwon` in HubSpot
- **Non-Ideal Deals**: Deals marked as `closedlost` in HubSpot

### Time Range
- Only deals from the last 90 days are considered for training
- The 90-day window is calculated from the current date backwards

### Batch Processing
- Deals are processed in batches of 5 deals per page
- Each page is processed independently to allow for parallel processing
- Rate limiting:
  - 2 seconds delay between pagination requests
  - 2 seconds delay between processing individual deals
  - 5 seconds delay between batches

## Data Collection

### Deal Properties
The following properties are collected for each deal:
```typescript
[
  'dealname',
  'amount',
  'closedate',
  'createdate',
  'dealstage',
  'pipeline',
  'hs_lastmodifieddate',
  'hs_date_entered_closedwon',
  'hs_date_entered_closedlost',
  'hs_deal_stage_probability',
  'hs_pipeline_stage',
  'hs_time_in_pipeline',
  'hs_time_in_dealstage',
  'hs_deal_stage_changes'
]
```

### Associated Records
For each deal, the system also collects:
- All associated contacts
- All associated companies

## Statistics Calculation

### Deal Amount Statistics
For each type of deal (ideal/non-ideal), the system tracks:
- **Low**: Lowest deal amount
- **High**: Highest deal amount
- **Median**: Median deal amount
- **Count**: Total number of deals processed

### Statistics Update Rules
1. Statistics are accumulated across pages:
   - Counts are added to existing totals
   - High values are only updated if new value is higher
   - Low values are only updated if new value is lower
   - Median is calculated based on current batch

2. Additional metrics tracked:
   - `last_training_date`: Updated after each batch
   - `ideal_last_trained`/`nonideal_last_trained`: Updated for respective deal types
   - `current_ideal_deals`/`current_less_ideal_deals`: Running totals

## Vector Storage

### Namespace
- Each account's vectors are stored in a dedicated namespace: `hubspot-{portal_id}`

### Vector Creation Rules
1. Documents are created for:
   - The deal itself
   - Each associated contact
   - Each associated company

2. Each vector includes metadata:
   - Deal ID
   - Deal value
   - Conversion days (time from creation to close)
   - Pipeline information
   - Deal stage
   - Days in pipeline
   - Classification (ideal/non-ideal)
   - Record type (deal/contact/company)

### Deduplication
- Before storing vectors, the system checks for existing vectors
- Only updates vectors if:
  - The vector doesn't exist
  - The deal metadata has changed

## Error Handling

### Pagination
- Maximum of 3 consecutive pagination errors before stopping
- Each failed deal is logged but doesn't stop the batch processing

### Token Refresh
- Automatically refreshes HubSpot tokens when expired
- Updates encrypted tokens in the database

## Rate Limiting and Performance
- Maximum deals to process: 1000 per run
- Embeddings are generated in batches of 10 documents
- 500ms delay between embedding batches
- API calls include automatic retries with exponential backoff

## Monitoring
The system logs detailed information about:
- Pagination progress
- Deal processing status
- Statistics updates
- Vector storage operations
- Error conditions and recovery attempts 