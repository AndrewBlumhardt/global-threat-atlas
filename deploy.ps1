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
    Azure region for resources (default: eastus)

.PARAMETER StorageAccountName
    Storage account name (must be globally unique, lowercase, 3-24 chars, alphanumeric only).
    Default: derived from ProjectName with random 5-digit suffix.

.PARAMETER FunctionAppName
    Function app name (must be globally unique).
    Default: func-<ProjectName>-XXXXX

.PARAMETER StaticWebAppName
    Static Web App name.
    Default: swa-<ProjectName>

.PARAMETER AzureMapsAccountName
    Azure Maps account name.
    Default: maps-<ProjectName>-XXXX

.PARAMETER WorkspaceId
    Log Analytics Workspace ID (required for function to work)

.PARAMETER SubscriptionId
    Azure subscription ID (uses current subscription if not specified)

.PARAMETER Cloud
    Azure cloud environment (AzureCloud, AzureUSGovernment)
    Default: AzureCloud (Commercial)
    AzureUSGovernment supports both GCC and GCC-High

.EXAMPLE
    .\deploy.ps1 -WorkspaceId "12345678-1234-1234-1234-123456789012"

.EXAMPLE
    .\deploy.ps1 -ProjectName "contoso-threat-map" -WorkspaceId "12345678-1234-1234-1234-123456789012"

.EXAMPLE
    .\deploy.ps1 -ProjectName "contoso-threat-map" -ResourceGroupName "rg-security-tools" -WorkspaceId "12345678-1234-1234-1234-123456789012"

.EXAMPLE
    .\deploy.ps1 -ProjectName "contoso-threat-map" -Location "westus2" -WorkspaceId "12345678-1234-1234-1234-123456789012"

.EXAMPLE
    .\deploy.ps1 -WorkspaceId "12345678-1234-1234-1234-123456789012" -Cloud AzureUSGovernment

.NOTES
    Requires Owner or Contributor role on the subscription or target resource group
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectName = "global-threat-atlas",

    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "",
    
    [Parameter(Mandatory=$false)]
    [string]$StorageAccountName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$FunctionAppName = "",
    
    [Parameter(Mandatory=$true)]
    [string]$WorkspaceId,
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("AzureCloud", "AzureUSGovernment")]
    [string]$Cloud = "AzureCloud",
    
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
if ($storageSlug.Length -gt 19) { $storageSlug = $storageSlug.Substring(0, 19) }
if ($storageSlug.Length -lt 3)  { $storageSlug = $storageSlug.PadRight(3, '0') }

if (-not $Location)             { $Location             = "eastus" }
if (-not $ResourceGroupName)    { $ResourceGroupName    = "rg-$ProjectName" }
if (-not $StorageAccountName)   { $StorageAccountName   = "${storageSlug}$(Get-Random -Minimum 10000 -Maximum 99999)" }
if (-not $FunctionAppName)      { $FunctionAppName      = "func-$ProjectName-$(Get-Random -Minimum 10000 -Maximum 99999)" }
if (-not $StaticWebAppName)     { $StaticWebAppName     = "swa-$ProjectName" }
if (-not $AzureMapsAccountName) { $AzureMapsAccountName = "maps-$ProjectName-$(Get-Random -Minimum 1000 -Maximum 9999)" }

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

$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Info "Not logged in. Starting login to $Cloud..."
    if ($Cloud -eq "AzureUSGovernment") {
        az cloud set --name AzureUSGovernment
        Write-Info "Switched to Azure US Government cloud"
    }
    az login
    $account = az account show | ConvertFrom-Json
} else {
    # Verify we're in the correct cloud
    $currentCloud = az cloud show --query name -o tsv
    $targetCloud = if ($Cloud -eq "AzureUSGovernment") { "AzureUSGovernment" } else { "AzureCloud" }
    if ($currentCloud -ne $targetCloud) {
        Write-Info "Switching to $Cloud..."
        az cloud set --name $targetCloud
        az login
        $account = az account show | ConvertFrom-Json
    }
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
Write-Host "Location:          $Location  (tip: set -Location to deploy closer to your workspace)"
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
        --output none
    Write-Success "Storage account created: $StorageAccountName"
}

# 3. Create Blob Containers
Write-Step "Creating blob containers..."

# Get storage account key for container creation
$storageKey = az storage account keys list `
    --resource-group $ResourceGroupName `
    --account-name $StorageAccountName `
    --query '[0].value' `
    --output tsv

# Use account name (no key) for container creation - requires Azure CLI authentication
    az storage container create `
        --name datasets `
        --account-name $StorageAccountName `
        --output none

    az storage container create `
        --name locks `
        --account-name $StorageAccountName `
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
        --location $Location `
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

# Push the deployment token into the GitHub repo secret so the Actions workflow
# can deploy immediately without any manual copy-paste.
# Mirrors the Maps key and storage URL auto-configuration steps above.
$swaSecretSet = $false
if (Get-Command gh -ErrorAction SilentlyContinue) {
    try {
        $swaToken | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --app actions 2>$null
        Write-Success "GitHub secret AZURE_STATIC_WEB_APPS_API_TOKEN set in repo (used by .github/workflows/azure-static-web-apps.yml)"
        $swaSecretSet = $true
    } catch {
        Write-Info "gh secret set failed — see Next Steps to set AZURE_STATIC_WEB_APPS_API_TOKEN manually"
    }
} else {
    Write-Info "GitHub CLI (gh) not found — see Next Steps to set AZURE_STATIC_WEB_APPS_API_TOKEN manually"
}

# Enable Managed Identity on Static Web App
Write-Info "Enabling Managed Identity on Static Web App..."
az staticwebapp identity assign `
    --name $StaticWebAppName `
    --resource-group $ResourceGroupName `
    --output none

Write-Success "Managed Identity enabled on Static Web App"

# Get SWA Managed Identity Principal ID
$swaPrincipalId = az staticwebapp identity show `
    --name $StaticWebAppName `
    --resource-group $ResourceGroupName `
    --query principalId `
    --output tsv

Write-Info "SWA Principal ID: $swaPrincipalId"

# Grant Function App and SWA blob storage access via RBAC
Write-Step "Granting storage access roles..."
$storageId = az storage account show `
    --name $StorageAccountName `
    --resource-group $ResourceGroupName `
    --query id `
    --output tsv

az role assignment create `
    --assignee $principalId `
    --role "Storage Blob Data Reader" `
    --scope $storageId `
    --output none
Write-Success "Function App: Storage Blob Data Reader"

az role assignment create `
    --assignee $swaPrincipalId `
    --role "Storage Blob Data Reader" `
    --scope $storageId `
    --output none
Write-Success "Static Web App: Storage Blob Data Reader"

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

    # Switch AzureWebJobsStorage from key-based (set by functionapp create) to identity-based.
    # This allows the storage account to have shared key access disabled.
    Write-Info "Switching Function App runtime storage to identity-based (Managed Identity)..."
    az functionapp config appsettings delete `
        --resource-group $ResourceGroupName `
        --name $FunctionAppName `
        --setting-names AzureWebJobsStorage `
        --output none 2>$null

    az functionapp config appsettings set `
        --resource-group $ResourceGroupName `
        --name $FunctionAppName `
        --settings `
            AzureWebJobsStorage__accountName=$StorageAccountName `
            SENTINEL_WORKSPACE_ID=$WorkspaceId `
            STORAGE_ACCOUNT_URL=$storageUrl `
            STORAGE_CONTAINER_DATASETS=datasets `
            DEFAULT_QUERY_TIME_WINDOW_HOURS=24 `
            INCREMENTAL_OVERLAP_MINUTES=10 `
            AzureWebJobsFeatureFlags=EnableWorkerIndexing `
            AZURE_MAPS_SUBSCRIPTION_KEY=$mapsKey `
            MAXMIND_LICENSE_KEY='' `
        --output none

    Write-Info "Note: MAXMIND_LICENSE_KEY must be set manually (free key from maxmind.com/en/geolite2/signup)."
    Write-Success "Application settings configured — runtime storage uses Managed Identity (no storage keys)"

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
    Write-Success "Assigned Storage Blob Data Contributor role"

    # Runtime storage roles — required for identity-based AzureWebJobsStorage
    # (replaces the key-based connection string set by az functionapp create)
    Write-Info "Assigning Function App runtime storage roles (for identity-based AzureWebJobsStorage)..."
    az role assignment create `
        --assignee $principalId `
        --role "Storage Blob Data Owner" `
        --scope $storageAccountId `
        --output none
    az role assignment create `
        --assignee $principalId `
        --role "Storage Queue Data Contributor" `
        --scope $storageAccountId `
        --output none
    az role assignment create `
        --assignee $principalId `
        --role "Storage Table Data Contributor" `
        --scope $storageAccountId `
        --output none
    Write-Success "Assigned runtime storage roles (Blob Owner, Queue Contributor, Table Contributor)"

    # Log Analytics Reader role (if workspace is in same subscription)
    Write-Info "Note: You may need to manually assign 'Log Analytics Reader' role to the Function App's managed identity on your Log Analytics Workspace"
    Write-Info "Principal ID: $principalId"

    # 10. Deploy Function Code
    Write-Step "Deploying function code (with remote build for Python dependencies)..."

# Check if in api directory
$currentPath = Get-Location
if (Test-Path ".\function_app.py") {
    $apiPath = $currentPath
} elseif (Test-Path ".\api\function_app.py") {
    $apiPath = Join-Path $currentPath "api"
} else {
    Write-Error "Cannot find function_app.py. Please run from project root or api directory."
    exit 1
}

Push-Location $apiPath

# Deploy using func CLI if available, otherwise use zip deploy
try {
    if (Get-Command func -ErrorAction SilentlyContinue) {
        func azure functionapp publish $FunctionAppName --python
        Write-Success "Function deployed successfully using func CLI"
    } else {
        # Fallback to zip deploy
        Write-Info "Deploying using zip deploy method..."
        
        # Create temporary build directory
        $buildDir = Join-Path $env:TEMP "$ProjectName-build"
        if (Test-Path $buildDir) {
            Remove-Item $buildDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $buildDir | Out-Null
        
        # Copy necessary files
        Copy-Item -Path "function_app.py" -Destination $buildDir
        Copy-Item -Path "host.json" -Destination $buildDir
        Copy-Item -Path "requirements.txt" -Destination $buildDir
        Copy-Item -Path "sources.yaml" -Destination $buildDir
        Copy-Item -Path "shared" -Destination $buildDir -Recurse
        
        # Create zip file
        $zipPath = Join-Path $env:TEMP "$ProjectName-deploy.zip"
        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }
        
        Compress-Archive -Path "$buildDir\*" -DestinationPath $zipPath
        
        # Deploy zip
        az functionapp deployment source config-zip `
            --resource-group $ResourceGroupName `
            --name $FunctionAppName `
            --src $zipPath `
            --build-remote true `
            --timeout 600 `
            --output none
        
        # Cleanup
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
    Write-Host "`nFunction Endpoints:"
    Write-Host "  Health:  https://$FunctionAppName.azurewebsites.net/api/health"
    Write-Host "  Refresh: https://$FunctionAppName.azurewebsites.net/api/refresh"
}
Write-Host "`n================================================" -ForegroundColor Green

if (-not $SkipFunctionApp) {
    Write-Host "`n⚠️  Important Next Steps:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Add secrets to Key Vault:" -ForegroundColor Yellow
    Write-Host "   Required secrets for the application to function:" -ForegroundColor White
    Write-Host ""
    Write-Host "   a) Azure Maps key: already configured automatically as AZURE_MAPS_SUBSCRIPTION_KEY." -ForegroundColor Green
    Write-Host "      To rotate: az maps account keys renew --name $AzureMapsAccountName --resource-group $ResourceGroupName --key primary" -ForegroundColor Gray
    Write-Host "      Then:      az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroupName --settings AZURE_MAPS_SUBSCRIPTION_KEY=<new-key>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   b) Storage Account URL: already written into web/config.js as STORAGE_ACCOUNT_URL." -ForegroundColor Green
    Write-Host "      ($storageUrl)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   c) MaxMind License Key (REQUIRED for IP geo-enrichment):" -ForegroundColor Cyan
    Write-Host "      # Sign up free at https://www.maxmind.com/en/geolite2/signup" -ForegroundColor Gray
    Write-Host "      az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroupName --settings MAXMIND_LICENSE_KEY='<your-key>'" -ForegroundColor Cyan
    Write-Host ""
    if ($swaSecretSet) {
        Write-Host "   d) GitHub Actions SWA token: already set as AZURE_STATIC_WEB_APPS_API_TOKEN repo secret." -ForegroundColor Green
        Write-Host "      To rotate: re-run this script (or retrieve the token and run: gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN)" -ForegroundColor Gray
    } else {
        Write-Host "   d) GitHub Actions SWA token: set manually so the Actions workflow can deploy the frontend." -ForegroundColor Yellow
        Write-Host "      gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --body '$swaToken'" -ForegroundColor Cyan
        Write-Host "      Or: GitHub repo → Settings → Secrets and variables → Actions → New repository secret" -ForegroundColor White
        Write-Host "      Name: AZURE_STATIC_WEB_APPS_API_TOKEN   Value: (token shown above)" -ForegroundColor White
    }
    Write-Host ""
    if ($funcSecretSet) {
        Write-Host "   e) GitHub Actions Function App deploy: AZURE_FUNCTIONAPP_PUBLISH_PROFILE already set." -ForegroundColor Green
        Write-Host "      Workflow file updated: app-name = $FunctionAppName" -ForegroundColor Gray
        Write-Host "      To rotate: az functionapp deployment list-publishing-profiles --name $FunctionAppName --resource-group $ResourceGroupName --xml | gh secret set AZURE_FUNCTIONAPP_PUBLISH_PROFILE" -ForegroundColor Gray
    } else {
        Write-Host "   e) GitHub Actions Function App deploy: set the publish profile secret manually." -ForegroundColor Yellow
        Write-Host "      az functionapp deployment list-publishing-profiles --name $FunctionAppName --resource-group $ResourceGroupName --xml | gh secret set AZURE_FUNCTIONAPP_PUBLISH_PROFILE" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "2. Assign 'Log Analytics Reader' role to the Function App on your Log Analytics Workspace" -ForegroundColor Yellow
    Write-Host "   Principal ID: $principalId" -ForegroundColor White
    Write-Host ""
    Write-Host "   Option A - Via Function App Identity (Easiest):" -ForegroundColor Cyan
    Write-Host "   1. Go to Azure Portal → Function App '$FunctionAppName'" -ForegroundColor White
    Write-Host "   2. Click 'Identity' in the left menu" -ForegroundColor White
    Write-Host "   3. Go to 'Azure role assignments' tab" -ForegroundColor White
    Write-Host "   4. Click '+ Add role assignment'" -ForegroundColor White
    Write-Host "   5. Scope: Select your Log Analytics Workspace" -ForegroundColor White
    Write-Host "   6. Role: Select 'Log Analytics Reader'" -ForegroundColor White
    Write-Host "   7. Click 'Save'" -ForegroundColor White
    Write-Host ""
    Write-Host "   Option B - Azure CLI:" -ForegroundColor Cyan
    Write-Host "   az role assignment create --assignee $principalId --role 'Log Analytics Reader' --scope /subscriptions/<sub-id>/resourceGroups/<workspace-rg>/providers/Microsoft.OperationalInsights/workspaces/<workspace-name>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Test the deployment:" -ForegroundColor Yellow
    Write-Host "   Invoke-RestMethod https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. Trigger a data refresh:" -ForegroundColor Yellow
    Write-Host "   Invoke-RestMethod https://$FunctionAppName.azurewebsites.net/api/refresh" -ForegroundColor Cyan
}
