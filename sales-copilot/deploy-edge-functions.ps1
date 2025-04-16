# Deploy Edge Functions Script
# This script deploys all Supabase Edge Functions

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to deploy a single edge function
function Deploy-EdgeFunction {
    param (
        [string]$FunctionName,
        [bool]$NoVerifyJwt = $false
    )
    
    Write-Host "Deploying $FunctionName..." -ForegroundColor Cyan
    
    try {
        $deployCommand = "supabase functions deploy $FunctionName"
        if ($NoVerifyJwt) {
            $deployCommand += " --no-verify-jwt"
        }
        
        $result = Invoke-Expression $deployCommand
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully deployed $FunctionName" -ForegroundColor Green
        } else {
            Write-Host "Failed to deploy $FunctionName" -ForegroundColor Red
            Write-Host "Error: $result" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "Error deploying $FunctionName : $_" -ForegroundColor Red
    }
}

# List of all edge functions to deploy with their JWT verification status
$edgeFunctions = @{
    "hubspot-train-deal-batch" = $false
    "hubspot-train-sync" = $false
    "hubspot-train-deal" = $false
    "hubspot-partner-signup-url" = $true
    "hubspot-score-summary" = $true
    "stripe-payment-webhook" = $true
    "hubspot-stripe-create-checkout-session" = $false
    "stripe-dashboard" = $false
    "stripe-billing-portal" = $false
    "stripe-onboarding" = $false
    "hubspot-train-summary" = $false
    "hubspot-oauth" = $true
    "hubspot-score-record" = $true
    "hubspot-score-record-batch" = $false
}

# Main deployment process
Write-Host "Starting edge function deployment..." -ForegroundColor Yellow

# Deploy each function
foreach ($function in $edgeFunctions.GetEnumerator()) {
    Deploy-EdgeFunction -FunctionName $function.Key -NoVerifyJwt $function.Value
}

Write-Host "`nDeployment process completed!" -ForegroundColor Yellow
Write-Host "Note: Check the output above for any deployment errors." -ForegroundColor Yellow 