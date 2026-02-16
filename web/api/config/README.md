# Config API Endpoint

**Route**: `/api/config`  
**Methods**: GET  
**Authentication**: Anonymous (public)

## 📋 Purpose

Returns Azure Maps configuration for the frontend application, including subscription key and default settings.

## 📄 Files

- `__init__.py` - Function implementation
- `function.json` - Function binding configuration

## 🔧 Function Details

### Request
```http
GET /api/config HTTP/1.1
Host: your-site.azurestaticapps.net
```

### Response
```json
{
  "azureMapsKey": "your-subscription-key",
  "storageAccountUrl": "https://sentinelmapsstore.blob.core.windows.net",
  "datasetsContainer": "datasets",
  "threatIntelGeoJsonUrl": "https://sentinelmapsstore.blob.core.windows.net/datasets/threat-intel-indicators.geojson"
}
```

### Response Headers
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (CORS enabled)

## 🔑 Environment Variables

Required in Static Web App settings:
- `AZURE_MAPS_SUBSCRIPTION_KEY` - Azure Maps subscription key (optional, can be empty)
- `STORAGE_ACCOUNT_URL` - Blob storage URL (default: from STORAGE_CONNECTION_STRING)
- `STORAGE_CONTAINER_DATASETS` - Container name (default: "datasets")

## 🎨 Frontend Usage

```javascript
// Fetch configuration
const configResponse = await fetch('/api/config');
const config = await configResponse.json();

// Use Azure Maps key
const map = new atlas.Map('map-container', {
  authOptions: {
    authType: 'subscriptionKey',
    subscriptionKey: config.azureMapsKey
  }
});
```

## 📝 Notes

- Returns empty string for missing `AZURE_MAPS_SUBSCRIPTION_KEY`
- Frontend should fallback to environment variables if key is empty
- Used during application initialization only (not called repeatedly)
