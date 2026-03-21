# API

Python Azure Functions backend for the Sentinel Activity Maps application.

## Functions

### `/api/config`
**Method:** GET

Returns runtime configuration to the browser. Reads `AZURE_MAPS_SUBSCRIPTION_KEY`, `STORAGE_ACCOUNT_URL`, `STORAGE_CONTAINER_DATASETS`, and `CUSTOM_LAYER_DISPLAY_NAME` from the Function App's environment and returns them as JSON. The Maps key is never stored in static files - this endpoint is the sole delivery mechanism. Response carries `Cache-Control: no-cache`.

---

### `/api/data/{filename}`
**Methods:** GET, HEAD

Proxies a blob from the storage container to the browser using Managed Identity authentication. Supports `?demo=true` to read from the `demo_data/` prefix instead of the root prefix. Used when the storage account has anonymous blob access disabled.

---

### `/api/enrich_geo`
**Methods:** GET, POST

Batch IP geo-enrichment. Accepts a JSON array of IP strings (up to several thousand per call), resolves each against the local MaxMind GeoLite2-City binary database, and returns a JSON array of objects with `ip`, `latitude`, `longitude`, `country`, and `city` fields. IPs that cannot be resolved (private space, reserved ranges) are returned with null coordinate fields.

Requires `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY` app settings.

---

### `/api/generate_geojson`
**Methods:** GET, POST

Converts an enriched TSV blob in storage to a GeoJSON FeatureCollection and uploads the result back to storage as a `.geojson` file. Parameters:

| Parameter | Description |
|---|---|
| `source` | Filename of the source TSV blob |
| `target` | Filename of the output GeoJSON blob |
| `type` | Dataset type (`devices`, `signin`, or `threatintel`) used to select property mapping |

---

### `/api/health`
**Method:** GET

Returns the current API status as JSON. Includes:
- `status` - always `"healthy"` if the function is reachable
- `timestamp` - UTC ISO 8601 string
- `configuration` - presence (not values) of required app settings
- `blobs` - age in hours for each of the three GeoJSON data files (`mde-devices.geojson`, `signin-activity.geojson`, `threat-intel-indicators.geojson`)
- `maxmind_available` - whether the local GeoLite2 database is present and readable

---

### `/api/lookup-ip`
**Method:** GET

Resolves a single IP address to geo coordinates using the MaxMind GeoLite2-City database. Parameter: `?ip=<address>`. Returns `latitude`, `longitude`, `country`, `city`, and `accuracy_radius`.

Requires `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY` app settings.

---

### `/api/refresh`
**Methods:** GET, POST

Runs the full Sentinel → MaxMind → GeoJSON pipeline for all three data types (MDE devices, sign-in activity, threat intelligence). Each pipeline is checked individually for staleness before running.

**Parameters:**

| Parameter | Description |
|---|---|
| `check=true` | Return freshness status without running any pipelines |
| `force=true` | Bypass the frequency threshold and run all stale and fresh pipelines |
| `pipeline=<name>` | Run only one pipeline (`devices`, `signin`, or `threatintel`) |

**Pipeline steps:**
1. HEAD against the existing blob to check last-modified age against the configured frequency threshold.
2. Write a `refresh.lock` blob to prevent concurrent runs.
3. Download and cache the MaxMind GeoLite2-City database to `/tmp/` if absent or older than 7 days.
4. Execute the KQL query against the Sentinel Log Analytics workspace using Managed Identity.
5. Resolve public IPs against the local GeoLite2 database.
6. Upload the enriched TSV and GeoJSON output to Blob Storage.
7. Delete the lock blob.

**Frequency settings:**

| Pipeline | Setting | Default |
|---|---|---|
| Devices | `REFRESH_DEVICE_FREQUENCY_MINUTES` | 1440 (24 h) |
| Sign-in | `REFRESH_SIGNIN_FREQUENCY_MINUTES` | 1440 (24 h) |
| Threat intel | `REFRESH_THREATINTEL_FREQUENCY_HOURS` | 24 |

**Lookback settings:**

| Pipeline | Setting | Default |
|---|---|---|
| Devices | `REFRESH_DEVICE_LOOKBACK_HOURS` | 168 (7 days) |
| Sign-in | `REFRESH_SIGNIN_LOOKBACK_HOURS` | 168 (7 days) |

KQL queries can be overridden with `SENTINEL_DEVICES_KQL`, `SENTINEL_SIGNIN_KQL`, or `SENTINEL_THREATINTEL_KQL`.
