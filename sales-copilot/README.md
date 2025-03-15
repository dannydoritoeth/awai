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

## Environment Setup
Required environment variables (see `.env.example`):
```env
# HubSpot Configuration
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_environment
PINECONE_INDEX_NAME=your_index_name
```

## Best Practices
1. Provide diverse training data
2. Include both ideal and less ideal examples
3. Add detailed notes for context
4. Regularly update training data
5. Monitor scoring results

## Limitations
- Requires sufficient training data
- Scoring quality depends on training data quality
- API rate limits apply
- Vector database size limits apply

# Sales Copilot

A platform that integrates with various CRM systems to provide AI-powered insights.

Primary Objective: lead/opportunity/deal scoring, generative ai, client summary/best next action

## Development Setup

### Prerequisites
- Node.js 18+
- Yarn
- PostgreSQL
- OpenAI API key
- Pinecone API key

### Environment Variables

Create `.env` files in both `/api` and `/worker` directories:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=salescopilot
DB_USER=your_user
DB_PASSWORD=your_password

# OpenAI
OPENAI_API_KEY=your_openai_key

# Pinecone
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_environment
PINECONE_INDEX_NAME=sales-copilot

# Pipedrive (for testing)
PIPEDRIVE_CLIENT_ID=your_client_id
PIPEDRIVE_CLIENT_SECRET=your_client_secret
PIPEDRIVE_REDIRECT_URI=http://localhost:3001/oauth/callback
PIPEDRIVE_TEST_ACCESS_TOKEN=test_token
PIPEDRIVE_TEST_REFRESH_TOKEN=test_refresh
PIPEDRIVE_TEST_COMPANY_DOMAIN=test_domain
PIPEDRIVE_TEST_USER_ID=test_user
PIPEDRIVE_TEST_COMPANY_ID=test_company

# Agentbox (for testing)
AGENTBOX_CLIENT_ID=your_client_id
AGENTBOX_API_KEY=your_api_key
AGENTBOX_API_URL=https://api.agentboxcrm.com.au
AGENTBOX_API_VERSION=2
```

### API Server Setup

1. Navigate to the API directory:
   ```bash
   cd api
   ```
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Start the development server:
   ```bash
   yarn start
   ```
   The API will run on http://localhost:3001

### Worker Setup

1. Navigate to the worker directory:
   ```bash
   cd worker
   ```
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Run the worker:
   ```bash
   yarn start
   ```

### Database Setup

1. Create the database:
   ```bash
   createdb salescopilot
   ```
2. Run the schema:
   ```bash
   psql salescopilot < sql/schema.sql
   ```
3. Seed the database:
   ```bash
   node sql/seed.js
   ```

## Development Scripts

### API Server
- `yarn start`: Starts the development server
- `yarn test`: Runs the test suite
- `yarn build`: Builds the application for production

### Worker
- `yarn start`: Runs the worker once
- `yarn start:watch`: Runs the worker in watch mode
- `yarn test`: Runs the test suite

## Supported Integrations

### Pipedrive CRM
- OAuth2 authentication
- Syncs deals, activities, and notes
- Real-time webhooks for updates

### Agentbox CRM
- API key authentication
- Syncs contacts and related data
- Paginated data retrieval

