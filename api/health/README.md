# health

Returns the API status, configuration presence, and current age of each GeoJSON data file.

## Endpoint

`GET /api/health`

## Response fields

| Field | Description |
|---|---|
| `status` | Always `"healthy"` if the function responds |
| `timestamp` | UTC ISO 8601 timestamp |
| `configuration` | Map of required settings to `true`/`false` (presence, not values) |
| `blobs` | Age in hours for `mde-devices.geojson`, `signin-activity.geojson`, `threat-intel-indicators.geojson` |
| `maxmind_available` | Whether the local GeoLite2 database is cached and readable |

## Usage

The frontend calls this endpoint every 14 minutes to keep the Function App warm on the Consumption plan. The response is also used to decide which layer toggles to enable or grey out on initial load.
