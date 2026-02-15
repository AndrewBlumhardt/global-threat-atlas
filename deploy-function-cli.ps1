#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy Azure Function via Azure CLI (bypasses GitHub Actions).
    
.DESCRIPTION
    This script deploys the Azure Function directly using Azure CLI.
    It packages the function code and deploys to an existing Function App.
    
.PARAMETER FunctionAppName
    Name of the Azure Function App
    
.PARAMETER ResourceGroup
    Azure Resource Group name
    
.PARAMETER SkipBuild
    Skip building the package (use existing .zip)
    
.EXAMPLE
    .\deploy-function-cli.ps1 -FunctionAppName "func-sentinel-maps" -ResourceGroup "rg-sentinel-maps"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$FunctionAppName,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Azure Function Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Function App: $FunctionAppName"
Write-Host "Resource Group: $ResourceGroup"
Write-Host ""

# Check Azure CLI
Write-Host "[1/6] Checking Azure CLI..." -ForegroundColor Yellow
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Host "  ✓ Azure CLI version: $($azVersion.'azure-cli')" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Azure CLI not found. Install from: https://aka.ms/InstallAzureCliWindows" -ForegroundColor Red
    exit 1
}

# Check login status
Write-Host "[2/6] Checking Azure login..." -ForegroundColor Yellow
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Host "  ✓ Logged in as: $($account.user.name)" -ForegroundColor Green
    Write-Host "  ✓ Subscription: $($account.name) ($($account.id))" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Not logged in. Run: az login" -ForegroundColor Red
    exit 1
}

# Verify function app exists
Write-Host "[3/6] Verifying Function App..." -ForegroundColor Yellow
try {
    $functionApp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
    if ($functionApp) {
        Write-Host "  ✓ Function App found: $($functionApp.defaultHostName)" -ForegroundColor Green
        Write-Host "  ✓ Runtime: $($functionApp.kind)" -ForegroundColor Green
    } else {
        throw "Function App not found"
    }
} catch {
    Write-Host "  ✗ Function App '$FunctionAppName' not found in resource group '$ResourceGroup'" -ForegroundColor Red
    Write-Host "  Run 'az functionapp list --output table' to see available function apps" -ForegroundColor Yellow
    exit 1
}

# Build package
if (-not $SkipBuild) {
    Write-Host "[4/6] Building deployment package..." -ForegroundColor Yellow
    
    $apiDir = Join-Path $PSScriptRoot "api"
    $tempDir = Join-Path $env:TEMP "sentinel-function-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $zipPath = Join-Path $PSScriptRoot "function-deployment.zip"
    
    # Remove old zip if exists
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
        Write-Host "  ✓ Removed old deployment package" -ForegroundColor Green
    }
    
    # Create temp directory
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    Write-Host "  ✓ Created temp directory: $tempDir" -ForegroundColor Green
    
    # Copy function files
    $filesToCopy = @(
        "function_app.py",
        "host.json",
        "requirements.txt",
        "sources.yaml"
    )
    
    foreach ($file in $filesToCopy) {
        $source = Join-Path $apiDir $file
        if (Test-Path $source) {
            Copy-Item $source -Destination $tempDir -Force
            Write-Host "  ✓ Copied: $file" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Warning: $file not found" -ForegroundColor Yellow
        }
    }
    
    # Copy shared directory
    $sharedSource = Join-Path $apiDir "shared"
    $sharedDest = Join-Path $tempDir "shared"
    if (Test-Path $sharedSource) {
        Copy-Item $sharedSource -Destination $tempDir -Recurse -Force
        
        # Remove __pycache__ directories
        Get-ChildItem -Path $tempDir -Filter "__pycache__" -Recurse -Directory | Remove-Item -Recurse -Force
        Write-Host "  ✓ Copied: shared/ (cleaned __pycache__)" -ForegroundColor Green
    }
    
    # Create zip
    Write-Host "  Creating ZIP archive..." -ForegroundColor Cyan
    Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
    
    $zipSize = (Get-Item $zipPath).Length / 1MB
    Write-Host "  ✓ Package created: function-deployment.zip ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
    
    # Clean up temp directory
    Remove-Item $tempDir -Recurse -Force
    
} else {
    Write-Host "[4/6] Skipping build (using existing package)..." -ForegroundColor Yellow
    $zipPath = Join-Path $PSScriptRoot "function-deployment.zip"
    if (-not (Test-Path $zipPath)) {
        Write-Host "  ✗ No existing package found: $zipPath" -ForegroundColor Red
        exit 1
    }
}

# Deploy to Azure
Write-Host "[5/6] Deploying to Azure Function App..." -ForegroundColor Yellow
Write-Host "  This may take 2-3 minutes..." -ForegroundColor Cyan

try {
    # Use az functionapp deployment source with zip deploy
    Write-Host "  Uploading package..." -ForegroundColor Cyan
    $deployResult = az functionapp deployment source config-zip `
        --resource-group $ResourceGroup `
        --name $FunctionAppName `
        --src $zipPath `
        --build-remote true `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Deployment successful!" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Deployment failed" -ForegroundColor Red
        Write-Host $deployResult -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ✗ Deployment error: $_" -ForegroundColor Red
    exit 1
}

# Verify deployment
Write-Host "[6/6] Verifying deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 10  # Wait for function to warm up

try {
    # Get function keys
    Write-Host "  Retrieving function URL..." -ForegroundColor Cyan
    $functionUrl = "https://$($functionApp.defaultHostName)"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Function App URL: $functionUrl" -ForegroundColor Cyan
    Write-Host "Function Endpoint: $functionUrl/api/refresh" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Test the function: Invoke-WebRequest -Uri '$functionUrl/api/refresh' -Method GET" -ForegroundColor White
    Write-Host "  2. Check logs: az functionapp log tail --name $FunctionAppName --resource-group $ResourceGroup" -ForegroundColor White
    Write-Host "  3. Monitor in Portal: https://portal.azure.com/#resource/subscriptions/$($account.id)/resourceGroups/$ResourceGroup/providers/Microsoft.Web/sites/$FunctionAppName" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "  ⚠ Could not retrieve function details" -ForegroundColor Yellow
    Write-Host "  Deployment completed but verification failed" -ForegroundColor Yellow
}

Write-Host "Deployment package saved: $zipPath" -ForegroundColor Cyan
Write-Host ""
