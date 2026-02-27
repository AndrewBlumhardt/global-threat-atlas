# Global Threat Intelligence Atlas - Frontend

Azure Maps-based frontend for visualizing Microsoft Sentinel activity data.

## Overview

This is an Azure Static Web App that visualizes security data from Microsoft Sentinel using Azure Maps. It displays:
- **Sign-in activities** with success/failure indicators
- **Device locations** with type-based coloring
- **Threat intelligence** indicators
- **Proximity analysis** (300km radius click feature)
- **VirusTotal integration** for IP lookups

## Features

### Data Visualization
- **Bubble Markers**: 14px CSS circles with color coding
  - Green = Success/Mobile devices
  - Red = Failed sign-ins
  - Blue = Desktop/Laptop devices
- **Hover Popups**: Rich context on mouseover
- **Click Actions**: Proximity search within 300km radius
- **Layer Controls**: Toggle individual data layers

### Demo Mode
Access without Azure credentials:
```
https://your-app.azurestaticapps.net/?demo=true
```

Demo mode loads:
- 500 pre-generated sign-in activities
- 500 device locations across 50+ global cities
- Public threat intelligence datasets

### Proximity Search
Click any marker to find related activities within 300km:
- Lists matching sign-ins or devices
- Shows distance from click point
- Correlates with threat intel IPs
- Includes VirusTotal lookup buttons

## Configuration

### Azure Maps Key

Create `config.js` from template:
```javascript
```powershell
az maps account keys list --name YOUR-MAPS-ACCOUNT --resource-group YOUR-RG
### API Functions

The `web/api` directory and its Azure Functions are no longer required. The frontend now calls the stand-alone Function App backend directly. All legacy files have been removed.
```

When `FUNCTION_APP_BASE_URL` is set, frontend API requests target that host directly.
When unset, frontend falls back to same-origin `/api` routes.

## File Structure

```
web/
├── index.html              # Main HTML shell
├── config.js               # Azure Maps key (gitignored)
├── config.sample.js        # Template for config
├── staticwebapp.config.json # SWA routing config
├── src/
│   ├── app.js              # Main application logic
│   ├── map/
│   │   └── map-init.js     # Azure Maps initialization
│   ├── overlays/
│   │   ├── signInActivityOverlay.js      # Sign-in markers
│   │   ├── deviceLocationsOverlay.js     # Device markers
│   │   ├── threatIntelOverlay.js         # Threat intel layer
│   │   └── threatActorsHeatmap.js        # Heatmap overlay
│   ├── ui/
│   │   ├── panelManager.js               # Side panel controls
│   │   ├── autoScroll.js                 # List auto-scrolling
│   │   ├── threatActorsToggle.js         # Heatmap toggle
│   │   └── threatIntelToggle.js          # Threat intel toggle
│   ├── data/
│   │   └── tsv.js          # TSV file support
│   └── shared/
│       └── demoMode.js     # Demo mode data routing
├── styles/
│   └── app.css             # Application styles
└── data/
    └── threat-actors.tsv   # Threat actor heatmap data
```

## Development

### Local Setup

1. **Clone repository**:
   ```powershell
   git clone https://github.com/AndrewBlumhardt/sentinel-activity-maps.git
   cd sentinel-activity-maps/web
   ```

2. **Configure Azure Maps**:
   ```powershell
   Copy-Item config.sample.js config.js
   # Edit config.js with your Azure Maps key
   ```

3. **Serve locally**:
   ```powershell
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server -p 8000
   ```

4. **Open browser**:
   ```
   http://localhost:8000
   ```

### Enable Demo Mode

Add `?demo=true` to URL or modify `src/shared/demoMode.js`:
```javascript
export function isDemoMode() {
  return true; // Force demo mode
}
```

### Demo and Sample Data

Demo mode uses sample data files from `tests/sample-data/`:
- `threat-actors.tsv`: Sample threat actor data
- `mde-devices-test.tsv`, `mde-devices-enriched.tsv`, `mde-devices.geojson`: Device and geo-enrichment samples

Production deployments fetch data from blob storage; these files are only for demo mode and local development.


