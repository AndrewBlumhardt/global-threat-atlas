#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Retrieve and display indicator processing counts from Azure Function.
    
.DESCRIPTION
    Queries the Azure Function for the latest processing statistics and saves
    them to a variable or file for later use. Useful for monitoring and reporting.
    
.PARAMETER FunctionUrl
    URL of the Azure Function (default: func-sentinel-activity-maps)
    
.PARAMETER OutputFile
    Optional JSON file to save the counts
    
.PARAMETER ForceRefresh
    Force a new refresh before getting counts (may take several minutes)
    
.EXAMPLE
    .\get-indicator-counts.ps1
    
.EXAMPLE
    .\get-indicator-counts.ps1 -OutputFile "counts.json"
    
.EXAMPLE
    .\get-indicator-counts.ps1 -ForceRefresh
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$FunctionUrl = "https://func-sentinel-activity-maps.azurewebsites.net/api/refresh",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFile,
    
    [Parameter(Mandatory=$false)]
    [switch]$ForceRefresh
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Indicator Processing Statistics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Build URL
$url = $FunctionUrl
if ($ForceRefresh) {
    $url += "?force=true"
    Write-Host "⚠️  Force refresh requested - this may take 3-7 minutes..." -ForegroundColor Yellow
    Write-Host ""
}

# Query function
try {
    Write-Host "Querying function endpoint..." -ForegroundColor White
    $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 600
    $data = $response.Content | ConvertFrom-Json
    
    $result = $data.results[0]
    
    # Build counts object
    $counts = @{
        SourceId = $result.source_id
        Status = $result.status
        Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
    
    # Add detailed counts if available (refresh status)
    if ($result.status -eq "refresh" -or $result.status -eq "initial_load") {
        $counts.TotalRecords = $result.row_count
        $counts.GeoEnriched = $result.geo_enriched
        $counts.FullCoordinates = $result.geo_full
        $counts.CountryOnly = $result.geo_country_only
        $counts.FailedLookups = $result.geo_no_match
        $counts.GeoJSONFeatures = $result.geojson_features
        $counts.GeoJSONSkipped = $result.geojson_skipped
        $counts.SuccessRate = [math]::Round(($result.geo_enriched / $result.row_count) * 100, 2)
        $counts.TSVFile = $result.output_file
        $counts.GeoJSONFile = $result.geojson_file
        $counts.LastModified = $result.last_modified
    }
    elseif ($result.status -eq "cached") {
        $counts.Message = $result.message
        $counts.FileAgeHours = $result.file_age_hours
        $counts.RefreshThresholdHours = $result.refresh_threshold_hours
        $counts.LastModified = $result.last_modified
        $counts.FileSizeBytes = $result.file_size_bytes
        $counts.FileSizeMB = [math]::Round($result.file_size_bytes / 1MB, 2)
        
        Write-Host "ℹ️  Data is cached (age: $($counts.FileAgeHours) hours)" -ForegroundColor Yellow
        Write-Host "   Run with -ForceRefresh to get detailed processing counts" -ForegroundColor Yellow
        Write-Host ""
    }
    
    # Display results
    Write-Host "📊 Results:" -ForegroundColor Cyan
    Write-Host "────────────────────────────────────────" -ForegroundColor DarkGray
    
    if ($counts.ContainsKey("TotalRecords")) {
        Write-Host "  Total Records:          $($counts.TotalRecords)" -ForegroundColor White
        Write-Host "  Geo-Enriched:           $($counts.GeoEnriched)" -ForegroundColor White
        Write-Host "  Full GPS Coordinates:   $($counts.FullCoordinates)" -ForegroundColor White
        Write-Host "  Country-Only:           $($counts.CountryOnly)" -ForegroundColor White
        Write-Host "  Failed Lookups:         $($counts.FailedLookups)" -ForegroundColor White
        Write-Host "  GeoJSON Features:       $($counts.GeoJSONFeatures)" -ForegroundColor White
        Write-Host "  Success Rate:           $($counts.SuccessRate)%" -ForegroundColor Green
    }
    else {
        Write-Host "  File Age:               $($counts.FileAgeHours) hours" -ForegroundColor White
        Write-Host "  File Size:              $($counts.FileSizeMB) MB" -ForegroundColor White
        Write-Host "  Last Modified:          $($counts.LastModified)" -ForegroundColor White
    }
    
    Write-Host ""
    
    # Save to global variable
    $global:indicatorCounts = $counts
    Write-Host "✅ Counts saved to global variable: `$indicatorCounts" -ForegroundColor Green
    
    # Save to file if requested
    if ($OutputFile) {
        $counts | ConvertTo-Json -Depth 5 | Out-File $OutputFile -Encoding UTF8
        Write-Host "✅ Counts saved to: $OutputFile" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Access the counts in PowerShell:" -ForegroundColor Cyan
    Write-Host '  $indicatorCounts.TotalRecords' -ForegroundColor Gray
    Write-Host '  $indicatorCounts.SuccessRate' -ForegroundColor Gray
    Write-Host '  $indicatorCounts | Format-List' -ForegroundColor Gray
    Write-Host ""
    
    return $counts
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}
