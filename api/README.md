# Azure Function App - Global Threat Intelligence Atlas API

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


## 🔐 Required Environment Variables

Set these in your Azure Function App Settings:

| Variable                              | Description |
|----------------------------------------|-------------|
| LOG_ANALYTICS_WORKSPACE_ID             | Sentinel Log Analytics workspace ID (for KQL queries) |
| AZURE_MAPS_SUBSCRIPTION_KEY            | Azure Maps API key (for geolocation enrichment) |
| STORAGE_ACCOUNT_URL                    | Blob Storage account URL (for reading/writing datasets) |
| STORAGE_CONTAINER_DATASETS             | Blob container for main datasets |
| STORAGE_CONTAINER_LOCKS                | Blob container for lock files and metadata (used for concurrency control) |
| MAXMIND_LICENSE_KEY                    | MaxMind GeoLite2 license key (for IP geolocation enrichment) |
| DEFAULT_REFRESH_INTERVAL_SECONDS        | Default interval (seconds) for refreshing datasets |
| APPLICATIONINSIGHTS_CONNECTION_STRING  | Application Insights connection string (for telemetry/monitoring) |

### Azure Functions Runtime Variables (required by platform)

| Variable                              | Description |
|----------------------------------------|-------------|
| AzureWebJobsStorage                    | Required for Azure Functions runtime (triggers, logs, etc.) |
| FUNCTIONS_EXTENSION_VERSION            | Azure Functions runtime version |
| FUNCTIONS_WORKER_RUNTIME               | Language worker (e.g., python) |
| WEBSITE_CONTENTAZUREFILECONNECTIONSTRING| Deployment/content storage |
| WEBSITE_CONTENTSHARE                   | Deployment/content storage |
| WEBSITE_RUN_FROM_PACKAGE               | Deployment mode |
| SCM_DO_BUILD_DURING_DEPLOYMENT         | Build behavior during deployment |
| WEBSITE_HTTPLOGGING_RETENTION_DAYS     | HTTP log retention (optional) |

**Note:**
- All secrets are managed via environment variables and managed identity. Key Vault is no longer used.
- Storage locks are still used for concurrency and metadata integrity.
- Application Insights is recommended for monitoring and diagnostics.

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

## Azure Function Endpoints

The following HTTP-triggered functions are defined in `api/function_app.py`:

| Function Name      | Route/Endpoint         | Purpose                                      | Main File(s)         |
|--------------------|-----------------------|----------------------------------------------|----------------------|
| get_config         | /api/config           | Returns frontend config for web app          | function_app.py      |
| refresh           | /api/refresh          | Refreshes data from Sentinel                 | function_app.py      |
| health            | /api/health           | Health check endpoint                        | function_app.py      |
| enrich_geo        | /api/enrich-geo       | Enriches TSV data with geolocation           | function_app.py      |
| generate_geojson  | /api/generate-geojson | Converts TSV to GeoJSON for map overlays      | function_app.py      |
| get_data          | /api/data/{filename}  | Serves blob data via proxy                   | function_app.py      |
| test_geo_lookup   | /api/test-geo-lookup  | Test endpoint for geo provider (dev/test)    | function_app.py, tests/test_local.py |

- All shared utility modules are in `api/shared/` and are required for production endpoints.
- Test/dev scripts are now in `tests/`.
- `test_geo_lookup` is for development/testing and not required in production deployments.
