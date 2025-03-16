# AI Scoring System for HubSpot

## Overview
This system provides AI-powered scoring for HubSpot contacts, companies, and deals based on your organization's ideal client profile. It uses machine learning to analyze patterns in your classified records and score new records accordingly.

## Project Structure

```
/
├── docs/                 # Documentation
├── node_modules/         # Node.js dependencies
├── shared/              # Shared utilities and types
├── sql/                 # Database schemas and migrations
├── supabase/            # Supabase Edge Functions
│   └── functions/       # Serverless functions
│       ├── _shared/     # Shared utilities and services
│       ├── hubspot-oauth/           # HubSpot OAuth and setup
│       ├── hubspot-process-training/ # Process training data
│       ├── hubspot-score-record/    # Real-time scoring
│       └── hubspot-score-batch/     # Batch scoring
├── worker/              # Background processing jobs
├── .env.example         # Example environment configuration
└── .gitignore          # Git ignore rules
```

## How It Works

### 1. Installation & Setup
- Install the app through HubSpot marketplace
- The app automatically creates required properties in your HubSpot portal:
  - `training_classification` (Ideal/Less Ideal)
  - `training_attributes` (Relevant characteristics)
  - `training_score` (0-100 rating)
  - `training_notes` (Additional context)

### 2. Training Data
1. Classify your existing records:
   - Mark records as "Ideal" or "Less Ideal"
   - Assign a score (0-100)
   - Select relevant attributes
   - Add explanatory notes
2. Run the "Process Ideal Clients" function to:
   - Create embeddings for classified records
   - Store them in vector database (Pinecone)

### 3. Scoring Process
The system scores records in two ways:

#### Real-time Scoring
When a new record is created:
1. System generates embeddings for the new record
2. Retrieves similar records from training data
3. Uses AI to analyze similarities and differences
4. Updates record with results

#### Batch Scoring
Periodically processes updated records:
1. Identifies recently modified records
2. Applies the same scoring process
3. Updates records in bulk

## Technical Components

### Edge Functions
- `hubspot-oauth`: Handles HubSpot installation and setup
- `hubspot-process-training`: Processes training data for HubSpot records
- `hubspot-score-record`: Handles real-time scoring of HubSpot records
- `hubspot-score-batch`: Processes batch scoring of HubSpot records

### Shared Components
- `ScoringService`: Core scoring logic
- `HubspotClient`: HubSpot API interactions
