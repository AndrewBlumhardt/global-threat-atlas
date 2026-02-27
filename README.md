





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

This solution uses several Azure services with associated costs. Here's a breakdown to help you budget:

### Service Cost Summary

| Service | Tier | Monthly Cost | Notes |
|---------|------|--------------|-------|
| **Azure Static Web App** | Standard | ~$9 USD | Required for Managed Identity (keyless auth) |
| **Azure Functions** | Consumption | ~$0-2 USD | Pay-per-execution; typically free under grant |
| **Azure Storage** | Standard (LRS) | ~$1-5 USD | Stores TSV/GeoJSON data files |
| **Azure Key Vault** | Standard | ~$0.03 USD | Secure secret storage (Maps, MaxMind keys) |
| **Azure Maps** | Gen2 (Free/Paid) | ~$0-5 USD | Free tier sufficient; paid needed for weather |
| | | **~$10-20 USD/month** | **Base infrastructure** |
| **Defender for Cloud** | Recommended | **+$25-40 USD/month** | **Threat protection (recommended except personal demos)** |

### Key Service Details

**Azure Static Web App (Standard)** - $9/month required for Managed Identity support. Free tier requires storing keys in app settings (security risk).

**Azure Maps** - Free tier (5,000 transactions/month) covers basic mapping. Paid tier (~$0.50 per 1,000 transactions) required only for weather radar/infrared overlays.

**Azure Functions (Consumption)** - First 1M executions free monthly. This app typically runs hourly/daily refreshes, staying within free grant.

**Storage & Key Vault** - Minimal costs for low data volumes. Key Vault operations typically <1,000/month (effectively free at $0.03 per 10k operations).

### 🛡️ Microsoft Defender for Cloud

**Recommended for all Azure deployments handling security data** (except personal demo tenants). Provides threat detection, malware scanning, and compliance monitoring.

| Defender Plan | Monthly Cost | Protection |
|--------------|--------------|------------|
| **Defender for Storage** | ~$10/account | Malware scanning, activity monitoring |
| **Defender for App Service** | ~$15/plan | Runtime threat detection |
| **Defender for Key Vault** | ~$0.02/10k ops | Anomalous access detection |
| **Defender CSPM (Premium)** | ~$5/resource | Attack path analysis, governance |

**Cost Optimization:** Share Storage Accounts and Key Vaults across multiple apps to reduce per-app Defender costs (e.g., $10 for shared storage vs $10 per app).

**Foundational CSPM (Free):** Basic security recommendations and secure score included at no cost for all environments.

### Total Monthly Estimate

| Configuration | Monthly Cost | Use Case |
|--------------|--------------|----------|
| **Base Infrastructure** | ~$10-20 | Personal demos only |
| **With Defender for Cloud** | ~$35-60 | All corporate/production environments |

💡 **Recommendation:** Budget $35-60/month for secured deployments. Use base infrastructure ($10-20) only for personal learning environments.

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

The `tests` directory contains utility scripts used for development and testing:

**Deployment Scripts (Keep at Root):**
- `deploy.ps1` - PowerShell deployment automation
- `deploy.sh` - Bash deployment automation

**Data Generation Scripts:**
- `tests/generate_device_locations.py` - Generate sample MDE device location data
- `tests/generate_mde_devices.py` - Generate sample MDE device inventory
- `tests/generate_signin_data.py` - Generate sample sign-in activity data
- `tests/generate-mde-geojson.py` - Convert MDE data to GeoJSON format

**Geo-Enrichment Scripts:**
- `tests/manual-geo-enrich.py` - Manual geo-enrichment using MaxMind
- `tests/manual-geo-enrich-free.py` - Manual geo-enrichment using free services

**Sample Data Files:**
- `tests/sample-data/mde-devices-enriched.tsv` - Sample enriched device data
- `tests/sample-data/mde-devices-test.tsv` - Test device data
- `tests/sample-data/mde-devices.geojson` - Sample GeoJSON output

> **Note:** These scripts are development-only and are not required for normal app runtime or deployment.
```

📖 **See individual README files in each directory for detailed documentation**

## 🚀 Getting Started

### Prerequisites

- **Azure Resources:**
  - Microsoft Sentinel workspace (or Log Analytics with security data)
  - Azure subscription with Owner/Contributor access
- **Tools:**
  - [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) (for deployment)
  - [Python 3.11+](https://www.python.org/downloads/) (for local development)
  - [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (for local testing)

### Deployment Options

#### Option 1: Automated Deployment (Recommended)
Use the deployment scripts to automatically create all resources:

```powershell
# Login to Azure
az login

# Deploy everything
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID"
```

#### Option 2: GitHub Actions CI/CD
Set up automated deployments on every commit:
1. Configure OIDC authentication (see [workflows README](.github/workflows/README.md))
2. Add repository secrets
3. Push to `main` branch

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

### Environment Variables

Configure these in Azure Function App Settings:

| Variable | Description | Required |
|----------|-------------|----------|
| `LOG_ANALYTICS_WORKSPACE_ID` | Sentinel workspace GUID | ✅ |
| `STORAGE_ACCOUNT_URL` | Blob storage URL | ✅ |
| `STORAGE_CONTAINER_DATASETS` | Container name for data files | ✅ |
| `STORAGE_CONTAINER_LOCKS` | Container name for lock files | ✅ |
| `MAXMIND_LICENSE_KEY` | MaxMind GeoLite2 license (optional) | ❌ |
| `DEFAULT_REFRESH_INTERVAL_SECONDS` | Throttle interval (default: 300) | ❌ |

## Configuration Notes

- You may use a custom domain for your Static Web App (SWA) deployment. See Azure SWA documentation for setup.

## 💡 Features

*This section intentionally removed for clarity. See Overview and Architecture for key capabilities.*
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
