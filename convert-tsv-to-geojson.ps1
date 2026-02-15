#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Convert TSV files to GeoJSON for manual data import and demos.
    
.DESCRIPTION
    This utility converts TSV files (exported or simulated data) to GeoJSON format
    for use with the Sentinel Activity Maps visualization. Useful for testing and
    demos when you don't have sufficient live data in Log Analytics.
    
    The script:
    - Reads TSV files with latitude/longitude columns
    - Creates GeoJSON features from records with valid coordinates
    - Can upload directly to Azure Blob Storage or save locally
    - Handles various column name formats (Latitude/latitude, Longitude/longitude, etc.)
    
.PARAMETER InputFile
    Path to the input TSV file (required)
    
.PARAMETER OutputFile
    Path for the output GeoJSON file (default: input filename with .geojson extension)
    
.PARAMETER UploadToBlob
    Upload the generated GeoJSON to Azure Blob Storage
    
.PARAMETER StorageAccount
    Azure Storage Account name (required if UploadToBlob)
    
.PARAMETER Container
    Container name in blob storage (default: datasets)
    
.PARAMETER BlobName
    Name for the blob in storage (default: output filename)
    
.EXAMPLE
    .\convert-tsv-to-geojson.ps1 -InputFile "simulated-signins.tsv"
    
.EXAMPLE
    .\convert-tsv-to-geojson.ps1 -InputFile "exported-data.tsv" -OutputFile "custom.geojson"
    
.EXAMPLE
    .\convert-tsv-to-geojson.ps1 -InputFile "demo-data.tsv" -UploadToBlob -StorageAccount "sentinelmapsstore"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$InputFile,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFile,
    
    [Parameter(Mandatory=$false)]
    [switch]$UploadToBlob,
    
    [Parameter(Mandatory=$false)]
    [string]$StorageAccount,
    
    [Parameter(Mandatory=$false)]
    [string]$Container = "datasets",
    
    [Parameter(Mandatory=$false)]
    [string]$BlobName
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TSV to GeoJSON Converter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Validate input file exists
if (-not (Test-Path $InputFile)) {
    Write-Host "❌ Error: Input file not found: $InputFile" -ForegroundColor Red
    exit 1
}

# Set default output file if not specified
if (-not $OutputFile) {
    $OutputFile = [System.IO.Path]::ChangeExtension($InputFile, ".geojson")
}

# Validate blob parameters
if ($UploadToBlob -and -not $StorageAccount) {
    Write-Host "❌ Error: -StorageAccount required when using -UploadToBlob" -ForegroundColor Red
    exit 1
}

if (-not $BlobName) {
    $BlobName = [System.IO.Path]::GetFileName($OutputFile)
}

Write-Host "📁 Input:  $InputFile" -ForegroundColor White
Write-Host "📁 Output: $OutputFile" -ForegroundColor White
Write-Host ""

# Read TSV file
Write-Host "[1/4] Reading TSV file..." -ForegroundColor Yellow
try {
    $tsvContent = Get-Content $InputFile -Raw
    $lines = $tsvContent -split "`n" | Where-Object { $_.Trim() -ne "" }
    
    if ($lines.Count -lt 2) {
        Write-Host "❌ Error: TSV file must have at least a header row and one data row" -ForegroundColor Red
        exit 1
    }
    
    # Parse header
    $headers = $lines[0] -split "`t"
    Write-Host "  ✓ Found $($lines.Count - 1) data rows" -ForegroundColor Green
    Write-Host "  ✓ Columns: $($headers.Count)" -ForegroundColor Green
    
    # Find latitude/longitude columns (case-insensitive)
    $latColumn = $headers | Where-Object { $_ -imatch "^latitude$|^lat$" } | Select-Object -First 1
    $lonColumn = $headers | Where-Object { $_ -imatch "^longitude$|^lon$|^long$" } | Select-Object -First 1
    
    if (-not $latColumn -or -not $lonColumn) {
        Write-Host "  ⚠️  Warning: Could not find Latitude/Longitude columns" -ForegroundColor Yellow
        Write-Host "     Available columns: $($headers -join ', ')" -ForegroundColor Gray
        Write-Host "     Trying common variations..." -ForegroundColor Yellow
        
        # Try common variations
        $latColumn = $headers | Where-Object { $_ -imatch "lat" } | Select-Object -First 1
        $lonColumn = $headers | Where-Object { $_ -imatch "lon|lng" } | Select-Object -First 1
        
        if (-not $latColumn -or -not $lonColumn) {
            Write-Host "  ❌ Error: Could not identify Latitude/Longitude columns" -ForegroundColor Red
            Write-Host "     Please ensure your TSV has columns named 'Latitude' and 'Longitude'" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "  ✓ Latitude column:  $latColumn" -ForegroundColor Green
    Write-Host "  ✓ Longitude column: $lonColumn" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error reading TSV: $_" -ForegroundColor Red
    exit 1
}

# Parse data rows
Write-Host ""
Write-Host "[2/4] Parsing data and creating GeoJSON features..." -ForegroundColor Yellow

$features = @()
$skipped = 0
$totalRows = $lines.Count - 1

$latIndex = [array]::IndexOf($headers, $latColumn)
$lonIndex = [array]::IndexOf($headers, $lonColumn)

for ($i = 1; $i -lt $lines.Count; $i++) {
    $values = $lines[$i] -split "`t"
    
    if ($values.Count -ne $headers.Count) {
        $skipped++
        continue
    }
    
    # Create row object
    $row = @{}
    for ($j = 0; $j -lt $headers.Count; $j++) {
        $row[$headers[$j]] = $values[$j]
    }
    
    # Get coordinates
    $lat = $row[$latColumn]
    $lon = $row[$lonColumn]
    
    # Validate coordinates
    try {
        $latFloat = [double]::Parse($lat)
        $lonFloat = [double]::Parse($lon)
        
        # Validate range
        if ($latFloat -lt -90 -or $latFloat -gt 90 -or $lonFloat -lt -180 -or $lonFloat -gt 180) {
            $skipped++
            continue
        }
        
        # Create properties (exclude lat/lon to avoid duplication)
        $properties = @{}
        foreach ($key in $row.Keys) {
            if ($key -ne $latColumn -and $key -ne $lonColumn) {
                $properties[$key] = $row[$key]
            }
        }
        
        # Create GeoJSON feature
        $feature = @{
            type = "Feature"
            geometry = @{
                type = "Point"
                coordinates = @($lonFloat, $latFloat)  # GeoJSON is [lon, lat]
            }
            properties = $properties
        }
        
        $features += $feature
        
        # Progress indicator
        if ($i % 1000 -eq 0) {
            $progress = [math]::Round(($i / $totalRows) * 100, 1)
            Write-Host "  Progress: $progress% ($i/$totalRows rows, $($features.Count) features)" -ForegroundColor Gray
        }
        
    } catch {
        $skipped++
    }
}

Write-Host "  ✓ Created $($features.Count) GeoJSON features" -ForegroundColor Green
Write-Host "  ✓ Skipped $skipped rows (invalid/missing coordinates)" -ForegroundColor Yellow

if ($features.Count -eq 0) {
    Write-Host "❌ Error: No valid features created. Check your data has valid latitude/longitude values." -ForegroundColor Red
    exit 1
}

# Create GeoJSON collection
Write-Host ""
Write-Host "[3/4] Building GeoJSON collection..." -ForegroundColor Yellow

$geojson = @{
    type = "FeatureCollection"
    metadata = @{
        generated = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        count = $features.Count
        source = "Manual TSV Import"
        inputFile = [System.IO.Path]::GetFileName($InputFile)
    }
    features = $features
}

$geojsonJson = $geojson | ConvertTo-Json -Depth 10 -Compress:$false

Write-Host "  ✓ GeoJSON collection created" -ForegroundColor Green
Write-Host "  ✓ Total features: $($features.Count)" -ForegroundColor Green
Write-Host "  ✓ File size: $([math]::Round($geojsonJson.Length / 1KB, 2)) KB" -ForegroundColor Green

# Save to file
Write-Host ""
Write-Host "[4/4] Saving output..." -ForegroundColor Yellow

try {
    $geojsonJson | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "  ✓ Saved to: $OutputFile" -ForegroundColor Green
    
    $fileInfo = Get-Item $OutputFile
    Write-Host "  ✓ File size: $([math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error saving file: $_" -ForegroundColor Red
    exit 1
}

# Upload to blob storage if requested
if ($UploadToBlob) {
    Write-Host ""
    Write-Host "[5/5] Uploading to Azure Blob Storage..." -ForegroundColor Yellow
    
    try {
        # Check Azure CLI
        $azVersion = az version 2>$null
        if (-not $azVersion) {
            Write-Host "❌ Azure CLI not found. Install from: https://aka.ms/InstallAzureCliWindows" -ForegroundColor Red
            exit 1
        }
        
        # Upload blob
        Write-Host "  Uploading to: $StorageAccount/$Container/$BlobName" -ForegroundColor Cyan
        
        az storage blob upload `
            --account-name $StorageAccount `
            --container-name $Container `
            --name $BlobName `
            --file $OutputFile `
            --content-type "application/geo+json" `
            --overwrite `
            --auth-mode key `
            --output none 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Upload successful!" -ForegroundColor Green
            Write-Host "  ✓ Blob: $BlobName" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Upload failed. Try adding --auth-mode key or check permissions" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Error uploading to blob storage: $_" -ForegroundColor Red
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Conversion Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  Input rows:      $totalRows" -ForegroundColor White
Write-Host "  Features created: $($features.Count)" -ForegroundColor White
Write-Host "  Skipped:         $skipped" -ForegroundColor White
Write-Host "  Success rate:    $([math]::Round(($features.Count / $totalRows) * 100, 2))%" -ForegroundColor White
Write-Host ""
Write-Host "📁 Output: $OutputFile" -ForegroundColor Cyan
if ($UploadToBlob) {
    Write-Host "☁️  Blob:   $StorageAccount/$Container/$BlobName" -ForegroundColor Cyan
}
Write-Host ""
