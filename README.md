# Sentinel Activity Maps

Interactive geospatial visualization of Microsoft Sentinel security data. This project combines an Azure Static Web App frontend with an Azure Functions Python backend to query, enrich, and display threat intelligence and security telemetry on an interactive map.

## 🎯 Overview

**Sentinel Activity Maps** helps security teams visualize and analyze:
- Azure AD sign-in activity across geographic locations
- Microsoft Defender for Endpoint (MDE) device locations
- Threat intelligence indicators with geographic context
- Custom security telemetry from Log Analytics

**Key Features:**
- 🗺️ Interactive map visualization using Leaflet.js
- 🔄 Real-time data refresh from Microsoft Sentinel
- 🌍 Automatic geo-enrichment of IP addresses
- 🔒 Secure authentication via Azure Managed Identity
- 📊 Customizable KQL queries for any Log Analytics data
- 🚀 One-command deployment to Azure

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

## � Azure Costs

This solution uses several Azure services with associated costs. Here's a breakdown to help you budget:

### Service Cost Summary

| Service | Tier | Monthly Cost | Notes |
|---------|------|--------------|-------|
| **Azure Static Web App** | Standard | ~$9 USD | Required for Managed Identity support |
| **Azure Functions** | Consumption | ~$0-2 USD | Pay-per-execution; typically pennies or free |
| **Azure Storage** | Standard (LRS) | ~$1-5 USD | Depends on data volume and access frequency |
| **Azure Key Vault** | Standard | ~$0.03 USD | Per 10,000 secret operations |
| **Azure Maps** | Gen2 (S0/Free) | ~$0 USD | Free tier: 5,000 transactions/month |
| **Azure Maps** | Gen2 (S1/Paid) | ~$0.50 USD | Per 1,000 transactions (optional, see below) |
| | | **~$10-20 USD/month** | **Base infrastructure costs** |
| **Defender for Cloud** | Optional | **+$30-40 USD/month** | **Advanced threat protection (recommended for production)** |

### Detailed Cost Breakdown

#### 🌐 Azure Static Web App - **Standard Tier Required**

**Cost:** $9 USD per app per month

**Why Standard vs Free?**
- ✅ **Managed Identity support** - Required for secure, keyless authentication
- ✅ **Key Vault integration** - Retrieves Azure Maps and MaxMind secrets securely
- ✅ **Storage Account access** - Serves GeoJSON data files with MI authentication
- ✅ **Custom domains support** - Professional deployment URLs
- ✅ **Staging environments** - Preview deployments for testing

**Free Tier Alternative:**
You *could* use the Free tier, but it requires:
- ❌ Storing Azure Maps keys in app settings (visible in portal - security risk)
- ❌ Using storage connection strings instead of Managed Identity (less secure)
- ❌ Service Principal tokens with expiration dates (maintenance overhead)

**Recommendation:** Use Standard tier for production. The $9/month investment provides enterprise-grade security via Managed Identity.

#### 🗺️ Azure Maps - **Free or Paid Tier**

**Free Tier (Gen2 S0):** 5,000 map tile transactions/month
- ✅ Map rendering (road, satellite, grayscale styles)
- ✅ Custom data layers (markers, lines, polygons, heatmaps)
- ✅ Geocoding (convert addresses to coordinates)
- ❌ **Weather layers NOT included** (radar, infrared overlays)

**Paid Tier (Gen2 S1):** ~$0.50 USD per 1,000 transactions
- ✅ All free tier features
- ✅ **Weather radar and infrared tile layers**
- ✅ Higher API rate limits (production-ready)
- ✅ Traffic data, routing, and advanced services

**Transaction Optimization:**
- Frontend caches map tiles efficiently (reduces API calls)
- GeoJSON data served from Blob Storage (not live API queries)
- Typical usage: 2,000-10,000 transactions/month (~$1-5 USD)

**Recommendation:** Start with Free tier. Upgrade to Paid only if you need weather overlays or exceed 5,000 monthly transactions.

#### ⚡ Azure Functions - **Consumption Plan**

**Cost:** ~$0-2 USD/month (often **free** under monthly grant)

**Pricing Model:**
- First 1 million executions: **FREE** per month
- First 400,000 GB-seconds of execution: **FREE** per month
- After that: $0.20 per million executions + $0.000016/GB-second

**Typical Usage:**
- Function executes only when `/api/refresh` endpoint is called
- Execution time: 5-30 seconds per refresh
- Frequency: Hourly to daily refreshes
- **Real-world cost:** Usually pennies or covered by free grant

**No App Service Plan Costs:** Consumption plan has no baseline infrastructure cost - you only pay when the function actively runs.

#### 💾 Azure Storage Account - **Standard Tier**

**Cost:** ~$1-5 USD/month for small to moderate workloads

**Pricing Factors:**
- **Data storage:** ~$0.02 per GB/month (LRS)
- **Transactions:** $0.004 per 10,000 read operations
- **Egress:** First 100 GB/month free, then $0.087/GB

**Typical Data Volume:**
- TSV/GeoJSON files: 1-50 MB total
- Watermark tracking files: <1 KB
- Lock files: <1 KB
- **Total storage:** Usually <100 MB

**Storage Containers Used:**
- `datasets/` - GeoJSON and TSV data files
- `watermarks/` - Incremental query tracking
- `locks/` - Concurrent refresh prevention

#### 🔐 Azure Key Vault - **Standard Tier**

**Cost:** ~$0.03 USD per 10,000 secret operations

**Secrets Stored:**
- `AZURE-MAPS-SUBSCRIPTION-KEY` - Retrieved by SWA at startup
- `MAXMIND-LICENSE-KEY` - Retrieved by Function during geo-enrichment

**Typical Usage:**
- SWA retrieves Maps key on initial load: ~1-10 requests/month
- Function retrieves MaxMind key on refresh: ~24-720 requests/month
- **Total operations:** <1,000/month (effectively **free**)

**Why Key Vault?**
- 🔒 Secrets encrypted at rest with hardware security modules
- 🔐 RBAC-controlled access (no keys visible in portal)
- 📋 Audit logging for compliance
- 🔄 Centralized secret rotation

### Cost Optimization Tips

1. **Azure Maps:**
   - Remove weather overlays if not needed (saves paid tier requirement)
   - Use free tier for development/testing
   - Enable frontend tile caching

2. **Azure Functions:**
   - Increase `refresh_interval_seconds` to reduce executions
   - Use time-based triggers (e.g., hourly) instead of on-demand
   - Leverage incremental queries with watermarks

3. **Storage:**
   - Enable blob lifecycle management (auto-delete old files)
   - Use Archive tier for long-term historical data
   - Configure appropriate retention policies

4. **Development/Testing:**
   - Use Azure Free Account ($200 credit for 30 days)
   - Deploy to Dev/Test subscription (discounted rates)
   - Delete resources when not actively developing

### 🛡️ Microsoft Defender for Cloud (Optional Security Layer)

**Important:** The costs above do NOT include Microsoft Defender for Cloud, which provides advanced threat protection for your Azure resources. While optional, Defender for Cloud is **recommended for production environments** handling sensitive security data.

#### Defender Plans for This Solution

| Defender Plan | Monthly Cost | What It Protects |
|--------------|--------------|------------------|
| **Defender for Storage** | ~$10 USD/account | Malware scanning, sensitive data discovery, activity monitoring |
| **Defender for App Service** | ~$15 USD/plan | Runtime threat detection, vulnerability assessment (applies to Static Web Apps on Standard) |
| **Defender for Key Vault** | ~$0.02 USD/10k ops | Anomalous access detection, secret access monitoring |
| **Defender CSPM** (Premium) | ~$5 USD/resource | Attack path analysis, cloud security graph, governance |
| | **+$30-40 USD/month** | **Additional security overhead for production** |

#### Key Points

**What Defender for Cloud Provides:**
- 🔍 **Threat Detection** - Real-time alerts for suspicious activities
- 🛡️ **Malware Scanning** - Automatic scanning of uploaded blobs
- 📊 **Security Recommendations** - Continuous posture assessment
- 🚨 **Attack Path Analysis** - Identify potential security risks
- 📋 **Compliance Dashboards** - Meet regulatory requirements

**Foundational CSPM (Free):**
- Basic security recommendations and secure score are **free**
- Covers basic misconfigurations and best practices
- May be sufficient for non-production environments

**Cost Optimization:**
You can **share resources across multiple applications** to reduce Defender costs:
- ✅ Use a single Storage Account for multiple projects (~$10 total instead of $10 per app)
- ✅ Use a shared Key Vault across applications (~$0.02 per 10k operations regardless of apps)
- ✅ Deploy multiple Static Web Apps to the same App Service Plan (charged once)

**Example Multi-App Deployment:**
If you share a Storage Account and Key Vault across 3-5 Sentinel visualization projects:
- Shared Storage + Defender: $1 + $10 = $11 (instead of $11 × 5 = $55)
- Shared Key Vault + Defender: $0.03 + $0.02 = $0.05 (instead of $0.05 × 5 = $0.25)

**Recommendation:**
- **Development/Testing:** Use foundational CSPM (free) - basic security hygiene
- **Production (Internal):** Enable Defender for Storage only (~$10/month extra)
- **Production (External-Facing):** Enable all Defender plans (~$30-40/month extra)

### Total Monthly Estimate

**Minimum Configuration:**
- Static Web App Standard: $9.00
- Functions (Consumption): $0.00 (free grant)
- Storage: $1.00
- Key Vault: $0.03
- Azure Maps (Free tier): $0.00
- **Total: ~$10-12 USD/month**

**With Paid Maps (Weather):**
- Add ~$1-5 for 2,000-10,000 transactions
- **Total: ~$11-17 USD/month**

**With Defender for Cloud (Production Security):**
- Add ~$30-40 for all Defender plans
- **Total: ~$40-57 USD/month**

**With Defender for Storage Only (Recommended Minimum):**
- Add ~$10 for Defender for Storage
- **Total: ~$20-27 USD/month**

**Cost increases if:**
- High traffic (>100k page views/month)
- Frequent function executions (>1M/month)
- Large data egress (>100 GB/month)

💡 **Summary:**
- **Development/Testing:** ~$10-20 USD/month (base infrastructure)
- **Production (Basic):** ~$20-27 USD/month (+ Defender for Storage)
- **Production (Full Security):** ~$40-57 USD/month (+ all Defender plans)

## �🚀 Quick Deploy

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
│   └── api/                  # SWA-integrated API functions
│
├── .github/workflows/         # CI/CD automation
│   ├── deploy-function.yml   # Backend deployment
│   └── azure-static-web-apps.yml  # Frontend deployment
│
├── tests/                     # Development/debugging scripts
├── deploy.ps1                 # Automated Azure deployment (PowerShell)
├── deploy.sh                  # Automated Azure deployment (Bash)
└── *.py, *.tsv, *.geojson    # Utility scripts and sample data (see below)
```

### Root-Level Utility Files

The root directory contains several utility scripts and sample data files for development and testing:

**Deployment Scripts (Keep at Root):**
- `deploy.ps1` - PowerShell deployment automation
- `deploy.sh` - Bash deployment automation

**Data Generation Scripts:**
- `generate_device_locations.py` - Generate sample MDE device location data
- `generate_mde_devices.py` - Generate sample MDE device inventory
- `generate_signin_data.py` - Generate sample sign-in activity data
- `generate-mde-geojson.py` - Convert MDE data to GeoJSON format

**Geo-Enrichment Scripts:**
- `manual-geo-enrich.py` - Manual geo-enrichment using MaxMind
- `manual-geo-enrich-free.py` - Manual geo-enrichment using free services

**Sample Data Files:**
- `mde-devices-enriched.tsv` - Sample enriched device data
- `mde-devices-test.tsv` - Test device data
- `mde-devices.geojson` - Sample GeoJSON output

> **Note:** These utility scripts and data files are primarily for development/testing. Consider organizing them:
> - Move `generate_*.py` scripts to `scripts/` or `tools/` directory
> - Move `manual-geo-enrich*.py` to `scripts/` or `api/scripts/`
> - Move `.tsv` and `.geojson` files to `tests/sample-data/` or `.gitignore` them if generated
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

## 💡 Features

**Security:**
- 🔒 Managed Identity authentication (no secrets in code)
- 🔐 RBAC-based access control
- 🛡️ Secure CORS configuration

**Performance:**
- ⚡ Blob-based locking prevents concurrent refresh conflicts
- 📊 Incremental queries with watermark tracking
- 🚦 Time-based throttling prevents excessive queries
- 🌍 Automatic IP geo-enrichment (MaxMind/Azure Maps)

**Extensibility:**
- 📝 YAML-based configuration (no code changes needed)
- 🔌 Pluggable refresh policies
- 📍 Custom geo-enrichment logic
- 🗺️ Any Log Analytics table supported

**Observability:**
- 📈 Application Insights integration
- 📋 Structured logging with correlation IDs
- ❤️ Health check endpoints
- 📊 GitHub Actions status badges
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
