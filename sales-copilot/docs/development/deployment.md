# Deployment Guide

## Prerequisites
- Ensure you're linked to your cloud project:
```bash
supabase link --project-ref your-project-ref
```

## 1. Deploy Database Changes
```bash
# Deploy all database changes to production
supabase db push
```

## 2. Deploy Edge Functions
```bash
# Deploy all functions
supabase functions deploy hubspot-oauth
supabase functions deploy hubspot-process-training
supabase functions deploy hubspot-score-record
supabase functions deploy hubspot-score-batch

# Or deploy all functions at once
supabase functions deploy --no-verify-jwt
```

## 3. Set Production Environment Variables
```bash
# Set environment variables from your .env file
supabase secrets set --env-file .env

# Or set them individually
supabase secrets set HUBSPOT_CLIENT_ID=xxx
supabase secrets set HUBSPOT_CLIENT_SECRET=xxx
# ... etc
```

## 4. Verify Deployment
```bash
# Check database status
supabase db status

# List deployed functions
supabase functions list

# Check secrets
supabase secrets list
```

## Common Issues

1. **Function Deployment Fails**
   - Check you're linked to the correct project
   - Verify all dependencies are in `import_map.json`
   - Check function size limits

2. **Database Push Fails**
   - Run `supabase db diff` to see pending changes
   - Check for breaking changes
   - Consider using migrations for complex changes 