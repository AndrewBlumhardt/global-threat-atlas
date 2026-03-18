# Global Threat Intelligence Atlas

<img src="images/screenshot-global-threat-map.png" alt="Global Threat Activity Map" width="600"/>

**[Try the Live Demo](https://jolly-cliff-0f92c201e.2.azurestaticapps.net/)**

An Azure-hosted interactive map for SOC and threat intelligence teams. Displays geo-enriched security data from Microsoft Sentinel on a global Azure Maps canvas. Designed for wall displays and analyst dashboards.

**Layers:**
- Sign-in activity (success and failure events from Azure AD)
- Device locations (last-known public IP from Microsoft Defender for Endpoint)
- Threat intelligence indicators (active IP IOCs from Sentinel ThreatIntelIndicators)
- Threat actor heatmap (country-level attribution from a static TSV)
- Custom GeoJSON overlay (user-supplied or hosted in blob storage)
- Weather radar and infrared (Azure Maps weather tiles)
- Day/night terminator overlay
- Cyber News Feed (auto-scrolling headlines from public security RSS feeds)

**Other features:** IP lookup with MaxMind geolocation, VirusTotal links, drag-and-drop GeoJSON, screenshot capture, auto-scroll, demo mode with synthetic data.

---

## Operating Instructions

- **Load the map** to begin. There may be a short delay on first load while the Function App cold-starts.
- **Demo layers** are available immediately without a Sentinel connection. Enable Demo Mode to load synthetic sample data.
- **Data layers** (sign-in activity, devices, threat intel) will appear greyed out if the data source is not yet available. This typically means the refresh pipeline has not run yet, or the required app settings are not configured.
- **Threat actor map** uses a static TSV file in blob storage. It can be updated manually in Excel. Country attribution may be incomplete and actors without a country are not displayed.
- **Threat intel, sign-in, and device data** come from Sentinel. IP coordinates are enriched with MaxMind geolocation. Country-level accuracy is generally reliable; precision decreases at city level. Routing, VPNs, and proxies affect accuracy.
- **IP Lookup** accepts any public IP address and places a pin using MaxMind. The "Find My IP" button detects and plots your current IP.
- **VirusTotal links** appear on IP-bearing markers in the details panel.
- **Custom GeoJSON** can be dragged and dropped onto the map for temporary display, or hosted in blob storage for a persistent overlay.
- **Screenshot** and **auto-scroll** controls are available in the toolbar.
- This atlas is intended for pattern research and SOC wallboard displays. It does not provide the real-time fidelity needed for active incident response.

---

## How the App Works

<img src="images/atlas-design.png" alt="Application architecture diagram" width="700"/>

Here is a walkthrough of what happens from the moment a browser opens the app to data appearing on the map.

### 1. Page load and static fallbacks

The SWA serves [web/index.html](web/index.html) and all supporting files. The `<head>` includes DNS prefetch and preconnect hints to `atlas.microsoft.com` so the browser's TLS handshake to the Azure Maps CDN is already underway before any JavaScript runs.

Before any application code runs, [web/config.js](web/config.js) is loaded synchronously and sets `window.STORAGE_ACCOUNT_URL` and `window.DATASETS_CONTAINER` as hard-coded fallback values used only if the API later fails to respond. The Azure Maps subscription key is intentionally absent here and never stored in any static file. Immediately after, an inline script fires `fetch('/api/config')` and stores the returned promise so the request is already in-flight before the ES module bundle starts executing.

### 2. App startup and config fetch

[web/src/app.js](web/src/app.js) runs `main()` as soon as the module loads. Its first action is a fire-and-forget call to `/api/refresh`, which kicks off the backend data pipeline without blocking the map. The app then picks up the in-flight config promise. If the Function App has not responded within five seconds (typical on a cold start), the loading spinner updates to "Waiting for API (cold start, please wait...)".

The `/api/config` endpoint ([api/config/\_\_init\_\_.py](api/config/__init__.py)) reads the Azure Maps key, storage URL, container name, and custom layer display name from the Function App's environment and returns them as JSON. The response carries `Cache-Control: no-cache` so the browser never reuses a stale key.

### 3. Map initialisation

Once config resolves, [web/src/map/map-init.js](web/src/map/map-init.js) creates the Atlas map control using the subscription key received from the API. The key authenticates all tile requests to the Azure Maps CDN for base road tiles, weather overlays, and other Atlas-hosted content. When the map fires its `ready` event the loading overlay is dismissed and all layer controls, UI components, and event handlers are wired up.

### 4. Data refresh pipeline

The `/api/refresh` call started in step 2 runs in parallel. [api/refresh/\_\_init\_\_.py](api/refresh/__init__.py) manages three independent pipelines for MDE devices, sign-in activity, and threat intel indicators.

For each pipeline the function does a lightweight HEAD against the corresponding `.tsv` blob and compares its age to the pipeline's frequency threshold (default 24 hours for all three). Fresh pipelines are skipped immediately. For stale ones:

- A `refresh.lock` blob is written to prevent concurrent runs if multiple sessions open at the same time.
- The GeoLite2-City MaxMind database is checked at `/tmp/`. If absent or older than 7 days it is downloaded from MaxMind using `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY`, extracted in memory, and written to the local filesystem. All three pipelines share one open reader for the duration of the call.
- Each pipeline runs KQL against the Sentinel Log Analytics workspace using a Managed Identity token.
- For MDE devices and threat intel, every unique public IP is resolved against the local GeoLite2 binary database (no network, microseconds per lookup). For sign-in activity, Azure AD already provides coordinates for most events and MaxMind is only called for IPs where those fields are empty.
- Each pipeline uploads enriched data to Blob Storage as TSV first, then as a GeoJSON FeatureCollection. All writes use a Managed Identity token. Payloads over 4 MB use block staging.
- The lock blob is deleted when all pipelines complete.

### 5. Layer availability probing and data access

After the map is ready, the app runs parallel HEAD requests for each data layer blob to decide which toggles to enable or grey out.

Those requests go through `resolveDataUrl()` in [web/src/shared/demoMode.js](web/src/shared/demoMode.js), which on its first call fires a single anonymous HEAD probe against the blob container to decide how to route all subsequent data reads:

- **If the storage account has anonymous blob access enabled**, data URLs resolve to direct `https://<account>.blob.core.windows.net/...` addresses and layers load without touching the Function App at all. This is suitable for demo and development environments.
- **If anonymous access is disabled** (default for production), all data requests route through `/api/data/<filename>` and are handled by [api/data/\_\_init\_\_.py](api/data/__init__.py), which fetches the blob using a Managed Identity token and proxies the bytes to the browser.

When the user enables a layer the overlay module fetches the corresponding GeoJSON:

- **Threat actors** ([threatActorsHeatmap.js](web/src/overlays/threatActorsHeatmap.js)): reads a static `threat-actors.tsv`, counts entries per country, and renders a weighted Atlas HeatMapLayer. Country boundary polygons for the click-to-select mode are fetched once from a public CDN and cached at module level.
- **Threat intel** ([threatIntelOverlay.js](web/src/overlays/threatIntelOverlay.js)): reads `threat-intel-indicators.geojson` and renders an Atlas BubbleLayer.
- **Sign-in activity** ([signInActivityOverlay.js](web/src/overlays/signInActivityOverlay.js)): reads `signin-activity.geojson` and renders HTML marker pins coloured by success or failure.
- **Device locations** ([deviceLocationsOverlay.js](web/src/overlays/deviceLocationsOverlay.js)): reads `mde-devices.geojson` and renders HTML marker pins coloured by device type.
- **Weather and day/night overlays**: purely Atlas SDK layers with no blob reads, authenticated by the Maps key already in the map instance.

Marker and bubble sizes across all data overlays are controlled by [web/src/shared/markerConfig.js](web/src/shared/markerConfig.js).

### Demo mode

Enabling the **Demo Mode** toggle switches all data layers to read from a `demo_data/` prefix in blob storage. These files contain pre-generated synthetic data (produced by the scripts in `tests/`) and require no Sentinel connection, no MaxMind license, and no live refresh pipeline. Live and demo data never mix.

### 6. Session keepalive

A `setInterval` in `app.js` pings `/api/health` every 14 minutes while the tab is visible. The health endpoint ([api/health/\_\_init\_\_.py](api/health/__init__.py)) responds with configuration presence flags and the current age of each GeoJSON blob. On the Consumption plan this reduces cold-start frequency during active sessions.

---

## Azure Costs

**Required Azure resources:**
- Azure Static Web App (Standard tier, required for linked Function App backend)
- Azure Function App (Consumption plan)
- Azure Maps Account (Gen2 pay-as-you-go; paid tier required for weather tiles)
- Azure Storage Account

**Typical monthly cost:** $10-20 USD for demo or small production environments.

**MaxMind:** IP geolocation uses a free GeoLite2 license. Business or commercial users must obtain a paid license. See [MaxMind licensing](https://www.maxmind.com).

### Function App: Consumption Plan

The Function App bills only when functions execute:

| Meter | Free grant | Paid rate |
|---|---|---|
| Execution time | 400,000 GB-s / month | $0.000016 / GB-s |
| Executions | 1,000,000 / month | $0.20 / million |

The free grant is per Azure subscription per month, shared across all function apps in that subscription. Each invocation in this app runs roughly 200 ms at 128-256 MB, which is approximately 0.03-0.05 GB-s per call. Normal usage is well within the free tier.

Blob storage reads for map layers can bypass the Function entirely if the storage container is configured for anonymous blob access, reducing invocations to near zero for those requests.

### Capping Spend

For public demo deployments, set a hard daily ceiling in the Azure Portal:

**Function App > Configuration > Function runtime settings > Daily Usage Quota (GB-s)**

When reached, the function app stops for the rest of the UTC day and resumes at midnight.

| Scenario | Suggested quota |
|---|---|
| Only app in subscription | 12,000 GB-s |
| Shared subscription | 2,000-4,000 GB-s |
| Public demo, abuse protection | 500-1,000 GB-s |

---

## Security

### Static Web App (Public Frontend)

The Azure Static Web App frontend is intentionally public; no login is required to view the map. Access control rules in [web/staticwebapp.config.json](web/staticwebapp.config.json) route all `/api/*` requests through the SWA's managed reverse proxy rather than exposing the Function App URL directly. Browsers never know the Function App's hostname, preventing direct bypass of the proxy.

For production deployments, consider these additional controls available from the SWA portal or `staticwebapp.config.json`:
- **IP allow-listing:** restrict the app to your corporate IP ranges if it is for internal SOC use only
- **Password protection:** SWA supports a simple site-wide password (Standard tier) as a lightweight gating mechanism without requiring Azure AD
- **Azure AD authentication:** SWA can front the entire app with Entra ID authentication, requiring users to sign in before the map loads

None of these are required for a demo deployment with synthetic data. They matter as soon as the map displays real Sentinel data.

### Function App API Endpoints

All API routes are anonymous HTTP triggers; there is no API key or bearer token on any `/api/*` call. This is intentional: the Function App's only callers are the SWA proxy and the browser session it is serving. The SWA proxy is the access control boundary.

For environments where additional hardening is warranted:
- **CORS restriction:** restrict allowed origins to the SWA hostname in the Function App's CORS settings so the endpoints reject direct browser calls from other origins
- **Inbound network restriction:** use the Function App's access restriction rules to allow only the SWA's outbound IP range, blocking all other callers
- **Azure AD authentication:** enable Easy Auth on the Function App and require a valid Entra ID token; SWA can be configured to pass through the user's token automatically

### Blob Storage

Two settings that are often conflated:

**Network Access** controls whether storage is reachable from the internet at all. Leaving it enabled (the default) keeps the endpoint publicly routable but authentication still controls what can be read. Disabling it requires a private endpoint (~$7-10/month) and is only warranted for high-security production environments.

**Authentication** controls who can read blobs:

| Option | How it works | Suitable for |
|---|---|---|
| **Anonymous** | URL is sufficient; no credentials needed | Demo / dev / test only |
| **Managed Identity via Function App** | Blob reads proxy through the Function App, which authenticates with its own Managed Identity | Production |
| **Private endpoint** | Disables public network access entirely | High-security production |

> This application may display real threat intelligence, sign-in activity, and device location data from Microsoft Sentinel. Anonymous blob access exposes that data to anyone who knows or guesses the storage URL. Do not use anonymous access outside of demo or test environments populated with synthetic data.

**Recommended by environment:**
- **Demo / dev / test:** anonymous access enabled, public network access enabled
- **Production:** anonymous access disabled, reads proxied through the Function App with Managed Identity
- **High-security production:** anonymous access disabled, private endpoint added

### Key Management and Why Key Vault Was Not Used

The Azure Maps subscription key is never stored in static files or source control. It is read at runtime by `/api/config` from the Function App's app settings and served to the browser only for the current session. All Sentinel queries and blob reads use Managed Identity tokens; no connection strings or SAS tokens are required.

Azure Key Vault was deliberately excluded to keep deployment complexity and cost minimal while still meeting reasonable security requirements:

| | App Settings (current) | Key Vault |
|---|---|---|
| **Extra Azure resource** | No | Yes (~$0.03/10,000 ops) |
| **Deployment complexity** | Script sets values directly | Must create vault, assign access policy, use Key Vault reference syntax |
| **Managed Identity required** | Already required for blob/Sentinel access | Same; vault access also uses Managed Identity |
| **Secret rotation** | Requires manual update or redeployment | Can rotate without touching app settings |
| **Audit trail** | Function App logs only | Key Vault logs every secret read |
| **Credential visibility** | App settings visible to anyone with Contributor on the Function App | Secret values never leave the vault |

For this application, the only secret that would meaningfully benefit from Key Vault is the Azure Maps subscription key. MaxMind credentials are lower sensitivity, and all other access uses Managed Identity with no stored secrets at all. At the current scale and threat model, the additional vault resource and deployment steps are not justified.

**To add Key Vault** if your environment requires it:
1. Create a Key Vault in the same resource group.
2. Assign the Function App's Managed Identity the **Key Vault Secrets User** role on the vault.
3. Add the Maps key as a secret:
   ```bash
   az keyvault secret set --vault-name <vault> --name AzureMapsKey --value <key>
   ```
4. Replace the `AZURE_MAPS_SUBSCRIPTION_KEY` app setting value with a Key Vault reference:
   ```
   @Microsoft.KeyVault(VaultName=<vault>;SecretName=AzureMapsKey)
   ```
The Function App resolves the reference transparently at runtime with no code changes required.

---

## Deployment

Deploy the entire application to Azure in approximately five minutes.

**Requirements:**
- Azure CLI installed and authenticated (`az login`)
- Owner or Contributor role on the target subscription or resource group
- Microsoft Sentinel workspace with data
- GitHub CLI (`gh`) for automatic GitHub Actions secret configuration (recommended)

**PowerShell (Windows):**
```powershell
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID"

# Azure Government (GCC / GCC-High)
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID" -Cloud AzureUSGovernment
```

**Bash (Linux / macOS):**
```bash
./deploy.sh --workspace-id "YOUR-WORKSPACE-ID"

# Azure Government (GCC / GCC-High)
./deploy.sh --workspace-id "YOUR-WORKSPACE-ID" --cloud AzureUSGovernment
```

**What the script creates:**
- Azure Function App (Python 3.11, Consumption plan) with Managed Identity
- Azure Static Web App (Standard tier) linked to the Function App backend
- Storage Account with a `datasets` container
- Azure Maps Account (Gen2)
- RBAC role assignments (Log Analytics Reader, Storage Blob Data Contributor)
- GitHub Actions secrets for CI/CD (requires `gh` CLI)

---

## Post-Deployment

### Required manual step

After deployment, set the MaxMind license key. This is the only credential the script cannot obtain automatically:

```powershell
az functionapp config appsettings set `
  --name <FUNCTION-APP-NAME> `
  --resource-group <RESOURCE-GROUP> `
  --settings MAXMIND_ACCOUNT_ID="<your-account-id>" MAXMIND_LICENSE_KEY="<your-license-key>"
```

Free credentials are available at [maxmind.com/en/geolite2/signup](https://www.maxmind.com/en/geolite2/signup).

### Verify deployment

```powershell
# Check API health and blob data freshness
curl https://<FUNCTION-APP>.azurewebsites.net/api/health

# Trigger the first data refresh manually
curl https://<FUNCTION-APP>.azurewebsites.net/api/refresh
```

### Function App settings reference

All settings are configured automatically by the deploy script except `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY`.

| Setting | Description | Default |
|---|---|---|
| `AZURE_MAPS_SUBSCRIPTION_KEY` | Azure Maps key for tile authentication | Auto-set |
| `STORAGE_ACCOUNT_URL` | Blob storage base URL | Auto-set |
| `STORAGE_CONTAINER_DATASETS` | Container holding data files | `datasets` |
| `SENTINEL_WORKSPACE_ID` | Log Analytics workspace GUID | Required |
| `MAXMIND_ACCOUNT_ID` | MaxMind account ID | Manual |
| `MAXMIND_LICENSE_KEY` | MaxMind GeoLite2 license key | Manual |
| `REFRESH_DEVICE_FREQUENCY_MINUTES` | MDE device refresh interval | `1440` (24 h) |
| `REFRESH_DEVICE_LOOKBACK_HOURS` | MDE device query lookback | `168` (7 days) |
| `REFRESH_SIGNIN_FREQUENCY_MINUTES` | Sign-in refresh interval | `1440` (24 h) |
| `REFRESH_SIGNIN_LOOKBACK_HOURS` | Sign-in query lookback | `168` (7 days) |
| `REFRESH_THREATINTEL_FREQUENCY_HOURS` | Threat intel refresh interval | `24` |
| `SENTINEL_DEVICES_KQL` | Override default MDE KQL query | Built-in |
| `SENTINEL_SIGNIN_KQL` | Override default sign-in KQL query | Built-in |
| `SENTINEL_THREATINTEL_KQL` | Override default threat intel KQL query | Built-in |
| `CUSTOM_LAYER_DISPLAY_NAME` | Display name for the custom GeoJSON layer | `Custom Source` |
| `REFRESH_MAX_ROWS` | Row cap for KQL query results | `1000000` |

### CI/CD

The Function App deploys automatically on push to `api/**` via `.github/workflows/main_func-sentinel-activity-maps.yml`. The SWA deploys automatically on push to `web/**` via the SWA-generated workflow. Both workflows are configured during deployment.

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/config` | GET | Returns Azure Maps key, storage URL, and display settings to the browser |
| `/api/data/{filename}` | GET, HEAD | Proxies a blob file from storage to the browser with Managed Identity auth |
| `/api/enrich_geo` | GET, POST | Batch IP geo-enrichment via MaxMind; accepts a JSON array of IPs |
| `/api/generate_geojson` | GET, POST | Converts an enriched TSV blob to GeoJSON and uploads it back to storage |
| `/api/health` | GET | Returns API status, configuration presence, and blob data freshness |
| `/api/lookup-ip` | GET | Resolves a single IP address to geo coordinates via MaxMind |
| `/api/news` | GET | Returns up to 5 recent headlines from public security RSS feeds |
| `/api/refresh` | GET, POST | Runs the Sentinel KQL → MaxMind → GeoJSON pipeline for stale datasets |

See [api/README.md](api/README.md) for full parameter and response details.

---

## Troubleshooting

**Map does not load / blank page**
- Open browser developer tools (F12) and check the console for errors.
- Call `/api/config` directly and confirm `azureMapsKey` is present and non-empty.
- Verify `AZURE_MAPS_SUBSCRIPTION_KEY` is set in Function App app settings.
- Wait 30-60 seconds after first deployment for the Function App cold start.

**Layers are greyed out**
- Data has not been refreshed yet. Call `/api/refresh` manually.
- Check `/api/health` to see blob freshness and whether all required settings are configured.
- Confirm `SENTINEL_WORKSPACE_ID`, `MAXMIND_ACCOUNT_ID`, and `MAXMIND_LICENSE_KEY` are set.

**No data on the map after refresh**
- Confirm the Managed Identity has **Log Analytics Reader** on the Sentinel workspace and **Storage Blob Data Contributor** on the storage account.
- Call `/api/refresh?check=true` to see pipeline freshness without triggering a run.
- Call `/api/refresh?force=true` to bypass the freshness check and force all pipelines.
- Check Function App logs for KQL or MaxMind errors.

**401 / 403 errors**
- Verify Managed Identity is enabled on the Function App.
- Check RBAC role assignments in the Azure Portal.

**IP lookup returns no result**
- Confirm `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY` are set.
- Private, reserved, and some cloud-provider IPs are excluded by design.

**Data is stale**
- Each pipeline refreshes at most once per 24 hours by default. Call `/api/refresh?force=true` to refresh immediately.
- Adjust frequency with `REFRESH_DEVICE_FREQUENCY_MINUTES`, `REFRESH_SIGNIN_FREQUENCY_MINUTES`, or `REFRESH_THREATINTEL_FREQUENCY_HOURS`.
