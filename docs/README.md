# Sentinel Activity Maps Documentation

Complete documentation for deploying, configuring, and using the Sentinel Activity Maps application.

## 📖 Table of Contents

- [Quick Start](#quick-start)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Local Development](#local-development)
- [Data Sources](#data-sources)
- [Architecture](#architecture)

---

## Quick Start

Get running in 5 minutes for local testing.

### Prerequisites

```powershell
# Install Python 3.11
winget install Python.Python.3.11

# Install Azure Functions Core Tools
winget install Microsoft.Azure.FunctionsCoreTools
```

### Local Setup

```powershell
# Navigate to API folder
cd api

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Test without Azure (validates setup)
python test_local.py

# Start function locally
func start
```

### Test Health Endpoint

```powershell
Invoke-RestMethod http://localhost:7071/api/health
```

---

## Deployment

### Azure Deployment (5 Minutes)

Deploy all resources with a single command:

**PowerShell:**
```powershell
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID"

# For Azure Government
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID" -Cloud AzureUSGovernment
```

**Bash:**
```bash
./deploy.sh --workspace-id "YOUR-WORKSPACE-ID"

# For Azure Government
./deploy.sh --workspace-id "YOUR-WORKSPACE-ID" --cloud AzureUSGovernment
```

**Requirements:**
- Azure CLI installed and logged in
- Owner or Contributor role on subscription or resource group
- Microsoft Sentinel workspace ID

### What Gets Created

The deployment script creates:

1. **Resource Group** (if needed)
2. **Storage Account** with containers:
   - `datasets` - TSV and GeoJSON data files
   - `watermarks` - Query checkpoint tracking
   - `locks` - Multi-user coordination
3. **Function App** with:
   - System-assigned managed identity
   - Application Insights monitoring
   - Auto-deployment from GitHub
4. **Role Assignments**:
   - Storage Blob Data Contributor (Function → Storage)
   - Log Analytics Reader (Function → Sentinel)
5. **Static Web App** for frontend (separate workflow)

### Post-Deployment

1. **Verify Deployment**:
   ```powershell
   # Get function URL
   $functionUrl = az functionapp show --name YOUR-FUNCTION-APP --resource-group YOUR-RG --query defaultHostName -o tsv
   
   # Test health endpoint
   Invoke-RestMethod "https://$functionUrl/api/health"
   ```

2. **Configure Demo Mode** (Optional):
   ```powershell
   # Upload demo data to blob storage
   az storage blob upload-batch --source demo_data --destination datasets/demo_data --account-name YOUR-STORAGE
   ```

3. **Configure Custom Data Sources**:
   - Edit `api/sources.yaml` to add your KQL queries
   - Push changes to trigger GitHub Actions deployment

---

## Configuration

### Sources Configuration (`api/sources.yaml`)

Define data sources using YAML:

```yaml
sources:
  - id: signin-activity
    name: Sign-In Activity
    query: |
      SigninLogs
      | where TimeGenerated > ago(90d)
      | project TimeGenerated, UserPrincipalName, IPAddress, Location, ResultType
    timespan_days: 90
    refresh_policy:
      type: time-based
      interval_hours: 24
```

**Supported Refresh Policies:**
- `time-based` - Refresh every X hours
- `watermark` - Incremental queries tracking last timestamp
- `file-age` - Refresh when file is older than X hours

### Adding Custom Data Sources

1. Edit `api/sources.yaml`:
   ```yaml
   - id: my-custom-source
     name: My Custom Data
     query: |
       YourTable
       | where TimeGenerated > ago(30d)
       | project columns...
     timespan_days: 30
     refresh_policy:
       type: watermark
   ```

2. Add geo-enrichment configuration in `api/shared/geo_enrichment.py`

3. Push to GitHub - deployment happens automatically

### Demo Mode

Demo mode uses pre-generated datasets from blob storage:

**Enable Demo Mode:**
- Add `?demo=true` to URL
- Uses public threat intel datasets
- Loads 500 sign-ins and 500 device locations
- No Azure credentials required

**Demo Data Sources:**
- `datasets/demo_data/signin-activity.geojson`
- `datasets/demo_data/device-locations.geojson`
- `datasets/public/` - Public threat intel feeds

---

## Local Development

### Environment Setup

Create `api/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "LOG_ANALYTICS_WORKSPACE_ID": "your-workspace-id",
    "STORAGE_ACCOUNT_URL": "https://yourstorage.blob.core.windows.net",
    "MAXMIND_LICENSE_KEY": "your-maxmind-key",
    "ENABLE_DEMO_MODE": "true"
  }
}
```

### Running Locally

```powershell
cd api
func start

# In another terminal, test endpoints
Invoke-RestMethod http://localhost:7071/api/health
Invoke-RestMethod "http://localhost:7071/api/refresh?source_id=signin-activity&force=true"
```

### Testing

```powershell
# Run unit tests
cd tests
python test_direct_api.py

# Test geo-enrichment
python test_geo_debug.py
```

### MaxMind GeoIP Setup

For accurate geo-enrichment:

1. Create free account at [MaxMind.com](https://www.maxmind.com/en/geolite2/signup)
2. Generate license key
3. Add to `local.settings.json` or App Settings
4. Download GeoLite2-City.mmdb to `api/GeoLite2-City.mmdb`

---

## Data Sources

### Built-In Sources

The application comes with these pre-configured data sources:

#### 1. Sign-In Activity
- **Table**: `SigninLogs`
- **Fields**: UserPrincipalName, IPAddress, Location, Result, Device info
- **Refresh**: Every 24 hours
- **Use Case**: Track user authentication patterns and anomalies

#### 2. Threat Intelligence
- **Table**: `ThreatIntelligenceIndicator`
- **Fields**: ObservableValue, ThreatType, Confidence, Source
- **Refresh**: Every 6 hours
- **Use Case**: Correlate IPs with known threats

### Custom KQL Queries

**Requirements for Custom Queries:**
1. Must include `TimeGenerated` for watermark tracking
2. Must include geo fields OR IP address for mapping:
   - `Latitude` and `Longitude`, OR
   - `IPAddress` for automatic geo-enrichment
3. Should include relevant context fields for popups

**Example Custom Source:**

```yaml
- id: mde-devices
  name: MDE Device Locations
  query: |
    DeviceInfo
    | where TimeGenerated > ago(7d)
    | summarize arg_max(TimeGenerated, *) by DeviceId
    | where isnotempty(PublicIP)
    | project TimeGenerated, DeviceId, DeviceName, OSPlatform, 
              PublicIP, MachineGroup, IsAzureADJoined
  timespan_days: 7
  refresh_policy:
    type: watermark
    checkpoint_field: TimeGenerated
```

### Data Flow

1. **Query** - Function queries Log Analytics via KQL
2. **Geo-Enrich** - Adds coordinates for IP addresses
3. **Transform** - Converts to GeoJSON format
4. **Store** - Saves to blob storage as TSV and GeoJSON
5. **Serve** - Frontend fetches via `/api/data/{source_id}`

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                  Azure Static Web App                    │
│                    (Frontend: Leaflet)                   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ HTTPS
                        │
┌───────────────────────▼─────────────────────────────────┐
│              Azure Function App (Python)                 │
│                                                           │
│  /api/health      - Health check                         │
│  /api/refresh     - Trigger data refresh                 │
│  /api/data/{id}   - Serve GeoJSON to frontend           │
│                                                           │
│  Managed Identity Authentication                         │
└───────┬───────────────────────────────┬─────────────────┘
        │                               │
        │ Azure SDK                     │ Azure SDK
        │                               │
┌───────▼────────────────┐    ┌─────────▼─────────────────┐
│  Log Analytics         │    │  Blob Storage             │
│  (Sentinel)            │    │                           │
│                        │    │  /datasets/*.tsv          │
│  KQL Queries           │    │  /datasets/*.geojson      │
│  SigninLogs            │    │  /watermarks/*.json       │
│  ThreatIntel           │    │  /locks/*.lock            │
└────────────────────────┘    └───────────────────────────┘
```

### Key Features

**Security:**
- Managed Identity (no secrets in code)
- RBAC-based access control
- CORS configured for Static Web App only

**Scalability:**
- Blob-based locking prevents concurrent refreshes
- Watermark tracking enables incremental queries
- Time-based throttling prevents excessive queries

**Monitoring:**
- Application Insights integration
- Structured logging with context
- Health check endpoint

**Extensibility:**
- YAML-based configuration (no code changes)
- Pluggable refresh policies
- Custom geo-enrichment logic

### Authentication Flow

1. Function uses **System-Assigned Managed Identity**
2. Azure automatically provides token for:
   - Log Analytics API access
   - Blob Storage operations
3. No secrets, keys, or connection strings in code
4. Role assignments configured during deployment

### Data Refresh Logic

```
┌──────────────────┐
│  HTTP Trigger    │
│  /api/refresh    │
└────────┬─────────┘
         │
         ▼
┌────────────────────┐      ┌──────────────┐
│  Check Lock        │─No──▶│ Acquire Lock │
└────────┬───────────┘      └──────┬───────┘
         │ Locked                   │
         ▼                          ▼
    Return 429         ┌────────────────────┐
    (Too Many          │ Check Refresh      │
     Requests)         │ Policy             │
                       └────────┬───────────┘
                                │
                                ▼
                       ┌────────────────────┐
                       │ Query Log          │
                       │ Analytics          │
                       └────────┬───────────┘
                                │
                                ▼
                       ┌────────────────────┐
                       │ Geo-Enrich         │
                       │ (if needed)        │
                       └────────┬───────────┘
                                │
                                ▼
                       ┌────────────────────┐
                       │ Write to Blob      │
                       │ (TSV + GeoJSON)    │
                       └────────┬───────────┘
                                │
                                ▼
                       ┌────────────────────┐
                       │ Update Watermark   │
                       └────────┬───────────┘
                                │
                                ▼
                       ┌────────────────────┐
                       │ Release Lock       │
                       └────────────────────┘
```

---

## Troubleshooting

### Common Issues

**404 Errors After Deployment:**
- Wait 30-60 seconds for function cold start
- Check Function App logs in Azure Portal

**No Data Showing on Map:**
- Verify blob storage has data files: `datasets/*.geojson`
- Check browser console for fetch errors
- Test API endpoint directly: `https://your-function.azurewebsites.net/api/data/signin-activity`

**Geo-Enrichment Not Working:**
- Verify MaxMind license key is configured
- Check `GeoLite2-City.mmdb` exists in function app
- Review Application Insights logs for errors

**Query Timeouts:**
- Reduce `timespan_days` in source configuration
- Add filters to KQL query to reduce result size
- Consider increasing function timeout in `host.json`

### Logs and Monitoring

**View Function Logs:**
```powershell
az monitor app-insights query --app YOUR-INSIGHTS --analytics-query "
traces
| where timestamp > ago(1h)
| project timestamp, message, severityLevel
| order by timestamp desc
"
```

**Check Blob Storage:**
```powershell
az storage blob list --account-name YOUR-STORAGE --container-name datasets --output table
```

---

## Full Redeploy Testing

To test complete infrastructure deployment:

### Cleanup Existing Resources

```powershell
# Delete resource group (WARNING: Deletes ALL resources)
az group delete --name YOUR-RESOURCE-GROUP --yes --no-wait
```

### Fresh Deployment

```powershell
# Deploy from scratch
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID"
```

### Verification Checklist

- [ ] Function App created and running
- [ ] Storage Account with 3 containers (datasets, watermarks, locks)
- [ ] Static Web App deployed
- [ ] Managed Identity role assignments configured
- [ ] GitHub Actions deployment pipeline working
- [ ] Health endpoint returns 200 OK
- [ ] Data refresh succeeds
- [ ] Map displays data correctly
- [ ] Demo mode works with `?demo=true`

---

## Additional Resources

- **Main README**: [../README.md](../README.md)
- **Frontend README**: [../web/README.md](../web/README.md)
- **GitHub Repository**: [AndrewBlumhardt/sentinel-activity-maps](https://github.com/AndrewBlumhardt/sentinel-activity-maps)
- **Azure Functions Docs**: [docs.microsoft.com/azure-functions](https://docs.microsoft.com/azure/azure-functions/)
- **Azure Maps SDK**: [docs.microsoft.com/azure/azure-maps](https://docs.microsoft.com/azure/azure-maps/)
