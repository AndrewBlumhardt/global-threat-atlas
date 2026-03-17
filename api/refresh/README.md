# refresh

Runs the Sentinel → MaxMind → GeoJSON pipeline for MDE device data, sign-in activity, and threat intelligence indicators.

## Endpoint

`GET /api/refresh`  
`POST /api/refresh`

## Parameters

| Parameter | Description |
|---|---|
| `check=true` | Return freshness status without running any pipelines |
| `force=true` | Bypass the frequency threshold and run all pipelines regardless of age |
| `pipeline=<name>` | Run only one pipeline: `devices`, `signin`, or `threatintel` |

## Pipeline steps

For each pipeline:

1. Check last-modified age of the existing blob against the configured frequency threshold. Skip if fresh (unless `force=true`).
2. Write a `refresh.lock` blob to prevent concurrent runs.
3. Download and cache the MaxMind GeoLite2-City database to `/tmp/` if absent or older than 7 days.
4. Execute the KQL query against the Sentinel Log Analytics workspace using a Managed Identity token.
5. Resolve public IPs against the local GeoLite2 binary database.
6. Upload the enriched TSV and GeoJSON output to Blob Storage using Managed Identity.
7. Delete the lock blob.

## Frequency settings

| Pipeline | Setting | Default |
|---|---|---|
| Devices | `REFRESH_DEVICE_FREQUENCY_MINUTES` | 1440 (24 h) |
| Sign-in | `REFRESH_SIGNIN_FREQUENCY_MINUTES` | 1440 (24 h) |
| Threat intel | `REFRESH_THREATINTEL_FREQUENCY_HOURS` | 24 |

## Lookback settings

| Pipeline | Setting | Default |
|---|---|---|
| Devices | `REFRESH_DEVICE_LOOKBACK_HOURS` | 168 (7 days) |
| Sign-in | `REFRESH_SIGNIN_LOOKBACK_HOURS` | 168 (7 days) |

KQL queries can be overridden with `SENTINEL_DEVICES_KQL`, `SENTINEL_SIGNIN_KQL`, or `SENTINEL_THREATINTEL_KQL`.
