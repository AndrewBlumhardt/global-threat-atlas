# Custom Source Layer

## Overview

The **Custom Source** layer allows you to display custom GeoJSON data on the map. This is useful for:
- Demo scenarios with synthetic data
- Displaying custom threat intelligence
- Visualizing any geographic data in GeoJSON format

## File Naming Convention

Custom GeoJSON files must be uploaded to blob storage with the following naming format:

```
custom-source.geojson
```

**Location**: `datasets` container in the configured storage account

## Supported Geometry Types

The custom source layer supports all standard GeoJSON geometry types:

- **Point / MultiPoint**: Displayed as purple bubbles with hover popups
- **LineString / MultiLineString**: Displayed as purple lines
- **Polygon / MultiPolygon**: Displayed as filled purple polygons

## GeoJSON Format

Your custom GeoJSON file should follow the standard GeoJSON specification:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]
      },
      "properties": {
        "name": "San Francisco Office",
        "type": "Office Location",
        "status": "Active"
      }
    }
  ]
}
```

## Properties Display

All properties in each feature will be displayed in hover popups. Property names are shown in bold, followed by their values.

**Example popup display**:
```
Custom Source
name: San Francisco Office
type: Office Location
status: Active
```

## Upload Methods

### Method 1: Azure Portal

1. Navigate to your storage account in the Azure Portal
2. Go to **Containers** → **datasets**
3. Click **Upload**
4. Select your GeoJSON file
5. Rename it to `custom-source.geojson` before uploading

### Method 2: Azure CLI

```powershell
# Set your storage account name
$STORAGE_ACCOUNT = "sentinelmapsstore"

# Upload the file
az storage blob upload `
  --account-name $STORAGE_ACCOUNT `
  --container-name datasets `
  --name custom-source.geojson `
  --file ./my-custom-data.geojson `
  --auth-mode login
```

### Method 3: PowerShell with SAS Token

If you have a SAS token for the storage account:

```powershell
$storageAccount = "sentinelmapsstore"
$containerName = "datasets"
$sasToken = "?sv=2022-11-02&ss=..."  # Your SAS token
$localFile = ".\my-custom-data.geojson"
$blobName = "custom-source.geojson"

$uri = "https://$storageAccount.blob.core.windows.net/$containerName/$blobName$sasToken"

# Upload using Invoke-WebRequest
$headers = @{
    "x-ms-blob-type" = "BlockBlob"
    "Content-Type" = "application/json"
}

Invoke-WebRequest -Uri $uri -Method PUT -InFile $localFile -Headers $headers
```

## Using the Layer

1. Upload your GeoJSON file as `custom-source.geojson` to blob storage
2. Open the Sentinel Activity Maps application
3. Click the **Layers** button (top left)
4. Check the **Custom Source** checkbox

**Note**: If the file is not present in blob storage, you'll see an error message prompting you to upload the file.

## Layer Styling

The custom source layer uses the following default styling:

- **Points**: Purple bubbles (6px radius, 70% opacity)
- **Lines**: Purple strokes (2px width, 80% opacity)
- **Polygons**: Purple fill (30% opacity) with lighter purple border

## Tips and Best Practices

1. **File Size**: Keep GeoJSON files under 10MB for optimal performance
2. **Feature Count**: Limit features to a few thousand for best rendering performance
3. **Properties**: Only include relevant properties; all will be shown in popups
4. **Coordinates**: Ensure coordinates are in [longitude, latitude] format (GeoJSON standard)
5. **Testing**: Validate your GeoJSON using https://geojson.io before uploading

## Troubleshooting

**Layer not appearing**:
- Verify the file is named exactly `custom-source.geojson`
- Check that it's in the `datasets` container
- Ensure the GeoJSON is valid (use geojson.io to validate)

**Error message on toggle**:
- File may not exist in blob storage
- Check storage account connectivity
- Verify SAS token hasn't expired (if using)

**Features not rendering**:
- Check browser console for errors
- Verify geometry types are supported
- Ensure coordinates are valid (within -180 to 180 for longitude, -90 to 90 for latitude)

## Related Documentation

- [Manual Data Import Guide](./MANUAL_DATA_IMPORT.md) - For importing TSV data
- [Local Development Guide](./LOCAL_DEVELOPMENT.md) - For local testing
- [Deployment Guide](./DEPLOYMENT.md) - For deploying changes
