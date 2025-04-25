# ScoreAI HubSpot App

## Prerequisites
- HubSpot CLI (`npm install -g @hubspot/cli`)
- PowerShell

## Deployment
Use the PowerShell script for deployment:

```powershell
# Development
.\deploy.ps1 -Environment dev

# Production
.\deploy.ps1 -Environment live
```

## Configuration
- Development config: `scoreai-dev/src/app/config.ts`
- Production config: `scoreai-dev/src/app/config.live.ts`
- The deployment script automatically copies the correct config files

## Support
Contact: scott@acceleratewith.ai 