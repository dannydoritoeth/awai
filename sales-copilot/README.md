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
  - `training_score` (0-100 rating, where ≥80 indicates ideal, ≤50 indicates less ideal)
  - `training_notes` (Additional context)

### 2. Training Data
1. Classify your existing records:
   - Assign a score (0-100) where:
     - ≥80 indicates an ideal customer
     - ≤50 indicates a less ideal customer
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

## Deployment

The application is automatically deployed to different environments based on Git branches:

### Environments

- **Development** (`scoreai-dev` branch)
  - Deploys to development environment
  - Used for feature development and testing
  - URL: `https://dev-[project-ref].supabase.co`

- **Testing** (`scoreai-test` branch)
  - Deploys to staging environment
  - Used for QA and acceptance testing
  - URL: `https://test-[project-ref].supabase.co`

- **Production** (`scoreai-live` branch)
  - Deploys to production environment
  - Used for live customer data
  - URL: `https://[project-ref].supabase.co`

### Deployment Process

The deployment process is automated using GitHub Actions:

1. **Supabase Resources** (`.github/workflows/supabase-deploy.yml`)
   - Deploys SQL migrations
   - Deploys Edge Functions
   - Runs on push/PR to scoreai-dev/scoreai-test/scoreai-live branches

2. **HubSpot App** (`.github/workflows/hubspot-deploy.yml`)
   - Deploys HubSpot app configuration
   - Only runs when changes are made to `hubspot-app/` directory
   - Runs on push/PR to scoreai-dev/scoreai-test/scoreai-live branches

### Required Secrets

The following secrets need to be configured in GitHub:

#### Supabase
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DEV_DB_URL`
- `SUPABASE_TEST_DB_URL`
- `SUPABASE_PROD_DB_URL`

#### HubSpot
- `HUBSPOT_DEV_APP_ID`
- `HUBSPOT_TEST_APP_ID`
- `HUBSPOT_PROD_APP_ID`
- `HUBSPOT_ACCESS_TOKEN`

### Manual Deployment

To manually deploy:

1. **Supabase**
   ```bash
   # Deploy SQL
   supabase db push --db-url [ENV_DB_URL]

   # Deploy Functions
   supabase functions deploy [function-name] --no-verify-jwt
   ```

2. **HubSpot**
   ```bash
   cd hubspot-app/scoreai
   hubspot config set appId [APP_ID]
   hubspot auth set accessToken [ACCESS_TOKEN]
   hubspot app deploy
   ```

## Development

[Rest of your existing README content...]
