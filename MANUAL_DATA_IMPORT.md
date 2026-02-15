# Manual Data Import for Demos and Testing

When you don't have sufficient live data in Log Analytics for demos or testing, you can manually create or export TSV files and convert them to GeoJSON.

## Quick Start

### 1. Prepare Your TSV File

Your TSV file must include:
- **Required columns**: `Latitude`, `Longitude` (case-insensitive)
- **Other columns**: Any additional fields (will be included in GeoJSON properties)

Example minimal format:
```tsv
IPAddress	City	Country	Latitude	Longitude
203.0.113.45	San Francisco	USA	37.7749	-122.4194
198.51.100.78	London	UK	51.5074	-0.1278
```

### 2. Convert TSV to GeoJSON

```powershell
# Convert and save locally
.\convert-tsv-to-geojson.ps1 -InputFile "my-data.tsv"

# Convert and upload to blob storage
.\convert-tsv-to-geojson.ps1 `
    -InputFile "my-data.tsv" `
    -UploadToBlob `
    -StorageAccount "sentinelmapsstore"
```

## Sample Data Template

A sample template is provided: [`sample-data-template.tsv`](sample-data-template.tsv)

This template matches the SigninLogs schema with sample records you can modify.

## Creating Large Simulation Datasets

### Option 1: Excel/CSV Export

1. Create data in Excel with Latitude/Longitude columns
2. Export as Tab-delimited (.txt) or save as CSV
3. If CSV, convert to TSV: `(Get-Content "file.csv") -replace ',', "`t" | Set-Content "file.tsv"`
4. Run conversion script

### Option 2: PowerShell Generation

```powershell
# Generate simulated signin data
$cities = @(
    @{City="New York"; Lat=40.7128; Lon=-74.0060; Country="USA"},
    @{City="London"; Lat=51.5074; Lon=-0.1278; Country="UK"},
    @{City="Tokyo"; Lat=35.6762; Lon=139.6503; Country="Japan"},
    @{City="Sydney"; Lat=-33.8688; Lon=151.2093; Country="Australia"}
)

$data = @()
$data += "IPAddress`tUser`tCity`tCountry`tLatitude`tLongitude"

for ($i = 0; $i -lt 1000; $i++) {
    $city = $cities | Get-Random
    $ip = "203.0.113.$($i % 255)"
    $user = "user$i@contoso.com"
    
    $data += "$ip`t$user`t$($city.City)`t$($city.Country)`t$($city.Lat)`t$($city.Lon)"
}

$data | Out-File "simulated-signins.tsv" -Encoding UTF8

# Convert to GeoJSON
.\convert-tsv-to-geojson.ps1 -InputFile "simulated-signins.tsv" -UploadToBlob -StorageAccount "sentinelmapsstore"
```

## Exporting Real Data for Testing

### Export from Log Analytics

```kql
// Export SigninLogs with geo data
SigninLogs
| where TimeGenerated > ago(7d)
| summarize arg_max(TimeGenerated, *) by IPAddress
| extend Latitude = parse_json(tostring(LocationDetails.geoCoordinates)).latitude
| extend Longitude = parse_json(tostring(LocationDetails.geoCoordinates)).longitude
| extend City = LocationDetails.city
| extend Country = LocationDetails.countryOrRegion
| project TimeGenerated, UserPrincipalName, IPAddress, City, Country, Latitude, Longitude
| take 5000
```

1. Run query in Log Analytics
2. Export results as CSV
3. Convert CSV to TSV (if needed)
4. Run conversion script

### Export from Sentinel

```kql
// Export ThreatIntelIndicators (already enriched)
ThreatIntelIndicators
| where TimeGenerated > ago(30d)
| where isnotempty(Latitude) and isnotempty(Longitude)
| project TimeGenerated, ObservableValue, ThreatType, Confidence, City, Country, Latitude, Longitude
| take 1000
```

## Script Options

### Basic Conversion
```powershell
.\convert-tsv-to-geojson.ps1 -InputFile "data.tsv"
```
- Reads `data.tsv`
- Creates `data.geojson` in same directory

### Custom Output Path
```powershell
.\convert-tsv-to-geojson.ps1 `
    -InputFile "exports\data.tsv" `
    -OutputFile "maps\custom-name.geojson"
```

### Upload to Blob Storage
```powershell
.\convert-tsv-to-geojson.ps1 `
    -InputFile "data.tsv" `
    -UploadToBlob `
    -StorageAccount "sentinelmapsstore" `
    -Container "datasets" `
    -BlobName "manual-signins.geojson"
```

## Coordinate Format

The script accepts coordinates in decimal degrees:
- **Latitude**: -90 to 90 (negative = South, positive = North)
- **Longitude**: -180 to 180 (negative = West, positive = East)

Examples:
- New York: `40.7128, -74.0060`
- London: `51.5074, -0.1278`
- Sydney: `-33.8688, 151.2093`
- Tokyo: `35.6762, 139.6503`

## Column Name Flexibility

The script automatically detects these column name variations:
- Latitude: `Latitude`, `latitude`, `Lat`, `lat`
- Longitude: `Longitude`, `longitude`, `Long`, `long`, `Lon`, `lon`, `Lng`, `lng`

## Common Issues

### Empty or Missing Coordinates

**Problem**: Rows with empty lat/lon are skipped

**Solution**: Filter your source data or use placeholder coordinates
```powershell
# Filter rows with coordinates in export query
| where isnotempty(Latitude) and isnotempty(Longitude)
```

### Wrong Column Names

**Problem**: "Could not identify Latitude/Longitude columns"

**Solution**: Rename columns in your TSV file or add calculated columns
```kql
// In KQL export
| extend Latitude = YourLatField
| extend Longitude = YourLonField
```

### TSV vs CSV Format

**Problem**: CSV file instead of TSV

**Solution**: Convert delimiter
```powershell
# Convert CSV to TSV
$csv = Import-Csv "file.csv"
$csv | Export-Csv "file.tsv" -Delimiter "`t" -NoTypeInformation
```

Or use the built-in replace method:
```powershell
(Get-Content "file.csv") -replace ',', "`t" | Set-Content "file.tsv"
```

## Testing Your GeoJSON

After conversion, test your GeoJSON file:

### Online Validators
- http://geojson.io - Visualize and validate
- https://geojsonlint.com - Validate syntax

### Local Test
```powershell
# Check file size and feature count
$geojson = Get-Content "output.geojson" | ConvertFrom-Json
Write-Host "Features: $($geojson.features.Count)"
Write-Host "File size: $((Get-Item "output.geojson").Length / 1KB) KB"

# Preview first feature
$geojson.features[0] | ConvertTo-Json
```

## Best Practices

1. **Start Small**: Test with 10-100 records before processing thousands
2. **Validate Coordinates**: Ensure lat/lon are in correct decimal degree format
3. **Keep Source Files**: Always keep original TSV for re-processing
4. **Consistent Schema**: Use same column names across datasets for easier management
5. **Version Control**: Name files with dates: `signins-2026-02-14.tsv`

## Integration with Static Web App

Once your GeoJSON is in blob storage, update your SWA to point to it:

```javascript
// In your SWA config
const manualDataUrl = "https://sentinelmapsstore.blob.core.windows.net/datasets/manual-signins.geojson";
```

The SWA will load and display the manual data just like automated function output.

## Automation Example

Create a workflow for regular demo data updates:

```powershell
# demo-refresh.ps1
$timestamp = Get-Date -Format "yyyy-MM-dd"

# Generate demo data
.\generate-demo-data.ps1 -OutputFile "demo-$timestamp.tsv"

# Convert to GeoJSON
.\convert-tsv-to-geojson.ps1 `
    -InputFile "demo-$timestamp.tsv" `
    -UploadToBlob `
    -StorageAccount "sentinelmapsstore" `
    -BlobName "demo-signins.geojson"

Write-Host "Demo data updated: demo-signins.geojson"
```

## Getting More Sample Data

### Public Datasets with Geo Coordinates
- [IP Geolocation APIs](https://ipgeolocation.io/) - Free tier for testing
- [GeoNames](https://www.geonames.org/) - City coordinates
- [Natural Earth Data](https://www.naturalearthdata.com/) - Geographic data

### Generate Random Coordinates
```powershell
# Random US coordinates
$lat = Get-Random -Minimum 25 -Maximum 49 -Count 1
$lon = Get-Random -Minimum -125 -Maximum -65 -Count 1
```

## Support

For issues with the conversion script:
1. Check TSV file has tab delimiters (not spaces or commas)
2. Verify Latitude/Longitude columns exist and have numeric values
3. Ensure coordinates are in decimal degrees (-90 to 90, -180 to 180)
4. Check Azure CLI is installed and logged in (for blob upload)
