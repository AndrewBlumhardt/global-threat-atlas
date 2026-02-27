# Azure Static Web App API Functions

> **Current status:** Legacy/optional. The default deployment flow now uses the stand-alone Function App as the single backend API.

Backend API endpoints for the Static Web App, providing data proxy and configuration services.

## 📁 Directory Structure

```
web/api/
├── host.json           # Azure Functions runtime configuration
├── requirements.txt    # Python dependencies
├── config/            # Azure Maps configuration endpoint
├── data/              # Data proxy (GeoJSON/TSV from blob storage)
├── health/            # Health check endpoint
├── simple/            # Simple test endpoint
└── test/              # API test endpoint
```

## 🔧 Configuration Files

### `host.json`
Azure Functions runtime settings for Static Web Apps:
```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

### `requirements.txt`
Python dependencies:
- `azure-functions` - Azure Functions runtime
- `azure-storage-blob` - Blob storage SDK for data access

## 🌐 API Endpoints

### [`/api/config`](./config/README.md)
Returns Azure Maps configuration (subscription key, settings).

### [`/api/data/{filename}`](./data/README.md)
**Primary data endpoint** - Proxies GeoJSON and TSV files from blob storage.

### [`/api/health`](./health/README.md)
Simple health check endpoint.

### [`/api/simple`](./simple/README.md)
Basic test endpoint for debugging.

### [`/api/test`](./test/README.md)
API functionality test endpoint.

## 🔐 Required Configuration

Set these in Static Web App **Application Settings**:

- `STORAGE_ACCOUNT_URL` - Azure Storage blob URL
- `STORAGE_CONTAINER_DATASETS` - Container name (default: "datasets")
- `KEY_VAULT_NAME` - Azure Key Vault name (for secrets management)

**Note**: Azure Maps subscription key is stored in Key Vault as `AZURE-MAPS-SUBSCRIPTION-KEY` and accessed via Managed Identity.

## 🚀 Deployment

Deployed automatically via:
1. **GitHub Actions** - On push to main branch
2. **SWA CLI** - Manual deployment: `swa deploy . --api-location ./api`

## 📊 Data Flow

```
Frontend (browser)
    ↓ HTTP GET /api/data/threat-intel-indicators
Static Web App API Function
    ↓ Query blob storage
Azure Storage (datasets container)
    ↓ Return GeoJSON/TSV
API Function
    ↓ Add CORS headers
Frontend receives data
```

## 🎯 Purpose

These API functions are needed because:
- **CORS Support**: Blob storage doesn't support CORS for browser access
- **Authentication**: Uses Managed Identity instead of storage keys
- **Flexibility**: Can add data transformations, caching, or filtering
- **Demo Mode**: Supports `?demo=true` parameter to load demo data

## 🧪 Testing Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Start local server with Azure Functions Core Tools
func start

# Test endpoints
curl http://localhost:7071/api/health
curl http://localhost:7071/api/data/threat-intel-indicators
```

## 📝 Notes

- All endpoints use **anonymous authentication** (public access)
- CORS headers included for browser access from any origin
- Uses **Managed Identity** with Azure RBAC for secure blob storage access (no shared keys)
