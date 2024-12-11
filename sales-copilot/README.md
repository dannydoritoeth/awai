# Sales Copilot

A platform that integrates with various CRM systems to provide AI-powered insights.

Primary Objective: lead/opportunity/deal scoring, generative ai, client summary/best next action, 


## Project Structure

- `/api` - REST API server for managing integrations and user interactions
- `/worker` - Background worker for processing CRM data and creating embeddings

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

