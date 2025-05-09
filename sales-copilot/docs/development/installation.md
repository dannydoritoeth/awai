# Developer Installation Guide

This guide explains how to set up the Sales Copilot development environment.

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- [Deno](https://deno.land/manual/getting_started/installation) installed
- [HubSpot Developer Account](https://developers.hubspot.com/)
- Git installed

## 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/your-org/sales-copilot.git
cd sales-copilot

# Copy environment example files
cp .env.example .env
```

## 2. Supabase Project Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Install Docker Desktop:
   - Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Ensure Docker is running before proceeding

3. Initialize Supabase locally:
```bash
# Initialize Supabase
supabase init

# Start Supabase services (this will start PostgreSQL)
supabase start

# Verify services are running
supabase status

# Link to your remote project
supabase link --project-ref your-project-ref
```

4. Verify PostgreSQL Connection:
```bash
# Default local connection details:
# Host: 127.0.0.1
# Port: 54322
# Database: postgres
# User: postgres
# Password: postgres

# Test connection using psql (if installed)
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres
```

5. Apply database migrations:
```bash
# For local development database
supabase db reset    # This resets and runs all migrations locally

# For production database (be careful!)
supabase db push     # This pushes migrations to production
```

> ⚠️ **Important**: 
> - `db reset` is safe for local development but will reset your local database
> - `db push` affects your production database, use with caution
> - Always test migrations locally first before applying to production
> - Make sure you're linked to the correct project before running migrations

### Troubleshooting Database Connection

If you see the error "failed to connect to postgres":

1. **Check Supabase Services**
```bash
# Stop any existing services
supabase stop

# Remove existing containers
supabase stop --no-backup

# Start fresh
supabase start
```

2. **Verify Docker**
   - Ensure Docker Desktop is running
   - Check Docker containers:
```bash
docker ps | grep postgres
```

3. **Check Port Availability**
```bash
# Windows (PowerShell)
Test-NetConnection -ComputerName localhost -Port 54322

# Alternative for Windows
netstat -ano | findstr "54322"
```

4. **Common Solutions**
   - If port 54322 is in use:
     1. Stop any existing PostgreSQL services
     2. Check for other processes using the port
     3. Try stopping and starting Supabase
   - If Docker issues:
     1. Restart Docker Desktop
     2. Run `docker system prune` (caution: removes unused containers)
     3. Restart your computer

5. **Reset Local Setup**
```bash
# Full reset if needed
supabase stop --no-backup
docker system prune -a
supabase start
```

## 3. HubSpot App Setup

1. Create a HubSpot Developer Account
2. Create a new app in HubSpot:
   - Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
   - Create a new app
   - Set OAuth scopes:
     ```
     crm.objects.contacts.read
     crm.objects.contacts.write
     crm.objects.companies.read
     crm.objects.companies.write
     ```
   - Set Redirect URL: `https://[YOUR-PROJECT-REF].supabase.co/functions/v1/hubspot-oauth`

## 4. Edge Functions Setup

1. Review existing functions in `supabase/functions/`:
   - `hubspot-oauth` - OAuth and installation
   - `hubspot-process-training` - Training data processing
   - `hubspot-score-record` - Real-time scoring
   - `hubspot-score-batch` - Batch scoring
   - `_shared` - Shared utilities and services

2. Set up Edge Function secrets in your Supabase project:
   ```bash
   # Required secrets for edge functions
   supabase secrets set SUPABASE_URL=your_project_url
   supabase secrets set SUPABASE_ANON_KEY=your_anon_key
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   supabase secrets set SUPABASE_DB_URL=your_db_url
   supabase secrets set HUBSPOT_CLIENT_ID=your_hubspot_client_id
   supabase secrets set HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
   supabase secrets set HUBSPOT_REDIRECT_URI=your_redirect_uri
   supabase secrets set APP_URL=your_app_url
   supabase secrets set ENCRYPTION_KEY=your_32_byte_encryption_key
   supabase secrets set HUBSPOT_APP_ID=your_hubspot_app_id
   ```

   > **Important Notes:**
   > - You can set these secrets in the Supabase Dashboard under:
   >   Project Settings > Edge Functions > Environment variables
   > - The `ENCRYPTION_KEY` must be a 32-byte key. Generate it using: `openssl rand -base64 32`
   > - The `HUBSPOT_APP_ID` is found in your HubSpot Developer Account under App Settings
   > - The `SUPABASE_*` values can be found in your Supabase project settings
   > - Make sure your `HUBSPOT_REDIRECT_URI` matches exactly what's configured in your HubSpot app

3. Deploy the functions:
```bash
supabase functions deploy hubspot-oauth --no-verify-jwt
supabase functions deploy hubspot-process-training
supabase functions deploy hubspot-score-record
supabase functions deploy hubspot-score-batch
```

## 5. Environment Configuration

Update your `.env` file with:
```env
# Supabase
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key

# HubSpot
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_REDIRECT_URI=https://[YOUR-PROJECT-REF].supabase.co/functions/v1/hubspot-oauth

# OpenAI
OPENAI_API_KEY=your_openai_key

# Pinecone
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_environment
PINECONE_INDEX_NAME=your_index_name

# Security
ENCRYPTION_KEY=your_32_byte_encryption_key
```

Generate encryption key:
```bash
openssl rand -base64 32
```

## 6. Pinecone Setup

1. Create a [Pinecone](https://www.pinecone.io/) account
2. Create a new index:
   - Dimensions: 1536 (OpenAI embeddings)
   - Metric: Cosine
   - Pod Type: p1

## 7. Verify Installation

1. Test OAuth Flow:
```bash
supabase functions serve hubspot-oauth
```

2. Test Training Process:
```bash
supabase functions serve hubspot-process-training
```

3. Test Scoring:
```bash
supabase functions serve hubspot-score-record
supabase functions serve hubspot-score-batch
```

## Troubleshooting

### Common Issues

1. **Function Deployment Fails**
   - Check Supabase CLI version
   - Verify project linking
   - Check function dependencies

2. **OAuth Error**
   - Verify redirect URI in HubSpot
   - Check environment variables
   - Validate scopes configuration

3. **Database Connection Issues**
   - Check Supabase connection string
   - Verify migration status
   - Check database permissions

## Local Development

1. Start local Supabase:
```bash
# Start all services
supabase start

# Verify services status
supabase status

# If database connection fails
supabase db reset
```

2. Run functions locally:
```bash
supabase functions serve --env-file .env
```

3. Test webhooks using ngrok:
```bash
ngrok http 54321
```

4. Monitor logs:
```bash
# View database logs
supabase db log

# View all service logs
supabase logs
```

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Edge functions deployed
- [ ] HubSpot app configured
- [ ] Pinecone index created
- [ ] OAuth flow tested
- [ ] Webhooks configured 