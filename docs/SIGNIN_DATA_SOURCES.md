# Sign-In and Device Data Sources

This document describes the new data sources for sign-in activity and device locations.

## Overview

Two new data sources have been added to the Sentinel Activity Maps:

1. **Sign-In Activity** - Tracks all user sign-in events with location, device, and authentication details
2. **Device Locations** - Tracks the last known location of each device

Both sources are automatically enabled and will refresh periodically. If the `SigninLogs` table is not present in your Log Analytics workspace, these sources will gracefully skip without causing errors.

## Sign-In Activity

**File**: `signin-activity.geojson` / `signin-activity.tsv`  
**Refresh**: Every 4 hours  
**Lookback**: 2 days

### Features

- Maps all sign-in events (successful and failed)
- Includes user details, IP addresses, and authentication results
- Shows device compliance and management status
- Identifies Microsoft IP ranges (13.x, 20.x, 40.x, 52.x, 104.x)
- Displays risk state and conditional access status

### Data Fields

| Field | Description |
|-------|-------------|
| TimeGenerated | Timestamp of the sign-in event |
| UserDisplayName | User's display name |
| UserPrincipalName | User's email/UPN |
| IPAddress | IP address used for sign-in |
| IsMicrosoftIP | Boolean indicating if IP is in Microsoft ranges |
| ResultSignature | Sign-in result (SUCCESS or error code) |
| ResourceDisplayName | Application/resource accessed |
| Browser | Browser used for sign-in |
| OperatingSystem | Operating system of the device |
| DeviceId | Unique device identifier |
| isCompliant | Device compliance status |
| isManaged | Device management status |
| ConditionalAccessStatus | Result of conditional access policies |
| RiskState | User/sign-in risk level |
| RiskReason | Primary risk factor |
| CountryOrRegion | Sign-in location country |
| State | Sign-in location state/region |
| City | Sign-in location city |
| Latitude | Geographic latitude |
| Longitude | Geographic longitude |

### KQL Query

```kql
SigninLogs
| where TimeGenerated > ago(48h)
| where IPAddress contains "."
| extend IsMicrosoftIP = toint(split(IPAddress, ".")[0]) in (13,20,40,52,104)
| extend Browser = DeviceDetail.browser
| extend DeviceId = DeviceDetail.deviceId
| extend isCompliant = DeviceDetail.isCompliant
| extend isManaged = DeviceDetail.isManaged
| extend OperatingSystem = DeviceDetail.operatingSystem
| extend City = LocationDetails.city
| extend CountryOrRegion = LocationDetails.countryOrRegion
| extend State = LocationDetails.state
| extend Latitude = parse_json(tostring(LocationDetails.geoCoordinates)).latitude
| extend Longitude = parse_json(tostring(LocationDetails.geoCoordinates)).longitude
| extend RiskReason = parse_json(RiskEventTypes)[0]
| extend ResourceDisplayName = iif(isempty(ResourceDisplayName), "Unknown", ResourceDisplayName)
| extend Browser = iif(isempty(Browser), "Unknown", Browser)
| extend DeviceId = iif(isempty(DeviceId), "Unknown", DeviceId)
| project
    TimeGenerated,
    UserDisplayName,
    UserPrincipalName,
    IPAddress,
    IsMicrosoftIP,
    ResultSignature,
    ResourceDisplayName,
    Browser,
    OperatingSystem,
    DeviceId,
    isCompliant,
    isManaged,
    ConditionalAccessStatus,
    RiskState,
    RiskReason,
    CountryOrRegion,
    State,
    City,
    Latitude,
    Longitude
| order by TimeGenerated desc
```

## Device Locations

**File**: `device-locations.geojson` / `device-locations.tsv`  
**Refresh**: Every 6 hours  
**Lookback**: 2 days

### Features

- Shows the most recent location for each unique device
- One point per device (deduplicated by DeviceId)
- Includes device details and last user
- Useful for device inventory and geographic distribution

### Data Fields

| Field | Description |
|-------|-------------|
| TimeGenerated | Last sign-in timestamp for this device |
| DeviceId | Unique device identifier |
| UserDisplayName | Last user's display name |
| UserPrincipalName | Last user's email/UPN |
| IPAddress | Last IP address used |
| IsMicrosoftIP | Boolean indicating if IP is in Microsoft ranges |
| Browser | Browser information |
| OperatingSystem | Operating system of the device |
| isCompliant | Device compliance status |
| isManaged | Device management status |
| CountryOrRegion | Last known location country |
| State | Last known location state/region |
| City | Last known location city |
| Latitude | Geographic latitude |
| Longitude | Geographic longitude |

### KQL Query

```kql
SigninLogs
| where TimeGenerated > ago(48h)
| summarize arg_max(TimeGenerated, *) by DeviceId
| where isnotempty(DeviceId)
| extend IsMicrosoftIP = toint(split(IPAddress, ".")[0]) in (13,20,40,52,104)
| extend Browser = DeviceDetail.browser
| extend isCompliant = DeviceDetail.isCompliant
| extend isManaged = DeviceDetail.isManaged
| extend OperatingSystem = DeviceDetail.operatingSystem
| extend City = LocationDetails.city
| extend CountryOrRegion = LocationDetails.countryOrRegion
| extend State = LocationDetails.state
| extend Latitude = parse_json(tostring(LocationDetails.geoCoordinates)).latitude
| extend Longitude = parse_json(tostring(LocationDetails.geoCoordinates)).longitude
| extend Browser = iif(isempty(Browser), "Unknown", Browser)
| project
    TimeGenerated,
    DeviceId,
    UserDisplayName,
    UserPrincipalName,
    IPAddress,
    IsMicrosoftIP,
    Browser,
    OperatingSystem,
    isCompliant,
    isManaged,
    CountryOrRegion,
    State,
    City,
    Latitude,
    Longitude
| order by TimeGenerated desc
```

## Configuration

Both sources are configured in [`api/sources.yaml`](../api/sources.yaml):

```yaml
sources:
  - id: signin_activity
    name: "Sign-in Activity"
    enabled: true
    refresh_threshold_hours: 4
    query_time_window_hours: 48
    output_filename: "signin-activity.tsv"
    auto_enrich_geo: false  # Coordinates from SigninLogs
    auto_generate_geojson: true

  - id: device_locations
    name: "Device Locations"
    enabled: true
    refresh_threshold_hours: 6
    query_time_window_hours: 48
    output_filename: "device-locations.tsv"
    auto_enrich_geo: false  # Coordinates from SigninLogs
    auto_generate_geojson: true
```

## Graceful Degradation

If the `SigninLogs` table is not available in your workspace:
- The queries will return empty results (no error)
- No files will be created in blob storage
- Other data sources will continue to function normally
- Logs will show: `Table not found in workspace, returning empty results`

This ensures the function app remains operational even when SigninLogs data is not available.

## Demo Data

Demo mode includes sample data for both sources:
- **demo_data/signin-activity.geojson** - 500 sample sign-in events with realistic distribution
- **demo_data/device-locations.geojson** - 5 sample device locations

The demo data was generated using [`generate_signin_data.py`](../generate_signin_data.py).

## Usage

### Manual Refresh

To manually refresh sign-in data:

```bash
# Refresh all sources (including signin-activity and device-locations)
curl https://<your-function-app>.azurewebsites.net/api/refresh

# Refresh only signin-activity
curl https://<your-function-app>.azurewebsites.net/api/refresh?source_id=signin_activity

# Refresh only device-locations
curl https://<your-function-app>.azurewebsites.net/api/refresh?source_id=device_locations

# Force refresh (bypass cache)
curl https://<your-function-app>.azurewebsites.net/api/refresh?source_id=signin_activity&force=true
```

### Accessing Data

The data is automatically available via the Static Web App API:

```javascript
// Sign-in activity
fetch('/api/data/signin-activity?demo=false')
  .then(r => r.json())
  .then(data => console.log(data));

// Device locations
fetch('/api/data/device-locations?demo=false')
  .then(r => r.json())
  .then(data => console.log(data));

// Demo mode
fetch('/api/data/signin-activity?demo=true')
  .then(r => r.json())
  .then(data => console.log(data));
```

## Microsoft IP Ranges

The queries identify sign-ins from Microsoft IP ranges:
- **13.x** - Azure Public Cloud
- **20.x** - Azure Public Cloud
- **40.x** - Azure Public Cloud
- **52.x** - Azure Public Cloud
- **104.x** - Azure Public Cloud

This is useful for identifying internal Microsoft network sign-ins vs. external locations.

## Troubleshooting

### No data appearing

1. Check if SigninLogs table exists in your workspace:
   ```kql
   SigninLogs | take 1
   ```

2. Check function app logs for errors:
   ```bash
   az functionapp logs tail --name <function-app-name> --resource-group <rg-name>
   ```

3. Manually trigger refresh:
   ```bash
   curl https://<your-function-app>.azurewebsites.net/api/refresh?source_id=signin_activity&force=true
   ```

### Verify data in blob storage

```bash
az storage blob list \
  --account-name sentinelmapsstore \
  --container-name datasets \
  --prefix signin-activity \
  --output table
```

## Related Documentation

- [Architecture](ARCHITECTURE.md)
- [Deployment](DEPLOYMENT.md)
- [Local Development](LOCAL_DEVELOPMENT.md)
- [Custom Source Setup](CUSTOM_SOURCE.md)
