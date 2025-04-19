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
    Write-Status "Ready for development deployment..." -Type "success"
    Write-Status "To deploy, run: cd scoreai-dev && hs project upload --account=ai-dev" -Type "info"
}
else {
    Write-Status "Preparing production environment..." -Type "info"
    
    # Clean up production directory
    if (Test-Path $prodPath) {
        Write-Status "Cleaning up production directory..." -Type "info"
        Remove-Item -Path $prodPath -Recurse -Force
    }
    
    # Create production directory
    New-Item -ItemType Directory -Path $prodPath -Force | Out-Null

    # First, copy and log configuration files
    Write-Status "Copying production configuration files:" -Type "info"
    $configFiles = @(
        @{Source="$devPath\src\app\public-app.live.json"; Dest="$prodPath\src\app\public-app.json"},
        @{Source="$devPath\src\app\config.live.ts"; Dest="$prodPath\src\app\config.ts"},
        @{Source="$devPath\hsproject.live.json"; Dest="$prodPath\hsproject.json"}
    )
    
    foreach ($file in $configFiles) {
        # Create the target directory if it doesn't exist
        $targetDir = Split-Path -Parent $file.Dest
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        Copy-Item -Path $file.Source -Destination $file.Dest -Force
        Write-Status "Updated: $($file.Dest.Substring($prodPath.Length + 1))" -Type "success"
    }
    
    # Then copy all other files, excluding .live files
    Write-Status "`nCopying remaining files to production..." -Type "info"
    Get-ChildItem -Path "$devPath" -Recurse -File | Where-Object {
        $_.Name -notlike "*.live.*" -and 
        $_.Name -ne "public-app.json" -and 
        $_.Name -ne "config.ts" -and 
        $_.Name -ne "hsproject.json" -and
        $_.FullName -notlike "*\node_modules\*"
    } | ForEach-Object {
        $relativePath = $_.FullName.Substring($devPath.Length + 1)
        $targetPath = Join-Path $prodPath $relativePath
        
        # Create the target directory if it doesn't exist
        $targetDir = Split-Path -Parent $targetPath
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        
        # Copy the file
        Copy-Item -Path $_.FullName -Destination $targetPath -Force
        Write-Status "Copied: $relativePath" -Type "info"
    }
    
    Write-Status "`nProduction files prepared successfully!" -Type "success"
    Write-Status "To deploy, run: cd scoreai && hs project upload" -Type "info"
}

# Return to original directory
Set-Location $rootPath 