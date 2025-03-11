# HubSpot OAuth Integration Setup Guide

## Prerequisites

- Supabase project
- HubSpot Developer Account
- Access to HubSpot App Settings
- Deno installed locally (for testing Edge Functions)

## 1. HubSpot Configuration

### Create HubSpot App
1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Create a new app or select existing app
3. Navigate to Auth settings
4. Configure OAuth settings:
   Redirect URL: https://[YOUR-PROJECT-REF].supabase.co/functions/v1/hubspot-oauth
   Scopes: crm.objects.contacts.read crm.objects.contacts.write 
          crm.objects.deals.read crm.objects.deals.write
   ```

## 2. Supabase Setup

### Database Setup
1. Create the required tables using the migration:
   ```bash
   # Create new migration
   supabase migration new create_hubspot_accounts

   # Copy migration content
   cp docs/migrations/20240220000000_create_hubspot_accounts.sql supabase/migrations/[TIMESTAMP]_create_hubspot_accounts.sql

   # Apply migration
   supabase migration up
   ```

### Edge Function Setup

1. Create function directory structure:
   ```bash
   mkdir -p supabase/functions/hubspot-oauth
   mkdir -p supabase/functions/_shared
   ```

2. Create function files:
   ```bash
   # OAuth handler
   touch supabase/functions/hubspot-oauth/index.ts

   # Encryption utility
   touch supabase/functions/_shared/encryption.ts
   ```

3. Add Deno dependencies to the OAuth handler (`hubspot-oauth/index.ts`):
   ```typescript
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
   import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
   import { encrypt } from '../_shared/encryption.ts';
   ```

4. Add Deno dependencies to the encryption utility (`_shared/encryption.ts`):
   ```typescript
   import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
   ```

5. Set up environment variables:
   ```bash
   # Copy example env file
   cp supabase/functions/.env.example supabase/functions/.env

   # Set environment variables
   supabase secrets set --env-file ./supabase/functions/.env
   ```

6. Deploy the Edge Function:
   ```bash
   supabase functions deploy hubspot-oauth
   ```

## 3. Environment Configuration

Update the following environment variables in your Supabase project:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# HubSpot
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
HUBSPOT_REDIRECT_URI=https://your-project.supabase.co/functions/v1/hubspot-oauth
HUBSPOT_SCOPES="crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read crm.objects.deals.write"

# Security
ENCRYPTION_KEY=your_32_byte_encryption_key # Must be 32 bytes for AES-256

# Application
APP_URL=https://your-app-url.com
APP_ENV=development
```

### Generate Encryption Key
```bash
# Using OpenSSL to generate a 32-byte key
openssl rand -base64 32
```

## 4. Implementation

### Generate OAuth URL
```typescript
function getHubSpotAuthUrl() {
  const scopes = [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.deals.read',
    'crm.objects.deals.write'
  ];
  const params = new URLSearchParams({
    client_id: Deno.env.get('HUBSPOT_CLIENT_ID'),
    redirect_uri: Deno.env.get('HUBSPOT_REDIRECT_URI'),
    scope: scopes.join(' ')
  });

  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}
```