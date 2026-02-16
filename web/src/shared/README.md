# Shared Utilities

Common utilities and state management shared across the application.

## 📄 Files

### `demoMode.js`
**Demo Mode State Management**

Manages application demo mode state and data URL routing.

Exports:
- `isDemoMode()` - Get current demo mode state (boolean)
- `setDemoMode(enabled)` - Set demo mode on/off
- `getDataUrl(filename)` - Build API URL with demo parameter

Features:
- **Global state**: Tracks demo mode for entire application
- **URL parameter**: Automatically adds `?demo=true` to API requests
- **Data routing**: Routes to `demo_data/` folder in blob storage

## 🎯 Purpose

Demo mode allows switching between:
- **Live data**: Real Sentinel query results (production)
- **Demo data**: Pre-generated sample data (testing/demo)

Without redeploying or changing code.

## 🔧 Usage

### Initialize Demo Mode

```javascript
import { setDemoMode, isDemoMode } from './shared/demoMode.js';

// Enable demo mode
setDemoMode(true);
console.log('Demo mode:', isDemoMode()); // true

// Disable demo mode  
setDemoMode(false);
console.log('Demo mode:', isDemoMode()); // false
```

### Build Data URLs

```javascript
import { getDataUrl } from './shared/demoMode.js';

// Demo mode OFF
const url1 = getDataUrl('device-locations');
// Returns: "/api/data/device-locations"

// Demo mode ON
setDemoMode(true);
const url2 = getDataUrl('device-locations');
// Returns: "/api/data/device-locations?demo=true"
```

### In Overlays

All overlays use `getDataUrl()` to load data:

```javascript
import { getDataUrl } from '../shared/demoMode.js';

export class DeviceLocationsOverlay {
  async show() {
    // Automatically respects demo mode
    const response = await fetch(getDataUrl('device-locations'));
    const geojson = await response.json();
    // ...
  }
}
```

## 🗂️ Data Routing

### Normal Mode (demo=false)
```
Frontend: /api/data/device-locations
    ↓
API: datasets/device-locations.geojson
    ↓
Live Sentinel data (refreshed periodically)
```

### Demo Mode (demo=true)
```
Frontend: /api/data/device-locations?demo=true
    ↓
API: datasets/demo_data/device-locations.geojson
    ↓
Static sample data (500 pre-generated records)
```

## 🎮 User Control

Demo mode toggle in UI:

```javascript
// Toggle button event
document.getElementById('demo-toggle').addEventListener('change', (e) => {
  setDemoMode(e.target.checked);
  
  // Refresh all overlays with new data
  if (e.target.checked) {
    reloadAllOverlays(); // Load demo data
  } else {
    reloadAllOverlays(); // Load live data
  }
});
```

## 📊 Demo Data Characteristics

Demo data files:
- **500 records** per data source
- **Global distribution**: 50+ cities worldwide
- **Realistic patterns**: Weighted by region (45% US, 30% EU, 25% other)
- **Coordinate variance**: ±0.1° to avoid stacking

Ensures proper visualization testing without live Sentinel access.

## 🔒 State Persistence

Demo mode state is:
- **Not persisted**: Resets on page reload
- **URL-based**: Could be enhanced to check URL parameter: `?demo=true`
- **Session-only**: No localStorage or cookies

To make persistent across reloads:

```javascript
// Save to localStorage
export function setDemoMode(enabled) {
  demoMode = enabled;
  localStorage.setItem('demoMode', enabled);
  console.log(`Demo mode ${enabled ? 'enabled' : 'disabled'}`);
}

// Restore on load
const savedMode = localStorage.getItem('demoMode') === 'true';
setDemoMode(savedMode);
```

## 🧪 Testing

Test demo mode in browser console:

```javascript
// Check current state
import { isDemoMode } from './shared/demoMode.js';
console.log('Demo:', isDemoMode());

// Toggle mode
import { setDemoMode } from './shared/demoMode.js';
setDemoMode(true);

// Test URL building
import { getDataUrl } from './shared/demoMode.js';
console.log(getDataUrl('threat-intel-indicators'));

// Verify API response
const url = getDataUrl('device-locations');
const resp = await fetch(url);
const data = await resp.json();
console.log('Features:', data.features.length);
```

## 📝 Notes

- Demo mode affects **all overlays** simultaneously
- Data shape (GeoJSON structure) identical for demo and live data
- API backend handles `?demo=true` parameter transparently
- No code changes needed in overlays to support demo mode
