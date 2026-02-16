# Data API Endpoint

**Route**: `/api/data/{filename}`  
**Methods**: GET, HEAD, OPTIONS  
**Authentication**: Anonymous (public)

## 📋 Purpose

Proxies GeoJSON and TSV data files from Azure Blob Storage to the frontend, with CORS support and demo mode capability.

## 📄 Files

- `__init__.py` - Main function implementation
- `function.json` - Route binding configuration with `{filename}` parameter

## 🔧 Function Details

### Request Formats

```http
# Standard data request
GET /api/data/threat-intel-indicators HTTP/1.1

# With explicit file extension
GET /api/data/device-locations.geojson HTTP/1.1

# Demo mode (uses demo_data/ folder)
GET /api/data/signin-activity?demo=true HTTP/1.1

# Head request (check file existence)
HEAD /api/data/mde-devices HTTP/1.1
```

### Supported Filenames

The function accepts various formats:
- **Without extension**: Auto-adds `.geojson` (e.g., `threat-intel-indicators` → `threat-intel-indicators.geojson`)
- **With .geojson**: Returns as GeoJSON (`application/json`)
- **With .tsv**: Returns as TSV (`text/tab-separated-values`)

### Demo Mode

When `?demo=true` query parameter is present:
- Prepends `demo_data/` to blob path
- Loads pre-generated sample data instead of live Sentinel data
- Example: `device-locations.geojson` → `demo_data/device-locations.geojson`

### Response Types

#### Success (200 OK)
```json
{
  "type": "FeatureCollection",
  "features": [...]
}
```

#### File Not Found (404)
```json
{
  "error": "Blob not found",
  "blob_name": "threat-intel-indicators.geojson",
  "container": "datasets"
}
```

#### Configuration Error (500)
```json
{
  "error": "Storage not configured - STORAGE_CONNECTION_STRING missing"
}
```

### Response Headers
- `Content-Type`: `application/json` or `text/tab-separated-values`
- `Access-Control-Allow-Origin: *` (CORS)
- `Cache-Control: max-age=300` (5 minute cache)

## 🔑 Environment Variables

Required in Static Web App settings:
- `STORAGE_CONNECTION_STRING` - Azure Storage connection string
- `STORAGE_CONTAINER_DATASETS` - Container name (default: "datasets")

## 📊 Data Flow

```
Frontend Request
    ↓ GET /api/data/threat-intel-indicators?demo=true
API Function (__init__.py)
    ↓ Parse filename and demo flag
    ↓ Determine blob name: demo_data/threat-intel-indicators.geojson
    ↓ Connect to blob storage via connection string
    ↓ Download blob content
    ↓ Add CORS headers
    ↓ Return content
Frontend receives GeoJSON
```

## 🎯 Usage Examples

### Frontend JavaScript

```javascript
// Standard data request
const response = await fetch('/api/data/device-locations');
const geojson = await response.json();

// Demo mode
const demoResponse = await fetch('/api/data/signin-activity?demo=true');
const demoData = await demoResponse.json();

// Check if file exists
const headResponse = await fetch('/api/data/custom-source', { method: 'HEAD' });
const exists = headResponse.ok;

// TSV file
const tsvResponse = await fetch('/api/data/threat-actors.tsv');
const tsvText = await tsvResponse.text();
```

## 🛡️ Security

- Uses **connection string** (not managed identity) for Python SDK compatibility
- Connection string stored in SWA application settings (not exposed to frontend)
- Anonymous access allowed (data is non-sensitive geolocation info)
- CORS enabled for browser access

## 📝 Logging

Function logs:
- Request method and filename
- Demo mode status
- Blob name being accessed
- Blob existence check results
- Error details for troubleshooting

## ⚠️ Error Handling

The function handles:
- Missing `STORAGE_CONNECTION_STRING` → 500 error with clear message
- Blob not found → 404 error with blob details
- Invalid blob names → 400 error
- Storage connection failures → 500 error with exception details

## 🧪 Testing

```bash
# Local testing with Azure Functions Core Tools
func start

# Test standard request
curl http://localhost:7071/api/data/threat-intel-indicators

# Test demo mode
curl "http://localhost:7071/api/data/device-locations?demo=true"

# Test HEAD request
curl -I http://localhost:7071/api/data/signin-activity

# Test TSV file
curl http://localhost:7071/api/data/threat-actors.tsv
```
