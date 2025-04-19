param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "live")]
    [string]$Environment
)

# Function to display colored messages
function Write-Status {
    param(
        [string]$Message,
        [string]$Type = "info"
    )
    
    switch ($Type) {
        "success" { Write-Host $Message -ForegroundColor Green }
        "error" { Write-Host $Message -ForegroundColor Red }
        "warning" { Write-Host $Message -ForegroundColor Yellow }
        default { Write-Host $Message -ForegroundColor Cyan }
    }
}

# Function to check if HubSpot CLI is installed
function Test-HubSpotCLI {
    try {
        $null = Get-Command hs -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

# Check if HubSpot CLI is installed
if (-not (Test-HubSpotCLI)) {
    Write-Status "HubSpot CLI is not installed. Please install it using: npm install -g @hubspot/cli" -Type "error"
    exit 1
}

# Set paths
$rootPath = $PSScriptRoot
$devPath = Join-Path $rootPath "scoreai-dev"
$prodPath = Join-Path $rootPath "scoreai"

if ($Environment -eq "dev") {
    Write-Status "Deploying to development environment..."
    
    # Deploy development version
    try {
        Set-Location $devPath
        hs project upload --account=ai-dev
        Write-Status "Development deployment completed successfully!" -Type "success"
    }
    catch {
        Write-Status "Error during development deployment: $_" -Type "error"
        exit 1
    }
}
else {
    Write-Status "Deploying to production environment..."
    
    # Clean up production directory
    if (Test-Path $prodPath) {
        Write-Status "Cleaning up production directory..."
        Remove-Item -Path $prodPath -Recurse -Force
    }
    
    # Create production directory
    New-Item -ItemType Directory -Path $prodPath -Force | Out-Null
    
    # Copy development files to production
    Write-Status "Copying files to production..."
    Copy-Item -Path "$devPath\*" -Destination $prodPath -Recurse -Force
    
    # Copy live configuration files
    Write-Status "Updating production configuration..."
    Copy-Item -Path "$devPath\src\app\public-app.live.json" -Destination "$prodPath\src\app\public-app.json" -Force
    Copy-Item -Path "$devPath\src\app\config.live.ts" -Destination "$prodPath\src\app\config.ts" -Force
    Copy-Item -Path "$devPath\hsproject.live.json" -Destination "$prodPath\hsproject.json" -Force
    
    # Deploy production version
    try {
        Set-Location $prodPath
        hs project upload --account=ai-live
        Write-Status "Production deployment completed successfully!" -Type "success"
    }
    catch {
        Write-Status "Error during production deployment: $_" -Type "error"
        exit 1
    }
}

# Return to original directory
Set-Location $rootPath 