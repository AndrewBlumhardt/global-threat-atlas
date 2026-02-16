# Frontend Source Code

JavaScript modules for the Sentinel Activity Maps web application.

## 📁 Directory Structure

```
src/
├── app.js              # Main application initialization and orchestration
├── data/              # Data loading and parsing utilities
├── map/               # Azure Maps initialization and configuration
├── overlays/          # Map overlay layers (markers, heatmaps)
├── shared/            # Shared utilities and state management
└── ui/                # User interface components and controls
```

## 🔧 Core Files

### `app.js`
**Main Application Entry Point**

Responsibilities:
- Initialize Azure Maps instance
- Load Azure Maps subscription key from config API
- Set up map controls (zoom, style picker, etc.)
- Initialize all overlay layers
- Manage demo mode toggle
- Check data availability for each layer
- Handle application-wide events

Key Functions:
- `initializeMap()` - Create and configure Azure Maps instance
- `initializeOverlays()` - Set up all data overlay layers
- `checkDataAvailability()` - Verify data files exist before showing toggles
- `loadThreatActorsData()` - Load and render threat actors heatmap

Initializes:
- Sign-in activity overlay
- Device locations overlay  
- Threat intelligence overlay
- Threat actors heatmap
- Panel managers and UI controls

## 📂 Subdirectories

### [`data/`](./data/README.md)
Data loading, parsing, and transformation utilities for TSV and GeoJSON files.

### [`map/`](./map/README.md)
Azure Maps initialization, configuration, and map management.

### [`overlays/`](./overlays/README.md)
Map overlay layers for visualizing different data sources (markers, heatmaps, popups).

### [`shared/`](./shared/README.md)
Shared utilities including demo mode state management and common functions.

### [`ui/`](./ui/README.md)
User interface components for panels, toggles, and interactive controls.

## 🚀 Application Flow

```
index.html loads app.js
    ↓
app.js initializes map with Azure Maps
    ↓
Loads configuration from /api/config
    ↓
Initializes overlay layers
    ├── Sign-in Activity (signInActivityOverlay.js)
    ├── Device Locations (deviceLocationsOverlay.js)
    ├── Threat Intel (threatIntelOverlay.js)
    └── Threat Actors Heatmap (threatActorsHeatmap.js)
    ↓
Checks data availability
    ↓
Sets up UI controls and event handlers
    ↓
Application ready for user interaction
```

## 🎨 Module Dependencies

```
app.js
├── map/map-init.js (Azure Maps)
├── overlays/signInActivityOverlay.js
├── overlays/deviceLocationsOverlay.js
├── overlays/threatIntelOverlay.js
├── overlays/threatActorsHeatmap.js
├── ui/panelManager.js
├── ui/threatIntelToggle.js
├── ui/threatActorsToggle.js
├── ui/autoScroll.js
└── shared/demoMode.js
```

## 📝 Coding Standards

- Use ES6+ modules (`import`/`export`)
- Prefer `async`/`await` over `.then()` chains
- Keep functions small and focused
- Add comments for complex logic
- Use descriptive variable names
- Handle errors gracefully with try/catch

## 🧪 Development

All modules can be tested in the browser console after loading `index.html`:

```javascript
// Access map instance
window.map

// Check demo mode
import { isDemoMode } from './shared/demoMode.js';
console.log('Demo mode:', isDemoMode());

// Test overlay visibility
signInActivityOverlay.show();
signInActivityOverlay.hide();
```

## 📦 No Build Required

This application uses:
- **Native ES6 modules** (no bundler needed)
- **Direct Azure Maps CDN** (no npm packages)
- **Static file serving** (no compilation step)

Benefits:
- Faster development (no build step)
- Easier debugging (original source in browser)
- Simple deployment (just copy files)
