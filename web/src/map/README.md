# Map Initialization

Azure Maps initialization and configuration.

## 📄 Files

### `map-init.js`
**Azure Maps Instance Creation**

Exports:
- `initMap(containerId, subscriptionKey)` - Initialize Azure Maps in a container

Features:
- Creates Azure Maps instance with subscription key
- Configures default view (center, zoom)
- Sets map style (road, night, satellite, etc.)
- Adds standard controls (zoom, pitch, compass)
- Enables camera controls

Example Usage:
```javascript
import { initMap } from './map/map-init.js';

// Initialize map
const map = await initMap('map-container', 'YOUR_SUBSCRIPTION_KEY');

// Map is ready to use
map.events.add('ready', () => {
  console.log('Map loaded and ready');
});
```

## 🗺️ Default Configuration

### View Settings
- **Center**: `[0, 20]` (longitude, latitude) - Africa centered
- **Zoom**: `2` - Global view
- **Style**: `'road'` - Road map style
- **Language**: `'en-US'` - English labels

### Available Styles
- `road` - Standard road map
- `road_shaded_relief` - Roads with terrain
- `satellite` - Satellite imagery
- `satellite_road_labels` - Satellite with road labels
- `night` - Dark theme map
- `grayscale_dark` - Grayscale dark theme
- `grayscale_light` - Grayscale light theme

### Controls Added
- **Zoom Control**: Zoom in/out buttons (top-right)
- **Pitch Control**: Tilt map (3D view)
- **Compass Control**: Reset bearing
- **Style Picker**: Switch map styles

## 🎨 Map Customization

The map can be customized after initialization:

```javascript
const map = await initMap('map-container', key);

// Change view
map.setCamera({
  center: [-98, 39],  // USA center
  zoom: 4,
  duration: 1000      // Animate
});

// Change style
map.setStyle({ style: 'satellite' });

// Add event listener
map.events.add('click', (e) => {
  console.log('Clicked:', e.position);
});
```

## 📦 Azure Maps SDK

Uses Azure Maps Web SDK loaded from CDN:
```html
<script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js"></script>
<link href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.css" rel="stylesheet" />
```

Global object: `window.atlas`

## 🔑 Authentication

Requires Azure Maps subscription key:
1. Create Azure Maps account in Azure Portal
2. Get subscription key from "Authentication" blade
3. Pass key to `initMap()` function

The key is loaded dynamically from `/api/config` endpoint in production.

## 🌍 Coordinate System

Azure Maps uses:
- **Longitude** first (X-axis): -180 to 180
- **Latitude** second (Y-axis): -90 to 90
- **Format**: `[longitude, latitude]`

Common mistake: Many systems use `[lat, lon]`, but Azure Maps uses `[lon, lat]`!

## 🧪 Testing

Test map initialization in browser console:
```javascript
// Check if map loaded
console.log('Map:', window.map);

// Get current camera
const camera = window.map.getCamera();
console.log('Center:', camera.center);
console.log('Zoom:', camera.zoom);

// Test map interaction
window.map.setCamera({ zoom: 10, duration: 2000 });
```

## 📝 Notes

- Map container must have explicit height (CSS: `height: 100vh;`)
- Subscription key must be valid or map won't load
- Wait for `'ready'` event before adding layers/markers
- Map instance stored globally as `window.map` for debugging
