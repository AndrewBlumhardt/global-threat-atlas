#Requires -Version 7.0
<#
.SYNOPSIS
    Automated deployment script for the Global Threat Intelligence Atlas

.DESCRIPTION
    This script creates all required Azure resources and deploys the application:
    - Resource Group
    - Storage Account with containers
    - Function App (Python 3.11, Linux)
    - Azure Maps Account
    - Static Web App
    - Managed Identity configuration
    - RBAC role assignments
    - Function deployment

    All resource names are derived from -ProjectName by default but can each
    be overridden individually for custom naming or brownfield deployments.

.PARAMETER ProjectName
    Short name used to derive consistent names for all Azure resources.
    Must be lowercase letters, numbers, and hyphens only.
    Default: global-threat-atlas

.PARAMETER ResourceGroupName
    Name of the resource group to create.
    Default: rg-<ProjectName>

.PARAMETER Location
    Azure region for resources. Required - no default is assumed.
    Commercial examples: eastus, westus2, uksouth, eastus2
    Government examples: usgovvirginia, usgovarizona, usgovtexas

.PARAMETER StorageAccountName
    Storage account name (must be globally unique, lowercase, 3-24 chars, alphanumeric only).
    Default: <ProjectName> (lowercase alphanumeric only).

.PARAMETER FunctionAppName
    Function app name (must be globally unique).
    Default: func-<ProjectName>

.PARAMETER StaticWebAppName
    Static Web App name.
    Default: swa-<ProjectName>

.PARAMETER AzureMapsAccountName
    Azure Maps account name (unique within its resource group).
    Default: maps-<ProjectName>

.PARAMETER WorkspaceId
    Log Analytics Workspace ID (required for function to work)

.PARAMETER SubscriptionId
    Azure subscription ID (uses current subscription if not specified)

.PARAMETER Cloud
    Azure cloud environment (AzureCloud, AzureUSGovernment)
    Default: inherits whatever cloud the CLI is already set to (az cloud show).
    Pass AzureUSGovernment explicitly if you prefer the script to switch for you
    rather than running 'az cloud set --name AzureUSGovernment' beforehand.
    AzureUSGovernment supports both GCC and GCC-High

.EXAMPLE
    .\deploy.ps1 -Location "eastus" -WorkspaceId "12345678-1234-1234-1234-123456789012"

.EXAMPLE
    .\deploy.ps1 -ProjectName "contoso-threat-map" -Location "westus2" -WorkspaceId "12345678-1234-1234-1234-123456789012"

.EXAMPLE
    .\deploy.ps1 -ProjectName "contoso-threat-map" -ResourceGroupName "rg-security-tools" -Location "eastus" -WorkspaceId "12345678-1234-1234-1234-123456789012"

.EXAMPLE
    .\deploy.ps1 -Location "usgovvirginia" -WorkspaceId "12345678-1234-1234-1234-123456789012" -Cloud AzureUSGovernment

.NOTES
    Requires Owner or Contributor role on the subscription or target resource group
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectName = "global-threat-atlas",

    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "",
    
    [Parameter(Mandatory=$true)]
    [string]$Location,
    
    [Parameter(Mandatory=$false)]
    [string]$StorageAccountName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$FunctionAppName = "",
    
    [Parameter(Mandatory=$true)]
    [string]$WorkspaceId,
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("AzureCloud", "AzureUSGovernment", "")]
    [string]$Cloud = "",    # empty = inherit the current CLI cloud
    
    [Parameter(Mandatory=$false)]
    [string]$StaticWebAppName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AzureMapsAccountName = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipInfrastructure,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipFunctionApp
)

$ErrorActionPreference = "Stop"

# Derive resource names from ProjectName for any that were not explicitly supplied
$storageSlug = ($ProjectName -replace '[^a-z0-9]', '').ToLower()
if ($storageSlug.Length -gt 24) { $storageSlug = $storageSlug.Substring(0, 24) }
if ($storageSlug.Length -lt 3)  { $storageSlug = $storageSlug.PadRight(3, '0') }

# SWA is only available in a subset of regions per cloud; map to the nearest valid one.
# Government clouds use a separate set of supported SWA regions.
$swaCommercialRegions = @('westus2','centralus','eastus2','westeurope','eastasia')
$swaGovRegions        = @('usgovvirginia', 'usgovarizona')
$swaFallbackCommercial = 'eastus2'
$swaFallbackGov        = 'usgovvirginia'
if ($Cloud -eq 'AzureUSGovernment') {
    $SwaLocation = if ($swaGovRegions -contains $Location) { $Location } else { $swaFallbackGov }
} else {
    $SwaLocation = if ($swaCommercialRegions -contains $Location) { $Location } else { $swaFallbackCommercial }
}
if (-not $ResourceGroupName)    { $ResourceGroupName    = "rg-$ProjectName" }
if (-not $StaticWebAppName)     { $StaticWebAppName     = "swa-$ProjectName" }
if (-not $AzureMapsAccountName) { $AzureMapsAccountName = "maps-$ProjectName" }
if (-not $StorageAccountName)   { $StorageAccountName   = $storageSlug }
if (-not $FunctionAppName)      { $FunctionAppName      = "func-$ProjectName" }

# Color output functions
function Write-Step {
    param([string]$Message)
    Write-Host "`n✓ $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "  ✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "  ℹ $Message" -ForegroundColor Yellow
}

# Check prerequisites
Write-Step "Checking prerequisites..."

# Check Azure CLI
try {
    $azVersion = az version --output json 2>$null | ConvertFrom-Json
    Write-Success "Azure CLI version $($azVersion.'azure-cli')"
} catch {
    Write-Error "Azure CLI not found. Please install: https://aka.ms/install-azure-cli"
    exit 1
}

# Check Azure Functions Core Tools
try {
    $funcVersion = func --version 2>$null
    Write-Success "Azure Functions Core Tools version $funcVersion"
} catch {
    Write-Info "Azure Functions Core Tools not found (optional for deployment)"
}

# Login check with cloud support
Write-Step "Checking Azure login..."
Write-Info "Required: Owner or Contributor role on subscription or target resource group"

# Resolve the target cloud:
# - If -Cloud was explicitly passed (non-empty), honour it and switch if needed.
# - If -Cloud is empty (the default), inherit whatever cloud the CLI is already
#   pointing at. This lets users run 'az cloud set' before the script without
#   also needing to pass -Cloud on every invocation.
$currentCloud = (az cloud show --query name -o tsv 2>$null).Trim()
if (-not $currentCloud) { $currentCloud = "AzureCloud" }

if ($Cloud) {
    # Explicit cloud requested - switch if the CLI is not already there.
    if ($currentCloud -ne $Cloud) {
        Write-Info "Switching CLI to $Cloud (requested via -Cloud parameter)..."
        az cloud set --name $Cloud
        Write-Info "CLI is now targeting $Cloud"
    }
} else {
    # Inherit the current CLI cloud and update \$Cloud so the rest of the script
    # (display, validation messages) reflects the actual environment.
    $Cloud = $currentCloud
}

$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Info "Not logged in. Starting login to $Cloud..."
    az login
    $account = az account show | ConvertFrom-Json
}

Write-Success "Logged in as: $($account.user.name)"
Write-Success "Cloud: $Cloud"

# Set subscription if specified
if ($SubscriptionId) {
    Write-Step "Setting subscription to $SubscriptionId..."
    az account set --subscription $SubscriptionId
    Write-Success "Subscription set"
} else {
    Write-Info "Using current subscription: $($account.name)"
}

# Validate workspace ID format
if ($WorkspaceId -notmatch '^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$') {
    Write-Error "Invalid Workspace ID format. Expected GUID format."
    exit 1
}

# Validate storage account name
if ($StorageAccountName -notmatch '^[a-z0-9]{3,24}$') {
    Write-Error "Invalid Storage Account name. Must be 3-24 characters, lowercase letters and numbers only."
    Write-Info "Current value: $StorageAccountName"
    exit 1
}

# Display deployment plan
Write-Host "`n================================================" -ForegroundColor Magenta
Write-Host "Deployment Plan" -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "Project Name:      $ProjectName"
Write-Host "Resource Group:    $ResourceGroupName"
Write-Host "Location:          $Location"
Write-Host "Storage Account:   $StorageAccountName"
Write-Host "Function App:      $FunctionAppName"
Write-Host "Static Web App:    $StaticWebAppName"
Write-Host "Azure Maps:        $AzureMapsAccountName"
Write-Host "Workspace ID:      $WorkspaceId"
Write-Host "================================================`n" -ForegroundColor Magenta

$confirmation = Read-Host "Proceed with deployment? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Info "Deployment cancelled."
    exit 0
}

# Start deployment
$startTime = Get-Date

# 1. Create or Verify Resource Group
Write-Step "Checking resource group..."
$rgExists = az group exists --name $ResourceGroupName

if ($rgExists -eq "true") {
    Write-Info "Resource group already exists: $ResourceGroupName"
    $existingRg = az group show --name $ResourceGroupName | ConvertFrom-Json
    Write-Info "Location: $($existingRg.location)"
} else {
    Write-Info "Creating new resource group..."
    az group create `
        --name $ResourceGroupName `
        --location $Location `
        --output none
    Write-Success "Resource group created: $ResourceGroupName"
}

# 2. Create or Verify Storage Account
Write-Step "Checking storage account..."
$storageExists = az storage account check-name --name $StorageAccountName | ConvertFrom-Json

if ($storageExists.nameAvailable -eq $false -and $storageExists.reason -eq "AlreadyExists") {
    Write-Info "Storage account already exists: $StorageAccountName"
    # Verify it's in our resource group
    try {
        $existingStorage = az storage account show --name $StorageAccountName --resource-group $ResourceGroupName 2>$null | ConvertFrom-Json
        Write-Success "Using existing storage account in resource group"
    } catch {
        Write-Error "Storage account '$StorageAccountName' exists but not in resource group '$ResourceGroupName'"
        exit 1
    }
} else {
    Write-Info "Creating new storage account..."
    az storage account create `
        --name $StorageAccountName `
        --resource-group $ResourceGroupName `
        --location $Location `
        --sku Standard_LRS `
        --kind StorageV2 `
        --allow-blob-public-access false `
        --min-tls-version TLS1_2 `
        --require-infrastructure-encryption `
        --output none
    Write-Success "Storage account created: $StorageAccountName"
}

# 3. Create Blob Containers
Write-Step "Creating blob containers..."

# Use --auth-mode login (current user credential) — no storage key needed
    az storage container create `
        --name datasets `
        --account-name $StorageAccountName `
        --auth-mode login `
        --output none

    az storage container create `
        --name locks `
        --account-name $StorageAccountName `
        --auth-mode login `
        --output none

Write-Success "Containers created: datasets, locks"

# 4. Create Function App
Write-Step "Creating Function App..."

# Check if function app already exists
$funcExists = az functionapp show --name $FunctionAppName --resource-group $ResourceGroupName 2>$null

if ($funcExists) {
    Write-Info "Function app already exists: $FunctionAppName"
    Write-Info "Skipping creation, will update configuration..."
} else {
    Write-Info "Creating new function app with consumption plan..."
    
    # Create Function App with consumption plan (no separate plan needed)
    az functionapp create `
        --resource-group $ResourceGroupName `
        --name $FunctionAppName `
        --storage-account $StorageAccountName `
        --consumption-plan-location $Location `
        --runtime python `
        --runtime-version 3.11 `
        --functions-version 4 `
        --os-type Linux `
        --disable-app-insights false `
        --output none
    
    Write-Success "Function App created: $FunctionAppName"
}

# Enable managed identity if not already enabled
Write-Info "Ensuring managed identity is enabled..."
az functionapp identity assign `
    --resource-group $ResourceGroupName `
    --name $FunctionAppName `
    --output none 2>$null

Write-Success "Managed identity configured"

# Fetch the Function App's managed identity principal ID
$principalId = az functionapp identity show `
    --resource-group $ResourceGroupName `
    --name $FunctionAppName `
    --query principalId `
    --output tsv

# 5. Create Azure Maps Account
Write-Step "Creating Azure Maps Account..."

# Check if Azure Maps account already exists
$mapsExists = az maps account show --name $AzureMapsAccountName --resource-group $ResourceGroupName 2>$null

if ($mapsExists) {
    Write-Info "Azure Maps account already exists: $AzureMapsAccountName"
} else {
    Write-Info "Creating new Azure Maps account (Gen2 - Standard S0 with weather tile support)..."
    az maps account create `
        --name $AzureMapsAccountName `
        --resource-group $ResourceGroupName `
        --sku "G2" `
        --kind "Gen2" `
        --accept-tos `
        --output none
    Write-Success "Azure Maps account created: $AzureMapsAccountName"
}

# Retrieve the Maps primary key now so it can be written directly into the Function App
# app settings below.  The key is served to the browser at runtime by /api/config
# (api/config/__init__.py ← os.environ['AZURE_MAPS_SUBSCRIPTION_KEY']) — it is
# never stored in a static file.  To rotate the key, rerun this block or update
# the app setting manually with:
#   az maps account keys renew --name <account> --resource-group <rg> --key primary
#   az functionapp config appsettings set --name <func> --resource-group <rg> \
#       --settings AZURE_MAPS_SUBSCRIPTION_KEY=<new-key>
$mapsKey = az maps account keys list `
    --name $AzureMapsAccountName `
    --resource-group $ResourceGroupName `
    --query primaryKey `
    --output tsv

if ($mapsKey) {
    Write-Success "Azure Maps primary key retrieved"
} else {
    Write-Warning "Could not retrieve Maps key — set AZURE_MAPS_SUBSCRIPTION_KEY manually in Function App settings"
    $mapsKey = ''
}

# 7. Create Static Web App
Write-Step "Creating Static Web App..."

# Check if SWA already exists
$swaExists = az staticwebapp show --name $StaticWebAppName --resource-group $ResourceGroupName 2>$null

if ($swaExists) {
    Write-Info "Static Web App already exists: $StaticWebAppName"
} else {
    Write-Info "Creating new Static Web App (Standard SKU for BYO Functions)..."
    az staticwebapp create `
        --name $StaticWebAppName `
        --resource-group $ResourceGroupName `
        --location $SwaLocation `
        --sku "Standard" `
        --output none
    Write-Success "Static Web App created: $StaticWebAppName"
}

# Get SWA deployment token
$swaToken = az staticwebapp secrets list `
    --name $StaticWebAppName `
    --resource-group $ResourceGroupName `
    --query properties.apiKey `
    --output tsv

Write-Success "Static Web App deployment token retrieved"

Write-Info "SWA deployment token retrieved — see Next Steps to set AZURE_STATIC_WEB_APPS_API_TOKEN"

# Configure SWA app settings
Write-Info "Configuring Static Web App settings..."
$storageUrl = "https://$StorageAccountName.blob.core.windows.net"
az staticwebapp appsettings set `
    --name $StaticWebAppName `
    --resource-group $ResourceGroupName `
    --setting-names `
        STORAGE_ACCOUNT_URL=$storageUrl `
        STORAGE_CONTAINER_DATASETS=datasets `
    --output none

Write-Success "Static Web App settings configured"

# Update web/config.js with the actual storage account URL so the frontend
# fallback matches this deployment without any manual edits.
# (The value is also served at runtime by /api/config — this only affects
# the cold-start fallback that loads before /api/config responds.)
$configJsPath = Join-Path $PSScriptRoot "web\config.js"
if (Test-Path $configJsPath) {
    $configContent = Get-Content $configJsPath -Raw
    $configContent = $configContent -replace "window\.STORAGE_ACCOUNT_URL\s*=\s*'[^']*'", "window.STORAGE_ACCOUNT_URL = '$storageUrl'"
    Set-Content $configJsPath $configContent -NoNewline
    Write-Success "web/config.js updated: STORAGE_ACCOUNT_URL = $storageUrl"
} else {
    Write-Info "web/config.js not found — copy web/config.sample.js to web/config.js and set STORAGE_ACCOUNT_URL = $storageUrl"
}

# Function App-specific configuration (skip if -SkipFunctionApp is specified)
if (-not $SkipFunctionApp) {
    # 8. Configure App Settings
    Write-Step "Configuring application settings..."

    $storageUrl = "https://$StorageAccountName.blob.core.windows.net"

    az functionapp config appsettings set `
        --resource-group $ResourceGroupName `
        --name $FunctionAppName `
        --settings `
            SENTINEL_WORKSPACE_ID=$WorkspaceId `
            STORAGE_ACCOUNT_URL=$storageUrl `
            STORAGE_CONTAINER_DATASETS=datasets `
            DEFAULT_QUERY_TIME_WINDOW_HOURS=24 `
            INCREMENTAL_OVERLAP_MINUTES=10 `
            AZURE_MAPS_SUBSCRIPTION_KEY=$mapsKey `
            MAXMIND_ACCOUNT_ID='' `
            MAXMIND_LICENSE_KEY='' `
        --output none

    Write-Info "Note: MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY must be set manually (free credentials from maxmind.com/en/geolite2/signup)."
    Write-Success "Application settings configured"

    # Configure CORS - allow requests from the Static Web App and local dev
    Write-Info "Configuring Function App CORS..."
    $swaHostname = az staticwebapp show `
        --name $StaticWebAppName `
        --resource-group $ResourceGroupName `
        --query defaultHostname `
        --output tsv 2>$null
    if ($swaHostname) {
        az functionapp cors add `
            --name $FunctionAppName `
            --resource-group $ResourceGroupName `
            --allowed-origins "https://$swaHostname" `
            --output none 2>$null
        Write-Success "CORS: https://$swaHostname"
    }
    az functionapp cors add `
        --name $FunctionAppName `
        --resource-group $ResourceGroupName `
        --allowed-origins "http://localhost:7071" `
        --output none 2>$null
    Write-Success "CORS: http://localhost:7071 (local dev)"

    # 9. Assign RBAC Roles
    Write-Step "Assigning RBAC roles..."

    # Storage Blob Data Contributor role
    $storageAccountId = az storage account show `
        --name $StorageAccountName `
        --resource-group $ResourceGroupName `
        --query id `
        --output tsv

    az role assignment create `
        --assignee $principalId `
        --role "Storage Blob Data Contributor" `
        --scope $storageAccountId `
        --output none
    Write-Success "Assigned Storage Blob Data Contributor to Function App MI"

    # Also grant the deploying user Storage Blob Data Contributor so --auth-mode login
    # works during the demo data upload below. Subscription Owner/Contributor does not
    # automatically include storage data-plane access.
    $deployerOid = az ad signed-in-user show --query id --output tsv 2>$null
    if ($deployerOid) {
        az role assignment create `
            --assignee $deployerOid `
            --role "Storage Blob Data Contributor" `
            --scope $storageAccountId `
            --output none 2>$null
        Write-Success "Assigned Storage Blob Data Contributor to deploying user"
    }

    # 9b. Upload demo data
    # Wait for RBAC + infrastructure encryption to propagate. Retry each file
    # up to 3 times with increasing delays (encryption can extend propagation).
    Write-Step "Uploading demo data to blob storage (waiting 30 s for RBAC propagation)..."
    Start-Sleep -Seconds 30
    $demoDataDir = Join-Path $PSScriptRoot "demo_data"
    if (Test-Path $demoDataDir) {
        # Static files that also live at the container root so they are available
        # without demo mode. threat-actors.tsv drives the threat actors heatmap;
        # custom-source.geojson is the starter template users replace with their own data.
        $staticRootFiles = @('threat-actors.tsv', 'custom-source.geojson')
        Get-ChildItem -Path $demoDataDir -File | Where-Object { $_.Name -in $staticRootFiles } | ForEach-Object {
            $blobName = $_.Name   # container root, not demo_data/
            $uploaded = $false
            foreach ($delaySec in @(0, 30, 60)) {
                if ($delaySec -gt 0) {
                    Write-Info "  Retrying $blobName in ${delaySec}s (RBAC still propagating)..."
                    Start-Sleep -Seconds $delaySec
                }
                az storage blob upload `
                    --account-name $StorageAccountName `
                    --container-name datasets `
                    --name $blobName `
                    --file $_.FullName `
                    --auth-mode login `
                    --overwrite `
                    --output none 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Uploaded (root): $blobName"
                    $uploaded = $true
                    break
                }
            }
            if (-not $uploaded) {
                Write-Warning "Failed to upload $blobName to container root after 3 attempts"
            }
        }

        Get-ChildItem -Path $demoDataDir -File | Where-Object { $_.Name -ne '.gitkeep' } | ForEach-Object {
            $blobName = "demo_data/$($_.Name)"
            $uploaded = $false
            foreach ($delaySec in @(0, 30, 60)) {
                if ($delaySec -gt 0) {
                    Write-Info "  Retrying $blobName in ${delaySec}s (RBAC still propagating)..."
                    Start-Sleep -Seconds $delaySec
                }
                az storage blob upload `
                    --account-name $StorageAccountName `
                    --container-name datasets `
                    --name $blobName `
                    --file $_.FullName `
                    --auth-mode login `
                    --overwrite `
                    --output none 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Uploaded: $blobName"
                    $uploaded = $true
                    break
                }
            }
            if (-not $uploaded) {
                Write-Warning "Failed to upload $blobName after 3 attempts - upload manually after RBAC propagates"
            }
        }
        Write-Success "Demo data upload complete"
    } else {
        Write-Info "demo_data/ directory not found - skipping demo data upload"
    }

    # Log Analytics Reader — look up workspace in the current subscription only.
    # If the workspace is in a different subscription, the search returns empty and
    # the script prints the manual assignment command to run after finding the resource ID.
    Write-Info "Looking up Log Analytics workspace '$WorkspaceId' in current subscription..."
    $workspaceResourceId = az monitor log-analytics workspace list `
        --query "[?customerId=='$WorkspaceId'].id | [0]" `
        --output tsv 2>$null
    if ($workspaceResourceId) {
        $workspaceRg = ($workspaceResourceId -split '/')[4]
        Write-Info "Found workspace (RG: $workspaceRg) - assigning Log Analytics Reader..."
        az role assignment create `
            --assignee $principalId `
            --role "Log Analytics Reader" `
            --scope $workspaceResourceId `
            --output none 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Assigned Log Analytics Reader on workspace (RG: $workspaceRg)"
        } else {
            Write-Warning "Could not assign Log Analytics Reader - you may not have role assignment permissions on this workspace."
            Write-Warning "Ask a workspace Owner to grant access via the portal (see Next Steps below, item 2)."
            Write-Warning "Function App MI principal ID to share with them: $principalId"
        }
    } else {
        Write-Warning "Workspace $WorkspaceId not found in the current subscription (it may be in a different subscription)."
        Write-Warning "Ask a workspace Owner to grant access via the portal (see Next Steps below, item 2)."
        Write-Warning "Function App MI principal ID to share with them: $principalId"
    }

    # 10. Deploy Function Code
    Write-Step "Deploying function code (with remote build for Python dependencies)..."

# Check if in api directory (check subdirectory first — project root also has a host.json)
$currentPath = Get-Location
if (Test-Path ".\api\host.json") {
    $apiPath = Join-Path $currentPath "api"
} elseif (Test-Path ".\host.json") {
    $apiPath = $currentPath
} else {
    Write-Error "Cannot find api/host.json. Please run from the project root or api directory."
    exit 1
}

Push-Location $apiPath

# Deploy using func CLI if available, otherwise use zip deploy
try {
    if (Get-Command func -ErrorAction SilentlyContinue) {
        func azure functionapp publish $FunctionAppName --python
        Write-Success "Function deployed successfully using func CLI"
    } else {
        # Fallback: zip deploy with locally-vendored packages
        # (mirrors the GitHub Actions workflow exactly — no remote build needed)
        Write-Info "func CLI not found. Building zip with vendored packages..."

        # Create temporary build directory
        $buildDir = Join-Path $env:TEMP "$ProjectName-build"
        if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
        New-Item -ItemType Directory -Path $buildDir | Out-Null

        # Copy function files (host.json + per-function folders; skip venv/cache)
        Copy-Item -Path "host.json" -Destination $buildDir
        Copy-Item -Path "requirements.txt" -Destination $buildDir
        Get-ChildItem -Path "." -Directory |
            Where-Object { $_.Name -notin @('.venv', '__pycache__', '.git') } |
            ForEach-Object { Copy-Item -Path $_.FullName -Destination $buildDir -Recurse }

        # Vendor Python packages into .python_packages/lib/site-packages
        $pkgDir = "$buildDir\.python_packages\lib\site-packages"
        New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null
        Write-Info "Installing Python packages into zip (this may take a minute)..."
        pip install -r requirements.txt --target $pkgDir --quiet
        # Remove Azure SDK namespace __init__.py files that break cross-package imports
        @("azure", "azure\storage", "azure\monitor") | ForEach-Object {
            $f = "$pkgDir\$_\__init__.py"
            if (Test-Path $f) { Remove-Item $f -Force }
        }

        # Create and deploy zip
        $zipPath = Join-Path $env:TEMP "$ProjectName-deploy.zip"
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        Compress-Archive -Path "$buildDir\*" -DestinationPath $zipPath

        # Deploy via Kudu zip deploy REST API
        # (az functionapp deploy --type zip is preview and broken on Linux Consumption Plan)
        Write-Info "Uploading zip to $FunctionAppName via Kudu..."
        $creds = az functionapp deployment list-publishing-credentials `
            --name $FunctionAppName `
            --resource-group $ResourceGroupName `
            --query '{user:publishingUserName, pass:publishingPassword}' `
            --output json | ConvertFrom-Json
        $base64Auth = [Convert]::ToBase64String(
            [Text.Encoding]::ASCII.GetBytes("$($creds.user):$($creds.pass)"))
        $zipBytes = [System.IO.File]::ReadAllBytes($zipPath)
        $kuduUri = "https://$FunctionAppName.scm.azurewebsites.net/api/zipdeploy"
        Invoke-RestMethod -Uri $kuduUri -Method POST `
            -Headers @{ Authorization = "Basic $base64Auth"; 'Content-Type' = 'application/zip' } `
            -Body $zipBytes | Out-Null

        Remove-Item $buildDir -Recurse -Force
        Remove-Item $zipPath -Force

        Write-Success "Function deployed successfully using zip deploy"
    }
} catch {
    Write-Error "Function deployment failed: $_"
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# Link Function App as the SWA backend so /api/* routes proxy correctly
Write-Step "Linking Function App as Static Web App backend..."
$functionAppId = az functionapp show `
    --name $FunctionAppName `
    --resource-group $ResourceGroupName `
    --query id `
    --output tsv

try {
    az staticwebapp backends link `
        --name $StaticWebAppName `
        --resource-group $ResourceGroupName `
        --backend-resource-id $functionAppId `
        --backend-region $Location `
        --output none
    Write-Success "Function App linked as SWA backend — /api/* now proxies to $FunctionAppName"
} catch {
    Write-Info "Backend link failed (may already be linked or require Standard SKU) — verify in portal"
}

# Update the GitHub Actions workflow with the actual Function App name,
# then fetch the publish profile and push it as a repo secret so the
# workflow can deploy without a pre-configured App Registration.
# Find the Function App workflow file (named by Azure when the app was created).
$funcWorkflowPath = Get-ChildItem (Join-Path $PSScriptRoot ".github\workflows") -Filter "main_func-*.yml" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $funcWorkflowPath) { $funcWorkflowPath = Join-Path $PSScriptRoot ".github\workflows\main_func-$FunctionAppName.yml" }
$funcSecretSet = $false
if (Test-Path $funcWorkflowPath) {
    $wfContent = Get-Content $funcWorkflowPath -Raw
    $wfContent = $wfContent -replace "app-name: '[^']*'", "app-name: '$FunctionAppName'"
    Set-Content $funcWorkflowPath $wfContent -NoNewline
    Write-Success "$funcWorkflowPath updated: app-name = $FunctionAppName"
} else {
    Write-Info "Workflow file not found at $funcWorkflowPath — update app-name manually"
}

$publishProfile = az functionapp deployment list-publishing-profiles `
    --name $FunctionAppName `
    --resource-group $ResourceGroupName `
    --xml
if ($publishProfile -and (Get-Command gh -ErrorAction SilentlyContinue)) {
    try {
        $publishProfile | gh secret set AZURE_FUNCTIONAPP_PUBLISH_PROFILE --app actions 2>$null
        Write-Success "GitHub secret AZURE_FUNCTIONAPP_PUBLISH_PROFILE set (used by $funcWorkflowPath)"
        $funcSecretSet = $true
    } catch {
        Write-Info "gh secret set failed — see Next Steps to set AZURE_FUNCTIONAPP_PUBLISH_PROFILE manually"
    }
} else {
    if (-not $publishProfile) {
        Write-Info "Could not retrieve publish profile — see Next Steps"
    } else {
        Write-Info "GitHub CLI (gh) not found — see Next Steps to set AZURE_FUNCTIONAPP_PUBLISH_PROFILE manually"
    }
}
} # end if (-not $SkipFunctionApp) — steps 8-10, linking, and CI/CD setup

# Summary
$duration = (Get-Date) - $startTime
Write-Host "`n================================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "Duration:          $($duration.Minutes)m $($duration.Seconds)s"
Write-Host "Resource Group:    $ResourceGroupName"
if (-not $SkipFunctionApp) {
    Write-Host "Function App:      $FunctionAppName"
}
Write-Host "Storage Account:   $StorageAccountName"
Write-Host "Static Web App:    $StaticWebAppName"
Write-Host "Azure Maps:        $AzureMapsAccountName"
if (-not $SkipFunctionApp) {
    Write-Host "`nApp URL:    https://$swaHostname"
    Write-Host "Health:     https://$swaHostname/api/health"
    Write-Host "Refresh:    https://$swaHostname/api/refresh"
}
Write-Host "`n================================================" -ForegroundColor Green

if (-not $SkipFunctionApp) {
    Write-Host "`n  Next Steps:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Add MaxMind credentials (required for IP geo-enrichment):" -ForegroundColor Yellow
    Write-Host "     Sign up free: https://www.maxmind.com/en/geolite2/signup" -ForegroundColor White
    Write-Host "     az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroupName --settings MAXMIND_ACCOUNT_ID='<id>' MAXMIND_LICENSE_KEY='<key>'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  2. Deploy the frontend - set this token as GitHub secret AZURE_STATIC_WEB_APPS_API_TOKEN:" -ForegroundColor Yellow
    Write-Host "     $swaToken" -ForegroundColor Cyan
    Write-Host "     GitHub repo -> Settings -> Secrets and variables -> Actions -> New secret" -ForegroundColor White
    Write-Host "     Then trigger the workflow from the Actions tab (or push any change to web/)." -ForegroundColor White
    Write-Host ""
    if (-not $funcSecretSet) {
        Write-Host "  3. (Optional) Function App CI/CD - set GitHub secret AZURE_FUNCTIONAPP_PUBLISH_PROFILE:" -ForegroundColor Yellow
        Write-Host "     az functionapp deployment list-publishing-profiles --name $FunctionAppName --resource-group $ResourceGroupName --xml | gh secret set AZURE_FUNCTIONAPP_PUBLISH_PROFILE" -ForegroundColor Cyan
        Write-Host "     The function code is already deployed - this is only needed for future pushes to api/." -ForegroundColor White
        Write-Host ""
    }
    Write-Host "  4. Grant Log Analytics Reader on your Sentinel workspace to the Function App MI:" -ForegroundColor Yellow
    Write-Host "     Function App MI principal ID: $principalId" -ForegroundColor White
    Write-Host "     See README.md - Deployment section for portal instructions (same-sub and cross-sub)." -ForegroundColor White
    Write-Host ""
    Write-Host "  See README.md for full configuration options, custom data, and troubleshooting." -ForegroundColor Gray
}
