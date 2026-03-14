<!-- Minor update: README.md revision test - 2026-02-27 -->

# Global Threat Intelligence Atlas

<img src="screenshot-global-threat-map.png" alt="Global Threat Activity Map" width="600"/>
[Live Demo](https://jolly-cliff-0f92c201e.2.azurestaticapps.net/)

## Overview
Global Threat Intelligence Atlas is an Azure-hosted interactive map for SOC and threat intelligence teams. Designed for wall displays and analyst dashboards.

**Capabilities:**
- Visualizes real-time and historical threat activity
- Displays device locations and sign-in events
- Overlays static threat actor maps and custom GeoJSON
- Weather overlays and screen capture
- Secure Azure Static Web App + Function App backend
- Managed Identity for secrets (Key Vault removed)
- Custom domain and public/private access options
- YAML-based configuration for data sources
- Application Insights and health endpoints
Powered by [Leaflet.js](https://leafletjs.com).

**OPerating Instructions:**

- Load the map to begin visualization. There may be a short delay while data loads. Use **Fn + F12** to view browser debug output if needed.  
- Use the optional **Demo Layers** for initial exploration. These rely on generated static sample data.  
- Layers will appear greyed out if the data source cannot be reached. This typically indicates a failed KQL query from the Azure Function to Sentinel or a failed call from the Static Web App to the Function or Logic App.  
- The **Threat Actor Map** uses a static TSV file stored in Blob Storage. It can be updated in Excel and is seeded from public data. There is no auto-refresh. Country attribution may be incomplete or inaccurate, and actors without a country are not displayed.  
- Threat IPs, sign-in activity, and device location data come from Sentinel. IP data is enriched with MaxMind geolocation when needed. Country-level accuracy is generally reliable, but precision decreases toward city and street level. This is not GPS data, and routing, VPNs, or proxies may affect location accuracy.  
- Explore map controls including layer selection, auto-scroll, full-screen mode, and screenshot capture. Hover over points for a summary, and click to open the context menu with options such as search, VirusTotal lookup when applicable, and AI prompt copy-to-clipboard.  
- Drag and drop GeoJSON files onto the page for temporary display. A static custom GeoJSON file can also be hosted in Blob Storage for persistent overlays. Sample GeoJSON sources:

  - Data.gov: https://catalog.data.gov/dataset?q=geojson  
  - Mapping L.A. Boundaries API: https://boundaries.latimes.com/sets/  
  - GitHub search: https://github.com/search?q=geojson 
  - You can also create custom GeoJSON files by drawing directly on a map at: http://geojson.io/  

- This atlas is intended for pattern research and as a visually engaging display for SOC wallboards. It does not provide the accuracy or real-time fidelity required for incident response.  
- The application is designed to be cost-effective and secure. The Static Web App URL is public by default, with additional hardening options available if required.


## 🏗️ Architecture
```
┌─────────────────────────────────────────────────────────┐
│           Azure Static Web App (Frontend)                │
│              Leaflet.js + Vanilla JavaScript             │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
                        │
┌───────────────────────▼─────────────────────────────────┐
│        Azure Function App (Backend - Python)             │
│   /api/refresh  - Refresh data from Sentinel            │
│   /api/data     - Serve GeoJSON to frontend             │
│   /api/health   - Health check                          │
└───────┬────────────────────────────┬────────────────────┘
  │                            │
  │ Query (KQL)                │ Store (TSV/GeoJSON)
  ▼                            ▼
┌─────────────────────┐    ┌──────────────────────┐
│  Log Analytics      │    │  Blob Storage        │
│  (Sentinel)         │    │  - datasets/         │
│                     │    │  - watermarks/       │
│  + SigninLogs       │    │  - locks/            │
│  + DeviceInfo       │    └──────────────────────┘
│  + ThreatIntel      │
└─────────────────────┘

## Azure Costs


**Core Azure resources required:**
- Azure Static Web App (Standard tier required for stand-alone Function App integration)
- Azure Function App
- Azure Maps Account (Gen2, pay-as-you-go; paid tier required for weather overlays)
- Azure Storage Account

**Typical monthly cost:** $10–20 USD covers most demo or small production environments. For advanced security, add Microsoft Defender for Cloud (MDC) at $25–40 USD/month.
**MaxMind:** IP geolocation uses a free GeoLite2 license. Business/commercial users must obtain a paid MaxMind license to comply with terms—see [MaxMind licensing](https://www.maxmind.com).

### Function App — Consumption Plan Pricing

The Function App runs on the **Consumption (serverless) plan**, which bills only when functions execute:

| Meter | Free grant | Paid rate |
|---|---|---|
| Execution time | 400,000 GB-s / month | $0.000016 / GB-s |
| Executions | 1,000,000 / month | $0.20 / million |

**Important:** The free grant is **per Azure subscription per month**, shared across all function apps in that subscription — not per app. If you have other function apps in the same subscription they draw from the same pool.

Each invocation in this app (a blob read or API call) is roughly 200 ms × 128–256 MB ≈ 0.03–0.05 GB-s. At that rate the free monthly grant covers several million calls before any charge appears.

**Blob storage reads for map layers** (GeoJSON files) can bypass the function entirely if the storage container is configured for anonymous blob access — this reduces function invocations and the associated GB-s consumption to near zero for those requests. Whether that is appropriate depends on the sensitivity of the data and the environment; see below.

### Blob Storage Access — Network vs. Authentication

These are two independent controls that are often conflated:

**Network Access** — controls whether blob storage is reachable from the internet at all.
- **Enabled (default):** the storage endpoint is publicly routable. Authentication still controls what can be read; network exposure alone is low risk when anonymous access is disabled.
- **Disabled:** requires a private endpoint (~$7–10/month) or VNET integration to reach blob storage. Eliminates network-level exposure but adds cost and infrastructure complexity.

**Authentication** — controls who can read blobs once the account is reachable:

| Option | How it works | Pros | Cons | Suitable for |
|---|---|---|---|---|
| **Anonymous** | No auth — URL is sufficient | Zero function calls; simplest setup | Security by obscurity only; blob URL pattern is predictable and could be guessed | Demo / dev / test only |
| **SAS token** | Bearer token embedded in request URL; expiry up to 2 years | No function calls; time-limited | Token is a credential that must be secured and rotated; visible in browser network requests; cannot be stored as a plain SWA environment variable (exposed to browser) — must be served from the Function App or Key Vault; easy to overlook at renewal | Short-term or controlled sharing |
| **Function App (Managed Identity)** | SWA cannot use Managed Identity directly; blob reads proxy through the Function App, which uses its own MI to authenticate to storage | No secrets to manage or rotate; most secure option without Key Vault | One function invocation per file read; adds to GB-s consumption (within free tier for normal usage) | Production |
| **Private endpoint + disabled public access** | Disables public network access; only VNET-connected resources can reach storage | Strongest network isolation | ~$7–10/month for the endpoint; significant infrastructure complexity | High-security production |

**Note on Key Vault:** KV was intentionally excluded from this project to reduce cost (~$5/month) and complexity. It could be added to securely store and serve a SAS token if the Function proxy approach is not desired.

**Recommended by environment:**
- **Demo / dev / test:** anonymous access enabled, public network access enabled
- **Production:** anonymous access disabled, public network access enabled, reads proxied through the Function App with Managed Identity
- **High-security production:** anonymous access disabled, public network access disabled, private endpoint added

> **Important:** This application may display real threat intelligence, sign-in activity, and device location data sourced from Microsoft Sentinel. Anonymous blob access exposes that data to anyone who knows or guesses the URL. It should not be used outside of demo or test environments populated with synthetic data.

### Capping Spend with the Daily Usage Quota

For public demo deployments you can set a hard daily ceiling in the Azure Portal:

> **Function App → Configuration → Function runtime settings → Daily Usage Quota (GB-s)**

When the quota is reached the function app stops for the rest of the UTC day and resumes automatically at midnight. Setting it to `0` disables the cap entirely.

**Suggested values:**

| Scenario | Quota | Why |
|---|---|---|
| Only app in the subscription | `12000` GB-s | ~90 % of the daily share of the free grant (~13,333 GB-s/day); leaves a buffer for other overhead |
| Shared subscription | `2000`–`4000` GB-s | Reserves most of the free grant for other apps |
| Public demo with strict abuse protection | `500`–`1000` GB-s | Still allows tens of thousands of calls; well within free tier; stops bots cold |

> **Tip:** For a fully isolated public demo consider deploying to a separate Azure subscription so any quota or grant consumption cannot affect production workloads.

## 🚀 Quick Deploy
Deploy the entire application to Azure in ~5 minutes:

**PowerShell (Windows):**
```powershell
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID"

# For Azure Government (GCC/GCC-High)
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID" -Cloud AzureUSGovernment
```

**Bash (Linux/macOS):**
```bash
./deploy.sh --workspace-id "YOUR-WORKSPACE-ID"

# For Azure Government (GCC/GCC-High)
./deploy.sh --workspace-id "YOUR-WORKSPACE-ID" --cloud AzureUSGovernment
```

**Requirements:**
- Azure CLI installed and authenticated
- Owner or Contributor role on subscription or target resource group



## 📁 Repository Structure

```
├── api/                         # Azure Functions backend (Python)
│   ├── function_app.py         # HTTP endpoints (refresh, health, data)
│   ├── sources.yaml            # Data source configurations (KQL queries)
│   ├── requirements.txt        # Python dependencies
│   └── shared/                 # Utility modules
│       ├── log_analytics_client.py
│       ├── blob_storage.py
│       ├── geo_enrichment.py
│       └── ...
│
├── web/                        # Static Web App frontend
│   ├── index.html             # Main application UI
│   ├── src/                   # JavaScript modules
│   │   ├── app.js            # Application logic
│   │   ├── map/              # Leaflet map components
│   │   └── data/             # Data fetching
│   └── api/                  # Legacy SWA API (not deployed in current workflow)
│
├── .github/workflows/         # CI/CD automation
│   ├── deploy-function.yml   # Backend deployment
│   └── azure-static-web-apps.yml  # Frontend deployment
│
├── tests/                     # Test helpers and development data utilities
├── deploy.ps1                 # Automated Azure deployment (PowerShell)
├── deploy.sh                  # Automated Azure deployment (Bash)
└── *.tsv, *.geojson          # Sample/generated data files (see below)
```

### Development Utility Files (`tests`)

The `tests` directory contains:
- Deployment scripts: `deploy.ps1`, `deploy.sh`
- Data generation: `generate_device_locations.py`, `generate_mde_devices.py`, `generate_signin_data.py`, `generate-mde-geojson.py`
- Geo-enrichment: `manual-geo-enrich.py`, `manual-geo-enrich-free.py`
- Sample data: `sample-data/mde-devices-enriched.tsv`, `sample-data/mde-devices-test.tsv`, `sample-data/mde-devices.geojson`

These scripts and files are for development/testing only and not required for normal app runtime or deployment.
```

### Post-Deployment

1. **Verify backend health:**
   ```bash
   curl https://YOUR-FUNCTION-APP.azurewebsites.net/api/health
   ```

2. **Trigger first data refresh:**
   ```bash
   curl -X POST https://YOUR-FUNCTION-APP.azurewebsites.net/api/refresh
   ```

3. **Access the web application:**
   ```
   https://YOUR-STATIC-WEB-APP.azurestaticapps.net
   ```

## 🔧 Configuration

### Adding Custom Data Sources

Edit [api/sources.yaml](api/sources.yaml) to add your own KQL queries:

```yaml
sources:
  - id: my-custom-source
    name: "My Security Data"
    enabled: true
    refresh_interval_seconds: 3600
    query_time_window_hours: 24
    output_filename: "my-data.tsv"
    kql_query: |
      MyTable
      | where TimeGenerated >= ago({time_window}h)
      | project TimeGenerated, IPAddress, UserName, Action
      | order by TimeGenerated desc
    columns:
      - TimeGenerated
      - IPAddress
      - UserName
      - Action
```

Deploy your changes:
```bash
# Via script
cd api
func azure functionapp publish YOUR-FUNCTION-APP-NAME

# Or via GitHub Actions
git add api/sources.yaml
git commit -m "Add custom data source"
git push origin main
```


### Configuration & Secrets

**Environment Variables (Function):**
| Variable | Description | Required |
|----------|-------------|----------|
| `LOG_ANALYTICS_WORKSPACE_ID` | Sentinel workspace GUID (set by deployment) | ✅ |
| `STORAGE_ACCOUNT_URL` | Blob storage URL | ✅ |
| `STORAGE_CONTAINER_DATASETS` | Container name for data files | ✅ |
| `STORAGE_CONTAINER_LOCKS` | Container name for lock files | ✅ |
| `DEFAULT_REFRESH_INTERVAL_SECONDS` | Throttle interval (default: 300) | ✅ |
| `MAXMIND_LICENSE_KEY` | MaxMind GeoLite2 license key (required for IP geolocation) | ✅ |
| `AZURE_MAPS_SUBSCRIPTION_KEY` | Azure Maps key (required for weather overlays) | ✅ |

All secrets must be set as environment variables in the Function App configuration. Key Vault is no longer used.

## Configuration Notes

- You may use a custom domain for your Static Web App (SWA) deployment. See Azure SWA documentation for setup.

## 📡 API Reference

### Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check - returns service status |
| `/api/refresh` | GET/POST | Trigger data refresh from Sentinel |
| `/api/config` | GET | Get current source configurations |
| `/api/data/{source_id}` | GET | Serve GeoJSON data for frontend |

**Example - Trigger Refresh:**
```bash
# Refresh all sources
curl -X POST https://YOUR-FUNCTION.azurewebsites.net/api/refresh

# Refresh specific source
curl "https://YOUR-FUNCTION.azurewebsites.net/api/refresh?source_id=signin_failures"

# Force refresh (bypass throttling)
curl "https://YOUR-FUNCTION.azurewebsites.net/api/refresh?force=true"
```

**Example Response:**
```json
{
  "message": "Refreshed 2/2 sources",
  "refreshed_count": 2,
  "results": [
    {
      "source_id": "signin_failures",
      "status": "refreshed",
      "row_count": 1234,
      "output_file": "signin-failures.tsv"
    }
  ]
}
```

📖 **[Full API Documentation](api/README.md)**

## 🔍 Development & Testing

### Local Development

```bash
# Backend (Function App)
cd api
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
func start

# Frontend (Static Web App)
cd web
# Open index.html in browser or use a local server
python -m http.server 8000
```

### Running Tests

```bash
# Backend tests (debugging scripts)
cd tests
python test_direct_api.py
python test_geo_debug.py

# Linting (CI/CD)
cd api
black --check .
flake8 .
```

### Monitoring & Logs

**View Function Logs:**
```bash
az functionapp log tail --name YOUR-FUNCTION-APP --resource-group YOUR-RG
```

**Application Insights Query:**
```kusto
traces
| where cloud_RoleName contains "sentinel-activity"
| where timestamp > ago(1h)
| order by timestamp desc
```

## 🛠️ Troubleshooting

### Common Issues

**❌ 401/403 Authentication Errors**
- Verify Managed Identity is enabled on Function App
- Check RBAC role assignments:
  - Log Analytics Reader on Sentinel workspace
  - Storage Blob Data Contributor on storage account

**❌ 404 Errors After Deployment**
- Wait 30-60 seconds for function cold start
- Verify deployment completed: `az functionapp show --name YOUR-FUNCTION-APP`

**❌ No Data on Map**
- Check blob storage has files: `az storage blob list --container datasets`
- Test API endpoint directly: `/api/data/signin-activity`
- Review browser console for errors

**❌ Geo-Enrichment Not Working**
- Verify MaxMind license key is configured (optional)
- Check Application Insights logs for geo lookup errors
- Fallback: Azure Maps IP geolocation API

**❌ Query Timeouts**
- Reduce `query_time_window_hours` in sources.yaml
- Add filters to KQL query to limit results
- Check Log Analytics workspace performance

## 🔄 CI/CD with GitHub Actions

Deployments are automated via GitHub Actions workflows:

- **Backend:** `.github/workflows/deploy-function.yml`
  - Triggers on changes to `api/**`
  - Deploys Function App automatically
  
- **Frontend:** `.github/workflows/azure-static-web-apps.yml`
  - Triggers on changes to `web/**`
  - Deploys Static Web App automatically

- **Testing:** `.github/workflows/lint-test.yml`
  - Runs on pull requests
  - Black formatter + Flake8 linting

📖 **[Workflow Documentation](.github/workflows/README.md)**

## 🧹 Cleanup

Remove all Azure resources:

```bash
# Delete resource group (WARNING: Deletes everything)
# Global Threat Intelligence Atlas

<img src="screenshot-global-threat-map.png" alt="Global Threat Activity Map" width="600"/>
[Live Demo](https://jolly-cliff-0f92c201e.2.azurestaticapps.net/)

## Overview
Global Threat Intelligence Atlas is an Azure-hosted interactive map for SOC and threat intelligence teams. Designed for wall displays and analyst dashboards.

**Capabilities:**
- Visualizes real-time and historical threat activity
- Displays device locations and sign-in events
- Overlays static threat actor maps and custom GeoJSON
- Weather overlays and screen capture
- Secure Azure Static Web App + Function App backend
- Managed Identity and Key Vault for secrets
- Custom domain and public/private access options
- YAML-based configuration for data sources
- Application Insights and health endpoints
Powered by [Leaflet.js](https://leafletjs.com).

## 🏗️ Architecture
```
┌─────────────────────────────────────────────────────────┐
│           Azure Static Web App (Frontend)                │
│              Leaflet.js + Vanilla JavaScript             │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
                        │
┌───────────────────────▼─────────────────────────────────┐
│        Azure Function App (Backend - Python)             │
│   /api/refresh  - Refresh data from Sentinel            │
│   /api/data     - Serve GeoJSON to frontend             │
│   /api/health   - Health check                          │
└───────┬────────────────────────────┬────────────────────┘
        │                            │
        │ Query (KQL)                │ Store (TSV/GeoJSON)
        ▼                            ▼
┌─────────────────────┐    ┌──────────────────────┐
│  Log Analytics      │    │  Blob Storage        │
│  (Sentinel)         │    │  - datasets/         │
│                     │    │  - watermarks/       │
│  + SigninLogs       │    │  - locks/            │
│  + DeviceInfo       │    └──────────────────────┘
│  + ThreatIntel      │
└─────────────────────┘
```

## Azure Costs

**Core Azure resources required:**
- Azure Static Web App (Standard tier required for stand-alone Function App integration)
- Azure Function App
- Azure Maps Account (Gen2, pay-as-you-go; paid tier required for weather overlays)
- Azure Key Vault
- Azure Storage Account

**Typical monthly cost:** $10–20 USD covers most demo or small production environments. For advanced security, add Microsoft Defender for Cloud (MDC) at $25–40 USD/month.
**MaxMind:** IP geolocation uses a free GeoLite2 license. Business/commercial users must obtain a paid MaxMind license to comply with terms—see [MaxMind licensing](https://www.maxmind.com).

## 🚀 Quick Deploy
Deploy the entire application to Azure in ~5 minutes:

**PowerShell (Windows):**
```powershell
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID"

# For Azure Government (GCC/GCC-High)
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID" -Cloud AzureUSGovernment
```

**Bash (Linux/macOS):**
```bash
./deploy.sh --workspace-id "YOUR-WORKSPACE-ID"

# For Azure Government (GCC/GCC-High)
./deploy.sh --workspace-id "YOUR-WORKSPACE-ID" --cloud AzureUSGovernment
```

**Requirements:**
- Azure CLI installed and authenticated
- Owner or Contributor role on subscription or target resource group
- Microsoft Sentinel workspace with data

**What gets deployed:**
- Azure Function App (Python backend)
- Azure Static Web App (frontend)
- Storage Account (data + locks)
- Managed Identity with required RBAC roles

**Deployment model:**
- Frontend (SWA) deploys via GitHub Actions (`azure-static-web-apps.yml`)
- Stand-alone Function App deploys via CLI or function workflow (`deploy-function.yml`)

## 📁 Repository Structure
```
├── api/                         # Azure Functions backend (Python)
│   ├── function_app.py         # HTTP endpoints (refresh, health, data)
│   ├── sources.yaml            # Data source configurations (KQL queries)
│   ├── requirements.txt        # Python dependencies
│   └── shared/                 # Utility modules
│       ├── log_analytics_client.py
│       ├── blob_storage.py
│       ├── geo_enrichment.py
│       └── ...
│
├── web/                        # Static Web App frontend
│   ├── index.html             # Main application UI
│   ├── src/                   # JavaScript modules
│   │   ├── app.js            # Application logic
│   │   ├── map/              # Leaflet map components
│   │   └── data/             # Data fetching
│   └── api/                  # Legacy SWA API (not deployed in current workflow)
│
├── .github/workflows/         # CI/CD automation
│   ├── deploy-function.yml   # Backend deployment
│   └── azure-static-web-apps.yml  # Frontend deployment
│
├── tests/                     # Test helpers and development data utilities
├── deploy.ps1                 # Automated Azure deployment (PowerShell)
├── deploy.sh                  # Automated Azure deployment (Bash)
└── *.tsv, *.geojson          # Sample/generated data files (see below)
```

### Development Utility Files (`tests`)

The `tests` directory contains:
- Deployment scripts: `deploy.ps1`, `deploy.sh`
- Data generation: `generate_device_locations.py`, `generate_mde_devices.py`, `generate_signin_data.py`, `generate-mde-geojson.py`
- Geo-enrichment: `manual-geo-enrich.py`, `manual-geo-enrich-free.py`
- Sample data: `sample-data/mde-devices-enriched.tsv`, `sample-data/mde-devices-test.tsv`, `sample-data/mde-devices.geojson`

These scripts and files are for development/testing only and not required for normal app runtime or deployment.
```

### Post-Deployment

1. **Verify backend health:**
   ```bash
   curl https://YOUR-FUNCTION-APP.azurewebsites.net/api/health
   ```

2. **Trigger first data refresh:**
   ```bash
   curl -X POST https://YOUR-FUNCTION-APP.azurewebsites.net/api/refresh
   ```

3. **Access the web application:**
   ```
   https://YOUR-STATIC-WEB-APP.azurestaticapps.net
   ```

## 🔧 Configuration

### Adding Custom Data Sources

Edit [api/sources.yaml](api/sources.yaml) to add your own KQL queries:

```yaml
sources:
  - id: my-custom-source
    name: "My Security Data"
    enabled: true
    refresh_interval_seconds: 3600
    query_time_window_hours: 24
    output_filename: "my-data.tsv"
    kql_query: |
      MyTable
      | where TimeGenerated >= ago({time_window}h)
      | project TimeGenerated, IPAddress, UserName, Action
      | order by TimeGenerated desc
    columns:
      - TimeGenerated
      - IPAddress
      - UserName
      - Action
```

Deploy your changes:
```bash
# Via script
cd api
func azure functionapp publish YOUR-FUNCTION-APP-NAME

# Or via GitHub Actions
git add api/sources.yaml
git commit -m "Add custom data source"
git push origin main
```

### Configuration & Secrets

**Environment Variables (non-secret):**
| Variable | Description | Required |
|----------|-------------|----------|
| `LOG_ANALYTICS_WORKSPACE_ID` | Sentinel workspace GUID (set by deployment) | ✅ |
| `STORAGE_ACCOUNT_URL` | Blob storage URL | ✅ |
| `STORAGE_CONTAINER_DATASETS` | Container name for data files | ✅ |
| `STORAGE_CONTAINER_LOCKS` | Container name for lock files | ✅ |
| `DEFAULT_REFRESH_INTERVAL_SECONDS` | Throttle interval | ✅ |
| `KEY_VAULT_NAME` | Azure Key Vault name (for secrets) | ✅ |

**Secrets (must be stored in Key Vault):**
- `MAXMIND-LICENSE-KEY` (required for IP geolocation)
- `AZURE-MAPS-SUBSCRIPTION-KEY` (required for weather overlays)

After deployment, add your MaxMind license key and any other required secrets to Azure Key Vault. The Function App uses Managed Identity to access secrets at runtime.

## Configuration Notes

- You may use a custom domain for your Static Web App (SWA) deployment. See Azure SWA documentation for setup.

## 📡 API Reference

### Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check - returns service status |
| `/api/refresh` | GET/POST | Trigger data refresh from Sentinel |
| `/api/config` | GET | Get current source configurations |
| `/api/data/{source_id}` | GET | Serve GeoJSON data for frontend |

**Example - Trigger Refresh:**
```bash
# Refresh all sources
curl -X POST https://YOUR-FUNCTION.azurewebsites.net/api/refresh

# Refresh specific source
curl "https://YOUR-FUNCTION.azurewebsites.net/api/refresh?source_id=signin_failures"

# Force refresh (bypass throttling)
curl "https://YOUR-FUNCTION.azurewebsites.net/api/refresh?force=true"
```

**Example Response:**
```json
{
  "message": "Refreshed 2/2 sources",
  "refreshed_count": 2,
  "results": [
    {
      "source_id": "signin_failures",
      "status": "refreshed",
      "row_count": 1234,
      "output_file": "signin-failures.tsv"
    }
  ]
}
```

📖 **[Full API Documentation](api/README.md)**

## 🔍 Development & Testing

### Local Development

```bash
# Backend (Function App)
cd api
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
func start

# Frontend (Static Web App)
cd web
# Open index.html in browser or use a local server
python -m http.server 8000
```

### Running Tests

```bash
# Backend tests (debugging scripts)
cd tests
python test_direct_api.py
python test_geo_debug.py

# Linting (CI/CD)
cd api
black --check .
flake8 .
```

### Monitoring & Logs

**View Function Logs:**
```bash
az functionapp log tail --name YOUR-FUNCTION-APP --resource-group YOUR-RG
```

**Application Insights Query:**
```kusto
traces
| where cloud_RoleName contains "sentinel-activity"
| where timestamp > ago(1h)
| order by timestamp desc
```

## 🛠️ Troubleshooting

### Common Issues

**❌ 401/403 Authentication Errors**
- Verify Managed Identity is enabled on Function App
- Check RBAC role assignments:
  - Log Analytics Reader on Sentinel workspace
  - Storage Blob Data Contributor on storage account

**❌ 404 Errors After Deployment**
- Wait 30-60 seconds for function cold start
- Verify deployment completed: `az functionapp show --name YOUR-FUNCTION-APP`

**❌ No Data on Map**
- Check blob storage has files: `az storage blob list --container datasets`
- Test API endpoint directly: `/api/data/signin-activity`
- Review browser console for errors

**❌ Geo-Enrichment Not Working**
- Verify MaxMind license key is configured (optional)
- Check Application Insights logs for geo lookup errors
- Fallback: Azure Maps IP geolocation API

**❌ Query Timeouts**
- Reduce `query_time_window_hours` in sources.yaml
- Add filters to KQL query to limit results
- Check Log Analytics workspace performance

## 🔄 CI/CD with GitHub Actions

Deployments are automated via GitHub Actions workflows:

- **Backend:** `.github/workflows/deploy-function.yml`
  - Triggers on changes to `api/**`
  - Deploys Function App automatically
  
- **Frontend:** `.github/workflows/azure-static-web-apps.yml`
  - Triggers on changes to `web/**`
  - Deploys Static Web App automatically

- **Testing:** `.github/workflows/lint-test.yml`
  - Runs on pull requests
  - Black formatter + Flake8 linting

📖 **[Workflow Documentation](.github/workflows/README.md)**

## 🧹 Cleanup

Remove all Azure resources:

```bash
# Delete resource group (WARNING: Deletes everything)
az group delete --name rg-sentinel-activity-maps --yes --no-wait
```

Or delete individual resources via Azure Portal.

## 📚 Documentation

- **[Backend API](api/README.md)** - Function App details
- **[Frontend](web/README.md)** - Static Web App details  
- **[Workflows](.github/workflows/README.md)** - CI/CD automation
- **[Tests](tests/README.md)** - Development testing scripts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally
4. Commit with descriptive messages
5. Push and create a pull request

**Code Style:**
- Python: PEP 8 (enforced by Black and Flake8)
- JavaScript: Standard conventions
- Add documentation for new features

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

## 👤 Author

**Andrew Blumhardt**
- GitHub: [@AndrewBlumhardt](https://github.com/AndrewBlumhardt)
- Repository: [sentinel-activity-maps](https://github.com/AndrewBlumhardt/sentinel-activity-maps)

---

**Need help?** Open an issue on [GitHub](https://github.com/AndrewBlumhardt/sentinel-activity-maps/issues).
```

Or delete individual resources via Azure Portal.

## 📚 Documentation

- **[Backend API](api/README.md)** - Function App details
- **[Frontend](web/README.md)** - Static Web App details  
- **[Workflows](.github/workflows/README.md)** - CI/CD automation
- **[Tests](tests/README.md)** - Development testing scripts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally
4. Commit with descriptive messages
5. Push and create a pull request

**Code Style:**
- Python: PEP 8 (enforced by Black and Flake8)
- JavaScript: Standard conventions
- Add documentation for new features

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

## 👤 Author

**Andrew Blumhardt**
- GitHub: [@AndrewBlumhardt](https://github.com/AndrewBlumhardt)
- Repository: [sentinel-activity-maps](https://github.com/AndrewBlumhardt/sentinel-activity-maps)

---

**Need help?** Open an issue on [GitHub](https://github.com/AndrewBlumhardt/sentinel-activity-maps/issues).
