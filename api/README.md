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

### `test_local.py`
**Local development testing script** - validates components without Azure resources:
- Tests configuration loading from `sources.yaml`
- Validates TSV writer/parser functionality
- Tests refresh policy logic
- Checks file age checker module
- Tests KQL query generation

Run locally: `python test_local.py`

### `test_large_dataset.py`
**Performance testing script** for large datasets (50K+ records):
- **Test 1:** Log Analytics query execution and performance
- **Test 2:** Geo-enrichment batching with MaxMind (tests concurrent lookups)
- **Test 3:** GeoJSON generation and file output

Validates the system can handle production-scale threat intelligence datasets with efficient batch processing and proper error handling.

Run locally: `python test_large_dataset.py`

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

## 🌍 Geo-Enrichment

IP address geolocation is provided by **MaxMind GeoLite2** database.

### MaxMind GeoLite2

**This product includes GeoLite2 data created by MaxMind, available from [https://www.maxmind.com](https://www.maxmind.com)**

The function uses the MaxMind GeoLite2 City database to enrich IP addresses with:
- **Latitude/Longitude** - Precise geographic coordinates
- **Country** - ISO country code and name
- **City** - City name (when available)
- **Accuracy Radius** - Geolocation accuracy estimate

### Configuration

To use MaxMind geo-enrichment:

1. **Sign up** for a free MaxMind account: [https://www.maxmind.com/en/geolite2/signup](https://www.maxmind.com/en/geolite2/signup)
2. **Generate a license key** in your MaxMind account
3. **Set environment variable**:
   ```bash
   MAXMIND_LICENSE_KEY="your-license-key-here"
   ```
4. The function will automatically download and cache the GeoLite2-City database

### Batch Processing

For large datasets (50K+ IPs), the geo-enrichment module uses:
- **Concurrent lookups** with ThreadPoolExecutor (20 workers by default)
- **Chunked processing** for datasets > 10K IPs (5000 IPs per chunk)
- **Caching** to avoid duplicate lookups
- **Fallback to Azure Maps** if MaxMind is unavailable

Average performance: **~1000 IPs/second** on typical Azure Function hardware.

### Alternative: Azure Maps

The function also supports Azure Maps IP Geolocation API (country-only):
- Set `geo_provider: "azure_maps"` in `sources.yaml`
- Requires `AZURE_MAPS_SUBSCRIPTION_KEY` environment variable
- Returns country-level data (no city/coordinates)
