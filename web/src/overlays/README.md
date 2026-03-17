# overlays

One module per data layer rendered on the Azure Maps canvas. Each module exports `init`, `show`, `hide`, and `refresh` functions.

## Files

| File | Layer | Data source |
|---|---|---|
| `signInActivityOverlay.js` | Sign-in activity (HTML marker pins) | `signin-activity.geojson` |
| `deviceLocationsOverlay.js` | MDE device locations (HTML marker pins) | `mde-devices.geojson` |
| `threatIntelOverlay.js` | Threat intelligence indicators (bubble layer) | `threat-intel-indicators.geojson` |
| `threatActorsHeatmap.js` | Threat actor heatmap by country | `threat-actors.tsv` (static) |
| `customSourceOverlay.js` | User-supplied or hosted GeoJSON overlay | Configurable blob or drag-and-drop |
| `ipLookupOverlay.js` | Single IP lookup pin | MaxMind via `/api/lookup-ip` |
| `dayNightOverlay.js` | Day/night terminator | Atlas geometry (no network call) |

Marker sizes for HTML marker overlays are defined in `../shared/markerConfig.js`.
