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
- `KEY_VAULT_NAME` - Azure Key Vault name (for retrieving Azure Maps key)
- `STORAGE_ACCOUNT_URL` - Blob storage URL
- `STORAGE_CONTAINER_DATASETS` - Container name (default: "datasets")

**Key Vault Secrets** (accessed via Managed Identity):
- `AZURE-MAPS-SUBSCRIPTION-KEY` - Azure Maps subscription key

**Fallback** (if Key Vault unavailable):
- `AZURE_MAPS_SUBSCRIPTION_KEY` - Azure Maps subscription key from app settings

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

- Retrieves Azure Maps key from **Key Vault** using Managed Identity (preferred)
- Falls back to `AZURE_MAPS_SUBSCRIPTION_KEY` app setting if Key Vault unavailable
- Returns empty string if key not found in either location
- Used during application initialization only (not called repeatedly)
- **Security**: Key Vault stores secrets securely with RBAC access control
