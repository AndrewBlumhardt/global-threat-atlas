# Global Threat Intelligence Atlas

<img src="https://raw.githubusercontent.com/AndrewBlumhardt/global-threat-atlas/main/images/screenshot-global-threat-map.png" alt="Global Threat Activity Map" width="600"/>

[Live Demo](https://jolly-cliff-0f92c201e.2.azurestaticapps.net/)

An Azure-hosted interactive map for SOC and threat intelligence teams. Displays geo-enriched security data from Microsoft Sentinel on a global Azure Maps canvas. Designed for wall displays and analyst dashboards.

**Layers:**
- Sign-in activity (success and failure events from Microsoft Entra ID)
- Device locations (last-known public IP from Microsoft Defender for Endpoint)
- Threat intelligence indicators (active IP IOCs from Sentinel ThreatIntelIndicators)
- Threat actor heatmap (country-level attribution from a static TSV)
- Custom GeoJSON overlay (user-supplied or hosted in blob storage)
- Cyber News Feed (live cybersecurity headlines from public RSS feeds)
- Weather radar and infrared (Azure Maps weather tiles)
- Day/night terminator overlay

**Other features:** IP lookup with MaxMind geolocation, VirusTotal links, drag-and-drop GeoJSON, screenshot capture, auto-scroll, demo mode with synthetic data.

---

- [Operating Instructions](#operating-instructions)
- [How the App Works](#how-the-app-works)
- [Azure Costs](#azure-costs)
- [Security](#security)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Acknowledgements](#acknowledgements)
- [About the Developer](#about-the-developer)

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

<img src="https://raw.githubusercontent.com/AndrewBlumhardt/global-threat-atlas/main/images/atlas-design.png" alt="Application architecture diagram" width="700"/>

Here is a walkthrough of what happens from the moment a browser opens the app to data appearing on the map.

### 1. Page load and static fallbacks

The SWA serves [web/index.html](web/index.html) and all supporting files. The `<head>` includes DNS prefetch and preconnect hints to `atlas.microsoft.com` so the browser's TLS handshake to the Azure Maps CDN is already underway before any JavaScript runs.

Before any application code runs, [web/config.js](web/config.js) is loaded synchronously and sets `window.STORAGE_ACCOUNT_URL` and `window.DATASETS_CONTAINER` as hard-coded fallback values used only if the API later fails to respond. The Azure Maps subscription key is intentionally absent here and never stored in any static file. Immediately after, an inline script fires `fetch('/api/config')` and stores the returned promise so the request is already in-flight before the ES module bundle starts executing.

### 2. App startup and config fetch

[web/src/app.js](web/src/app.js) runs `main()` as soon as the module loads. Its first action is a fire-and-forget call to `/api/refresh`, which kicks off the backend data pipeline without blocking the map. The app then picks up the in-flight config promise. If the Function App has not responded within five seconds (typical on a cold start), the loading spinner updates to "Waiting for API (cold start, please wait...)".

The `/api/config` endpoint ([api/config/\_\_init\_\_.py](api/config/__init__.py)) reads the Azure Maps key, storage URL, container name, and custom layer display name from the Function App's environment and returns them as JSON. The response carries `Cache-Control: no-cache` so the browser never reuses a stale key.

### 3. Map initialization

Once config resolves, [web/src/map/map-init.js](web/src/map/map-init.js) creates the Atlas map control using the subscription key received from the API. The key authenticates all tile requests to the Azure Maps CDN for base road tiles, weather overlays, and other Atlas-hosted content. When the map fires its `ready` event the loading overlay is dismissed and all layer controls, UI components, and event handlers are wired up.

### 4. Data refresh pipeline

The `/api/refresh` call started in step 2 runs in parallel. [api/refresh/\_\_init\_\_.py](api/refresh/__init__.py) manages three independent pipelines for MDE devices, sign-in activity, and threat intel indicators.

For each pipeline the function does a lightweight HEAD against the corresponding `.tsv` blob and compares its age to the pipeline's frequency threshold (default 24 hours for all three). Fresh pipelines are skipped immediately. For stale ones:

- A `refresh.lock` blob is written to prevent concurrent runs if multiple sessions open at the same time.
- The GeoLite2-City MaxMind database is checked at `/tmp/`. If absent or older than 7 days it is downloaded from MaxMind using `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY`, extracted in memory, and written to the local filesystem. All three pipelines share one open reader for the duration of the call.
- Each pipeline runs KQL against the Sentinel Log Analytics workspace using a Managed Identity token.
- For MDE devices and threat intel, every unique public IP is resolved against the local GeoLite2 binary database (no network, microseconds per lookup). For sign-in activity, Microsoft Entra ID already provides coordinates for most events and MaxMind is only called for IPs where those fields are empty.
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
- Azure Static Web App (Standard tier - required for linked Function App backend)
- Azure Function App (Consumption plan)
- Azure Maps Account (Gen2 pay-as-you-go; paid tier required for weather tiles)
- Azure Storage Account

**Typical monthly cost:** $10-20 USD for demo or small production environments.

**MaxMind:** IP geolocation uses a free GeoLite2 license. Business or commercial users must obtain a paid license - see [MaxMind licensing](https://www.maxmind.com). See also the [Acknowledgements](#acknowledgements) section below.

### Function App - Consumption Plan

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
- **Password protection:** SWA supports a simple site-wide password (Standard tier) as a lightweight gating mechanism without requiring Microsoft Entra ID
- **Microsoft Entra ID authentication:** SWA can front the entire app with Entra ID authentication, requiring users to sign in before the map loads

None of these are required for a demo deployment with synthetic data. They matter as soon as the map displays real Sentinel data.

### Function App API Endpoints

All API routes are anonymous HTTP triggers; there is no API key or bearer token on any `/api/*` call. This is intentional: the Function App's only callers are the SWA proxy and the browser session it is serving. The SWA proxy is the access control boundary.

For environments where additional hardening is warranted:
- **CORS restriction:** restrict allowed origins to the SWA hostname in the Function App's CORS settings so the endpoints reject direct browser calls from other origins
- **Inbound network restriction:** use the Function App's access restriction rules to allow only the SWA's outbound IP range, blocking all other callers
- **Microsoft Entra ID authentication:** enable Easy Auth on the Function App and require a valid Entra ID token; SWA can be configured to pass through the user's token automatically

### Blob Storage Access

Two settings that are often conflated:

**Network Access** controls whether storage is reachable from the internet at all. Leaving it enabled (the default) keeps the endpoint publicly routable but authentication still controls what can be read. Disabling it requires a private endpoint (~$7-10/month) and is only warranted for high-security production environments.

**Authentication** controls who can read blobs:

| Option | How it works | Suitable for |
|---|---|---|
| **Anonymous** | URL is sufficient - no credentials | Demo / dev / test only |
| **Managed Identity via Function App** | Blob reads proxy through the Function App, which authenticates with its own Managed Identity | Production |
| **Private endpoint** | Disables public network access entirely | High-security production |

> This application may display real threat intelligence, sign-in activity, and device location data from Microsoft Sentinel. Anonymous blob access exposes that data to anyone who knows or guesses the storage URL. Do not use anonymous access outside of demo or test environments populated with synthetic data.

**Recommended by environment:**
- **Demo / dev / test:** anonymous access enabled, public network access enabled
- **Production:** anonymous access disabled, reads proxied through the Function App with Managed Identity
- **High-security production:** anonymous access disabled, private endpoint added

### Key Management

The Azure Maps subscription key is never stored in static files or source control. It is read at runtime by `/api/config` from the Function App's app settings and served to the browser only for the current session. All Sentinel queries and blob reads use Managed Identity tokens - no connection strings or SAS tokens are required.

Azure Key Vault was deliberately excluded: the only secret that would benefit is the Maps key, and the added resource, deployment complexity, and access policy configuration are not justified at this scale. To add Key Vault if your environment requires it, create a vault, assign the Function App's Managed Identity the **Key Vault Secrets User** role, store the key as a secret, and replace the `AZURE_MAPS_SUBSCRIPTION_KEY` app setting with a Key Vault reference (`@Microsoft.KeyVault(VaultName=<vault>;SecretName=AzureMapsKey)`).

---

## Deployment

The included script creates all required Azure resources and deploys the app in one step (allow up to 15 minutes). If you prefer to create resources manually in the Azure Portal, skip to [Manual Deployment](#manual-deployment).

> **Azure Government / GCCH:** This project currently targets Azure Commercial only. Azure Static Web Apps - the hosting service used for the frontend - is generally available in commercial regions but is not available in Azure Government (GCC / GCC-H). An alternative approach using Azure Blob Storage static website hosting was explored but introduced enough additional complexity (separate API origin, manual CORS configuration, no `/api/*` proxy) that Government cloud support was deferred to a future standalone project.

### Scripted Deployment (Recommended)

**What you need before starting:**
- An Azure subscription where you have **Owner or Contributor** access (the app is deployed here)
- A Microsoft Sentinel workspace (note the Workspace ID - a GUID found in Azure Portal → Log Analytics workspaces → your workspace → Overview). The workspace can be in a different subscription or resource group.
- **Owner or User Access Administrator** on the Sentinel workspace resource or its subscription - required to grant the Function App `Log Analytics Reader` access. If you do not have this, the script will print the exact command to hand off to someone who does, and the app can still be deployed - just without live data until the role is assigned.
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed
- [Git](https://git-scm.com/downloads) installed
- A [GitHub account](https://github.com/join) (free) - required to fork the repo and run GitHub Actions workflows
- (Recommended) [GitHub CLI](https://cli.github.com/) for automatic CI/CD wiring

**Step 1 - Fork and clone the repo**

You need your own copy of this repository on GitHub so that the GitHub Actions workflows run under your account and you can store secrets against it.

1. Click **Fork** at the top right of this page on GitHub
2. Accept the defaults and click **Create fork**
3. Open PowerShell and clone your fork (replace `YOUR-GITHUB-USERNAME`):

```powershell
git clone https://github.com/YOUR-GITHUB-USERNAME/global-threat-atlas.git
cd global-threat-atlas
```

> **Why fork instead of just clone?** Secrets (like the SWA deployment token set in Step 4) are stored against a GitHub repo. If you clone this repo directly you cannot add secrets to it, and the GitHub Actions workflows that deploy the frontend and function app will not run for you.

**Step 2 - Sign in to Azure**

```powershell
az login
```

A browser window will open. Sign in with an account that has Owner or Contributor on the subscription. When done, PowerShell will show your active subscription. To use a different subscription:
```powershell
az account set --subscription "YOUR-SUBSCRIPTION-NAME-OR-ID"
```

**Step 3 - Run the deployment script**

```powershell
.\deploy.ps1 -Location "eastus" -WorkspaceId "YOUR-WORKSPACE-ID"
```

Replace `YOUR-WORKSPACE-ID` with the GUID from Step 1 and `-Location` with an Azure region close to your Sentinel workspace.

The script produces detailed output for every step - read it carefully as it includes important values you will need in Steps 4 and 5 (the SWA deployment token and Function App publish profile command). Deployment can take **up to 15 minutes**, primarily due to Function App provisioning and package installation.

By default, all Azure resources are named after the project name `global-threat-atlas` and placed in a resource group called `rg-global-threat-atlas`. Both can be customised independently:

| Parameter | Controls | Example value |
|---|---|---|
| `-Location` | Azure region - **required**, deploy close to your Sentinel workspace | `eastus`, `westus2`, `uksouth`, `eastus2` |
| `-ProjectName` | Prefix for all resource names | `contoso-threat-map` |
| `-ResourceGroupName` | Resource group name (overrides ProjectName-derived default) | `rg-security-tools` |

```powershell
# Custom project name (all resources share the same prefix)
.\deploy.ps1 -ProjectName "contoso-threat-map" -Location "westus2" -WorkspaceId "YOUR-WORKSPACE-ID"

# Custom resource group name
.\deploy.ps1 -Location "eastus" -ResourceGroupName "rg-security-tools" -WorkspaceId "YOUR-WORKSPACE-ID"

# Both together
.\deploy.ps1 -ProjectName "contoso-threat-map" -ResourceGroupName "rg-security-tools" -Location "westus2" -WorkspaceId "YOUR-WORKSPACE-ID"
```

**What the script creates:**
- Azure Function App (Python 3.11, Consumption plan) with Managed Identity
- Azure Static Web App (Standard tier) linked to the Function App
- Storage Account with `datasets` and `locks` containers
- Azure Maps Account (Gen2)
- RBAC role assignments (Log Analytics Reader, Storage Blob Data Contributor)
- CORS configured on the Function App for the SWA hostname

At the end the script prints a **Next Steps** section with a deployment token and commands. Steps 4 and 5 below walk through those.

**Step 4 - Deploy the frontend to your Static Web App**

> **Note:** The SWA will show "Waiting for deployment" until this step is complete.

The map interface is hosted on the Static Web App and deployed via a GitHub Actions workflow. The workflow needs a deployment token stored as a secret in your GitHub repo before it can run - this is why the SWA shows "Waiting for deployment" after the script finishes.

The deploy script prints a token in the Next Steps output. Copy it, then add it to your GitHub repo:

1. Go to your GitHub repo on GitHub.com
2. Click **Settings** (top navigation)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. **Name:** `AZURE_STATIC_WEB_APPS_API_TOKEN`
6. **Value:** paste the token printed by the deploy script
7. Click **Add secret**

Or with GitHub CLI:
```powershell
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --body '<token-from-deploy-output>'
```

Once the secret is saved, trigger the first deployment:

1. Go to your GitHub repo → **Actions** tab
2. Click **Azure Static Web Apps CI/CD** in the left sidebar
3. Click **Run workflow** → **Run workflow**

After about a minute the SWA status changes from "Waiting for deployment" to live. The URL is shown on the Static Web App overview page in the Azure Portal.

**Step 5 - Enable automatic Function App redeployment (optional)**

The deploy script already pushed the function code. This step only matters if you plan to make changes to `api/` in the future - it sets up GitHub Actions to redeploy automatically on every push.

From the Next Steps output in the deploy script, run the printed command (it fetches the publish profile and saves it as a secret in one step):

```powershell
az functionapp deployment list-publishing-profiles `
  --name <FUNCTION-APP-NAME> `
  --resource-group <RESOURCE-GROUP> `
  --xml | gh secret set AZURE_FUNCTIONAPP_PUBLISH_PROFILE
```

Replace `<FUNCTION-APP-NAME>` and `<RESOURCE-GROUP>` with the values printed by the deploy script. Once set, any push to `api/` on `main` triggers an automatic redeploy.

**Step 6 - Add your MaxMind license key**

IP enrichment uses [MaxMind GeoLite2](https://www.maxmind.com/en/geolite2/signup) - a free, locally-run database that provides city-level precision (latitude, longitude, ASN, and ISP data) on every IP lookup. It is more detailed than the coordinates Azure embeds in sign-in logs, works offline inside the Function App, and adds no per-lookup cost or external API call. A free GeoLite2 license is sufficient for personal or internal use; a paid [GeoIP2](https://www.maxmind.com/en/geoip/geoip2-databases-overview) license is recommended for production or commercial deployments.

Sign up at [maxmind.com/en/geolite2/signup](https://www.maxmind.com/en/geolite2/signup) to obtain a free Account ID and License Key, then run:

```powershell
az functionapp config appsettings set `
  --name <FUNCTION-APP-NAME> `
  --resource-group <RESOURCE-GROUP> `
  --settings MAXMIND_ACCOUNT_ID="<your-account-id>" MAXMIND_LICENSE_KEY="<your-license-key>"
```

Substitute the Function App name and resource group printed by the deploy script.

**Step 7 - Trigger the first data refresh**

Open a browser and go to:
```
https://<your-swa-hostname>/api/refresh
```

Use the Static Web App URL (printed on the SWA overview page), not the Function App URL directly. The Function App is behind the SWA and direct calls to `azurewebsites.net` will be blocked. The refresh may take 1-2 minutes the first time. Once complete, reload the SWA URL and enable the data layers.

> **Note:** Blob-based layers (Devices, Sign-ins, Threat Intel) will be greyed out in the map menu until the function has completed its first refresh and written the data files to storage. The refresh requires the Function App Managed Identity to have the **Log Analytics Reader** role on the Sentinel workspace - if the refresh returns an error or produces no data, verify this role assignment first.

**Step 8 - Verify everything is working**

```
https://<your-swa-hostname>/api/health
```

This returns the current status of all configuration settings and the age of each data file.

---

### Custom Source layer

The deployment uploads a sample `custom-source.geojson` to the `datasets` blob container so the Custom Source layer is visible immediately. Replace it with your own GeoJSON FeatureCollection at any time - each feature's properties appear in the map popup.

**Ways to create a GeoJSON file:**
- Export from tools like [geojson.io](https://geojson.io), QGIS, or ArcGIS
- Drag and drop any GeoJSON file onto the map for a temporary preview before committing it to storage

**To replace the custom source file:**

1. In the Azure Portal, go to your Storage Account -> Containers -> `datasets`
2. Upload your file named `custom-source.geojson`, overwriting the existing one

**To rename the layer in the map menu:**

1. In the Azure Portal, go to your Function App -> Environment variables
2. Add or update `CUSTOM_LAYER_DISPLAY_NAME` with your preferred display name

---

### Manual Deployment

If you prefer the Azure Portal over the CLI, create the following resources in the same resource group in this order:

1. **Storage Account** - Standard LRS, anonymous blob access disabled. Create a container named `datasets` and one named `locks`.
2. **Function App** - Python 3.11, Linux, Consumption plan. Enable System-assigned Managed Identity under Identity.
3. **Azure Maps Account** - Gen2 SKU (required for weather tiles).
4. **Static Web App** - Standard tier. Under Settings → APIs, link it to the Function App.

After creating resources, configure the Function App's Application Settings:

| Setting | Value |
|---|---|
| `AZURE_MAPS_SUBSCRIPTION_KEY` | Key from Azure Maps Account → Authentication |
| `STORAGE_ACCOUNT_URL` | `https://<your-storage-account>.blob.core.windows.net` |
| `STORAGE_CONTAINER_DATASETS` | `datasets` |
| `SENTINEL_WORKSPACE_ID` | Your Log Analytics workspace GUID |
| `MAXMIND_ACCOUNT_ID` | From maxmind.com |
| `MAXMIND_LICENSE_KEY` | From maxmind.com |

Then assign RBAC roles on the storage account to the Function App's Managed Identity:
- **Storage Blob Data Contributor** - allows the refresh pipeline to write enriched data
- **Storage Blob Data Reader** - allows the data proxy to serve files to the browser

And assign on the Log Analytics workspace:
- **Log Analytics Reader** - allows the refresh pipeline to run KQL queries against Sentinel

Finally, deploy the `api/` folder to the Function App (via VS Code Azure Functions extension or `func azure functionapp publish <name>`), and connect the Static Web App to this GitHub repository to trigger the frontend build.

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
| `CUSTOM_LAYER_DISPLAY_NAME` | Display name for the custom GeoJSON overlay layer in the map menu | `Custom Source` |
| `REFRESH_MAX_ROWS` | Row cap for KQL query results | `1000000` |
| `TICKER_MAX_ITEMS` | Maximum number of cybersecurity headlines shown in the news ticker | `10` |
| `TICKER_SPEED_S` | News ticker scroll speed in seconds - lower is faster | `70` |
| `LIVE_REFRESH_INTERVAL_MINUTES` | How often the map reloads device and sign-in layers while the page is open. Set to `0` to disable. To get live updates, set `REFRESH_DEVICE_FREQUENCY_MINUTES` and `REFRESH_SIGNIN_FREQUENCY_MINUTES` to the same value so the backend actually re-queries Sentinel each cycle. | `5` |

### CI/CD

The Function App deploys automatically on push to `api/**` via a workflow file in `.github/workflows/` (named `main_func-<your-function-app-name>.yml`, generated when the Function App is created in Azure). The SWA deploys automatically on push to `web/**` via the SWA-generated workflow. Both workflows are configured by `deploy.ps1` during deployment.

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
| `/api/news` | GET | Returns recent cybersecurity headlines from RSS feeds as `{items, speed_s}`; cached 5 min |
| `/api/refresh` | GET, POST | Runs the Sentinel KQL → MaxMind → GeoJSON pipeline for stale datasets |

See [api/README.md](api/README.md) for full parameter and response details.

---

## Troubleshooting

### Deployment checklist

If the app is not working after deployment, work through this checklist in order.

**1. All four core resources exist in the same resource group**

In the Azure Portal, confirm these resources are present:
- Storage Account
- Function App (with Application Insights auto-created alongside it)
- Azure Maps Account
- Static Web App

If any are missing, re-run `deploy.ps1` or create them manually following [Manual Deployment](#manual-deployment).

**2. Function App has all expected functions**

In the Azure Portal, go to Function App -> Functions and confirm these are listed: `config`, `data`, `enrich_geo`, `generate_geojson`, `health`, `lookup-ip`, `news`, `refresh`. If the list is empty or missing functions, the deployment did not complete. Check your GitHub repository Actions tab for failures in the function deploy workflow (`main_func-<name>.yml`).

**3. Static Web App is deployed and linked to the Function App**

- In the Azure Portal, go to Static Web App -> GitHub Actions runs and confirm the frontend build completed successfully.
- Go to Static Web App -> Settings -> APIs and confirm the Function App is listed as a linked backend. If not, link it manually.
- Navigating to the SWA URL should load the map, not a 404 page.

**4. Function App environment variables are complete**

Go to Function App -> Environment variables and confirm all required settings from the [Function App settings reference](#function-app-settings-reference) are present. Pay particular attention to `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY`, `AZURE_MAPS_SUBSCRIPTION_KEY`, `STORAGE_ACCOUNT_URL`, and `SENTINEL_WORKSPACE_ID`.

**5. MaxMind and Azure Maps keys are valid**

- For MaxMind: log in at [maxmind.com](https://www.maxmind.com) and confirm the account ID and license key match what is set in the Function App. An invalid key will cause IP enrichment to fail silently.
- For Azure Maps: go to Azure Maps Account -> Authentication and copy the primary key. Confirm it matches `AZURE_MAPS_SUBSCRIPTION_KEY` in the Function App settings.

**6. Managed Identity role assignments**

Go to Function App -> Identity -> Azure role assignments and confirm these three roles are assigned:
- **Storage Blob Data Contributor** on the Storage Account - required for writing enriched data
- **Storage Blob Data Reader** on the Storage Account - required for serving files to the browser
- **Log Analytics Reader** on the Sentinel Log Analytics workspace - required for KQL queries

Missing role assignments are the most common cause of a successful deployment that returns no data.

**7. Demo and dataset files exist in blob storage**

Go to Storage Account -> Containers -> `datasets` in the Azure Portal Storage Browser. After deployment you should see `threat-actors.tsv` and `custom-source.geojson` at the container root, plus GeoJSON data files after the first successful refresh. If the container is empty, the deploy script may not have completed the upload step.

**8. Use the health endpoint to confirm configuration**

Open a browser and go to:
```
https://<your-swa-hostname>/api/health
```
This returns the status of every required setting and the age of each data blob. Missing settings and missing blobs are clearly flagged. This is the fastest way to confirm what is and is not working.

**9. Check GitHub Actions for workflow failures**

In your forked repository, go to the Actions tab and check for failed runs in both workflows (the SWA deploy workflow and the function deploy workflow). A red X on either means the code was not deployed. Re-running the failed workflow after fixing any configuration issues is usually sufficient.

---

### Expected pip warnings during deployment

The deploy script runs `pip install` for the Function App dependencies. The following messages may appear and are safe to ignore - they are conflicts in your local Python environment unrelated to the function's own packages:

```
WARNING: Ignoring invalid distribution ~ransformers (...)
ERROR: pip's dependency resolver does not currently take into account all the packages that are installed.
  tensorflow-intel 2.18.0 requires ml-dtypes<0.5.0,...
  tensorflow-intel 2.18.0 requires tensorboard<2.19,...
  thinc 8.3.6 requires numpy<3.0.0,...
```

These warnings do not affect the deployed Function App, which runs in an isolated Linux container with its own clean environment.

---

### Runtime issues

**Map does not load / blank page**
- Open browser developer tools (F12) -> Console tab and look for errors. You can safely ignore `favicon.ico` 404s, third-party cookie warnings, and any CORS preflight messages that resolve successfully.
- Navigate directly to `https://<your-swa-hostname>/api/config` and confirm the response includes a non-empty `azureMapsKey`. An empty key means `AZURE_MAPS_SUBSCRIPTION_KEY` is not set.
- Wait 30-60 seconds after first deployment for the Function App cold start to complete.

**Layers are greyed out**
- Blob-based layers are greyed out until the first refresh has written data files to storage. Call `/api/refresh` to trigger it.
- Open `/api/health` in the browser to see blob freshness and whether all required settings are configured.
- Confirm `SENTINEL_WORKSPACE_ID`, `MAXMIND_ACCOUNT_ID`, and `MAXMIND_LICENSE_KEY` are set and the Managed Identity has **Log Analytics Reader** on the workspace.

**No data on the map after refresh**
- Confirm all three Managed Identity role assignments from the deployment checklist above are in place.
- Call `/api/refresh?force=true` to bypass the freshness check and force all pipelines to run immediately.
- Check Function App -> Monitor -> Logs for KQL errors (usually a missing workspace ID or insufficient permissions) or MaxMind errors (usually a bad license key).

**401 / 403 errors**
- Verify that System-assigned Managed Identity is enabled on the Function App (Function App -> Identity -> Status = On).
- Check all three RBAC role assignments are present as described in the deployment checklist.

**IP lookup returns no result**
- Confirm `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY` are set correctly.
- Private, reserved, and some cloud-provider IPs are excluded by design.

**Data is stale**
- Each pipeline refreshes at most once per 24 hours by default. Call `/api/refresh?force=true` to refresh immediately.
- Adjust frequency with `REFRESH_DEVICE_FREQUENCY_MINUTES`, `REFRESH_SIGNIN_FREQUENCY_MINUTES`, or `REFRESH_THREATINTEL_FREQUENCY_HOURS`.

---

## Acknowledgements

This project uses the following third-party services:

- **[MaxMind GeoLite2](https://www.maxmind.com)** - IP geolocation database. This product includes GeoLite2 data created by MaxMind, available from [https://www.maxmind.com](https://www.maxmind.com). Use of MaxMind data is subject to the [GeoLite2 End User License Agreement](https://www.maxmind.com/en/geolite2/eula). A free license is sufficient for personal and internal use; a paid [GeoIP2](https://www.maxmind.com/en/geoip/geoip2-databases-overview) license is required for commercial or business deployments.
- **[Azure Maps](https://azure.microsoft.com/en-us/products/azure-maps/)** - Map rendering, weather tiles, and basemap imagery.
- **[VirusTotal](https://www.virustotal.com)** - IP reputation links (user-initiated only; no automated API calls are made by this application).

---

## About the Developer

<img src="https://github.com/AndrewBlumhardt.png" alt="Andrew Blumhardt" width="96" align="left" style="border-radius:50%; margin-right:16px"/>

**Andrew Blumhardt** is a security engineer focused on Microsoft Sentinel, Azure cloud security, and threat intelligence tooling. This project was built to give SOC teams a practical, self-hosted threat visualization layer on top of their existing Sentinel investment - deployable in a single script and designed to run as a wall display or analyst dashboard.

- **GitHub:** [github.com/AndrewBlumhardt](https://github.com/AndrewBlumhardt)
- **LinkedIn:** [linkedin.com/in/andrewblumhardt](https://www.linkedin.com/in/andrewblumhardt/)

Developed with assistance from [GitHub Copilot](https://github.com/features/copilot) (Claude Sonnet) and [ChatGPT](https://chatgpt.com).
