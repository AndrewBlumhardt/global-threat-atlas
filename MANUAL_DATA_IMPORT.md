# Manual Data Import for Demos and Testing

When you don't have live Sentinel data or want to demo functionality before connecting to Log Analytics, you can use manual data import methods.

## Demo Mode

**The easiest way to test** - Enable the **Demo** toggle in the layer control to see sanitized sample data:

- **Sign-In Activity**: 500 generated sign-in records with realistic patterns
- **Device Locations**: 500 device location records with type-specific icons
- **Threat Intel Maps**: Publicly available threat actor datasets
- **Threat IP Indicators**: Publicly available threat intelligence feeds

Demo mode lets you verify functionality and showcase features without connecting to Sentinel.

---

## Quick Data Import Options

### 1. Drag and Drop (Temporary)

**Fastest method** - Drag any `.geojson` file onto the map for instant visualization.

- ✅ No upload needed - instant display
- ❌ Lost on page refresh
- 💡 Perfect for testing or one-time visualization

Based on [Azure Maps drag-and-drop sample](https://samples.azuremaps.com/geospatial-files/drag-and-drop-geojson-file-onto-map).

### 2. Custom Layer (Permanent)

Upload GeoJSON to blob storage for persistent display via the Custom Source layer.

```powershell
# Upload to blob storage
az storage blob upload \
  --account-name sentinelmapsstore \
  --container-name datasets \
  --name custom/office-locations.geojson \
  --file office-locations.geojson
```

See [Custom Source Documentation](docs/CUSTOM_SOURCE.md) for full details.

---

## Where to Get GeoJSON Data

**Create your own:**
- [geojson.io](https://geojson.io/) - Draw points/polygons for office locations, service areas, etc.

**Download public datasets:**
- [Data.gov](https://data.gov/) - US government geographic data
- [Mapping L.A. Boundaries](http://boundaries.latimes.com/sets/) - Regional boundaries
- GitHub - Search "geojson" + your topic (cities, facilities, etc.)

**Office locations example:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [-122.3321, 47.6062]},
      "properties": {"name": "Seattle Office", "employees": 250}
    }
  ]
}
```

Save as `offices.geojson` and drag onto map or upload to blob storage.

---

## Converting TSV/CSV to GeoJSON

If you have data in TSV or CSV format with Latitude/Longitude columns:

### 1. Prepare Your TSV File

```tsv
IPAddress	City	Country	Latitude	Longitude
203.0.113.45	San Francisco	USA	37.7749	-122.4194
198.51.100.78	London	UK	51.5074	-0.1278
```

### 2. Convert to GeoJSON

```powershell
.\convert-tsv-to-geojson.ps1 -InputFile "my-data.tsv"
```

### 3. Upload to Blob (Optional)

```powershell
.\convert-tsv-to-geojson.ps1 `
    -InputFile "my-data.tsv" `
    -UploadToBlob `
    -StorageAccount "sentinelmapsstore"
```

---

## Exporting from Log Analytics

Export real data for testing:

```kql
SigninLogs
| where TimeGenerated > ago(7d)
| extend Latitude = parse_json(tostring(LocationDetails.geoCoordinates)).latitude
| extend Longitude = parse_json(tostring(LocationDetails.geoCoordinates)).longitude
| project TimeGenerated, UserPrincipalName, IPAddress, 
          City = LocationDetails.city, 
          Country = LocationDetails.countryOrRegion, 
          Latitude, Longitude
| take 1000
```

1. Export results as CSV
2. Convert to TSV if needed: `(Get-Content "file.csv") -replace ',', "`t" | Set-Content "file.tsv"`
3. Run conversion script

---

## Testing Your GeoJSON

1. **Drag onto map** - Instant visual validation
2. **[geojsonlint.com](https://geojsonlint.com/)** - Validate syntax
3. **[geojson.io](https://geojson.io/)** - Visualize and edit

---

## Summary

| Method | Use Case | Persists? | Setup |
|--------|----------|-----------|-------|
| **Demo Mode** | Testing/demos without Sentinel | Yes | Toggle in UI |
| **Drag & Drop** | Quick one-time visualization | No | Drag .geojson file |
| **Custom Layer** | Permanent custom data | Yes | Upload to blob |
| **TSV Conversion** | Convert existing data | After upload | Run script |

**Start with Demo Mode** to verify functionality, then connect to Sentinel for live data or use custom imports for additional context.
