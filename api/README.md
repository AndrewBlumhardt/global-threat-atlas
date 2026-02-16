# Azure Function App - Sentinel Activity Maps API

Backend Azure Function App that queries Microsoft Sentinel Log Analytics, enriches data with geolocation, and stores results in Azure Blob Storage.

## 📁 Directory Structure

```
api/
├── function_app.py          # Main Azure Functions app with HTTP endpoints
├── host.json                # Function runtime configuration
├── requirements.txt         # Python dependencies
├── sources.yaml             # Data source configurations (KQL queries)
├── local.settings.json      # Local development settings (not in git)
├── test_local.py           # Local testing script
├── test_large_dataset.py   # Performance testing with large datasets
└── shared/                 # Shared utility modules
```

## 🔧 Core Files

### `function_app.py`
Main application with HTTP-triggered functions:
- `/api/refresh` - Refresh data sources from Sentinel (query, enrich, store)
- `/api/enrich-geo` - Manual geo enrichment for existing TSV files
- `/api/generate-geojson` - Convert TSV to GeoJSON for map visualization
- `/api/test-geo-lookup` - Test geolocation provider (MaxMind/Azure Maps)
- `/api/health` - Health check endpoint

### `sources.yaml`
Configuration file defining data sources:
- **signin_activity** - Azure AD sign-in events
- **mde_devices** - Microsoft Defender for Endpoint device inventory
- **threat_intel_indicators** - Threat intelligence indicators

Each source specifies:
- KQL query template
- Refresh policy (threshold hours, time windows)
- Auto geo-enrichment settings
- Output filenames

### `requirements.txt`
Python dependencies:
- `azure-functions` - Azure Functions runtime
- `azure-identity` - Managed identity authentication
- `azure-storage-blob` - Blob storage operations
- `geoip2` - MaxMind GeoLite2 database reader
- `pyyaml` - YAML configuration parsing

### `host.json`
Azure Functions runtime settings:
- Extension bundle version
- Logging levels
- HTTP routing configuration

## 🗂️ Subdirectories

### [`shared/`](./shared/README.md)
Reusable utility modules for Azure services, data processing, and geolocation.

## 🚀 Deployment

Deploy using:
```bash
# Azure CLI
az functionapp deployment source config-zip \
  --resource-group <rg-name> \
  --name <function-app-name> \
  --src function-deployment.zip

# Or via deployment script
cd api
zip -r ../function-deployment.zip .
```

## 🔐 Required Configuration

Environment variables (set in Azure Function App Settings):
- `LOG_ANALYTICS_WORKSPACE_ID` - Sentinel workspace ID
- `AZURE_SUBSCRIPTION_ID` - Azure subscription ID  
- `STORAGE_ACCOUNT_NAME` - Blob storage account name
- `MAXMIND_LICENSE_KEY` - MaxMind GeoLite2 license key (for geo enrichment)
- `KEY_VAULT_NAME` - (Optional) Azure Key Vault for secrets

Managed Identity requires:
- **Log Analytics Reader** role on Sentinel workspace
- **Storage Blob Data Contributor** role on storage account

## 🧪 Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Run local test
python test_local.py

# Test with Azure Functions Core Tools
func start
```

## 📊 Data Flow

1. **Query**: Execute KQL query against Log Analytics
2. **Enrich**: Add geolocation data (latitude/longitude) for IP addresses
3. **Store**: Write TSV results to blob storage
4. **Transform**: Generate GeoJSON for map visualization
5. **Cache**: Track file age and refresh only when needed
