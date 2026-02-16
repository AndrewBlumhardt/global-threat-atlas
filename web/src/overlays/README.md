# Map Overlays

Data visualization layers for the Azure Maps instance. Each overlay displays different security data types with interactive markers, popups, and controls.

## 📄 Files

### `signInActivityOverlay.js`
**Azure AD Sign-In Events**

Displays sign-in activity from Azure AD logs with success/failure indicators.

Data Source: `/api/data/signin-activity` (GeoJSON)

Features:
- **Green bubbles**: Successful sign-ins
- **Red bubbles**: Failed sign-ins  
- **Hover popup**: Shows user, app, location, timestamp, result
- **Proximity click**: Find nearby events within 300km
- **Panel display**: Detailed event information

Marker Types:
- Success: 14px green circle (`#10b981`)
- Failure: 14px red circle (`#ef4444`)

---

### `deviceLocationsOverlay.js`
**MDE Device Locations**

Displays Microsoft Defender for Endpoint device inventory by geolocation.

Data Source: `/api/data/device-locations` (GeoJSON)

Features:
- **Blue bubbles**: Desktop/Laptop devices
- **Green bubbles**: Mobile/Tablet devices
- **Hover popup**: Shows device name, OS, IP, status
- **Proximity click**: Find nearby devices within 300km
- **Panel display**: Device details and health status

Marker Types:
- Desktop/Laptop: 14px blue circle (`#3b82f6`)
- Mobile/Tablet: 14px green circle (`#10b981`)

---

### `threatIntelOverlay.js`
**Threat Intelligence Indicators**

Displays threat intelligence indicators (IPs, domains, hashes) with severity ratings.

Data Source: `/api/data/threat-intel-indicators` (GeoJSON)

Features:
- **Color-coded markers**: Severity-based (High/Medium/Low)
- **Hover popup**: Shows indicator value, type, severity, tags
- **VT Search button**: Direct link to VirusTotal analysis
- **Panel display**: Full indicator details with threat information

Marker Colors:
- High severity: Red (`#ef4444`)
- Medium severity: Orange (`#f59e0b`)
- Low severity: Yellow (`#eab308`)
- Unknown: Blue (`#3b82f6`)

---

### `threatActorsHeatmap.js`
**Threat Actor Heatmap by Country**

Displays threat actor activity as a choropleth (color-shaded) country map.

Data Source: `/api/data/threat-actors.tsv` (Tab-separated values)

Features:
- **Color intensity**: Based on threat score (0-100)
- **Country polygons**: Entire countries shaded (not points)
- **Hover popup**: Shows country name and threat score
- **Legend**: Color scale with threat levels

Color Scale:
- 90-100: Dark red (highest threat)
- 70-89: Red
- 50-69: Orange
- 30-49: Yellow
- 0-29: Light yellow (lowest threat)

Implementation:
- Uses Azure Maps Polygon Layer
- Country geometries from Azure Maps data
- TSV data joined with country ISO codes

---

### `customSourceOverlay.js`
**Custom Data Source**

Template overlay for custom data sources configured in sources.yaml.

Data Source: `/api/data/custom-source` (GeoJSON)

Features:
- Generic marker rendering
- Configurable popup fields
- Panel integration
- Toggle control

Purpose:
- Extensibility for new data types
- Template for adding custom visualizations
- No specific data schema required

## 🎯 Overlay Architecture

All overlays follow the same pattern:

```javascript
export class OverlayName {
  constructor(map) {
    this.map = map;
    this.markers = [];
    this.popup = new atlas.Popup({ closeButton: true });
  }
  
  async show() {
    // Load data from API
    const data = await fetch('/api/data/source-name');
    const geojson = await data.json();
    
    // Create markers
    this.markers = geojson.features.map(feature => {
      const marker = new atlas.HtmlMarker({
        position: feature.geometry.coordinates,
        htmlContent: '<div class="marker">...</div>'
      });
      
      // Add hover popup
      marker.addEventListener('mouseover', () => {
        this.popup.setOptions({
          content: this.createPopupContent(feature.properties),
          position: feature.geometry.coordinates
        });
        this.popup.open(this.map);
      });
      
      // Add click handler
      marker.addEventListener('click', () => {
        this.handleClick(feature);
      });
      
      return marker;
    });
    
    // Add to map
    this.markers.forEach(m => this.map.markers.add(m));
  }
  
  hide() {
    // Remove all markers
    this.markers.forEach(m => this.map.markers.remove(m));
    this.markers = [];
    this.popup.close();
  }
}
```

## 🎨 Marker Styles

All overlays use **CSS bubble markers** (not icon templates):

```html
<div style="
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: #10b981;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  pointer-events: auto;
  cursor: pointer;
"></div>
```

Benefits:
- Consistent styling
- No icon template limitations
- Smooth hover/click events
- Custom colors per data type

## 🔄 Data Flow

```
User toggles overlay ON
    ↓
show() method called
    ↓
Fetch GeoJSON from API
    ↓
Parse features array
    ↓
Create HtmlMarker for each feature
    ↓
Attach event listeners (hover, click)
    ↓
Add markers to map
    ↓
User interaction triggers events
    ↓
Events show popups or panels

User toggles overlay OFF
    ↓
hide() method called
    ↓
Remove all markers from map
    ↓
Close popup
    ↓
Clear markers array
```

## 📏 Coordinate Handling

All overlays expect GeoJSON with:
- **Coordinates**: `[longitude, latitude]`
- **Properties**: Data-specific fields
- **Geometry type**: `Point` (except threat actors = `Polygon`)

Example GeoJSON feature:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-93.6208, 41.5908]
  },
  "properties": {
    "DeviceName": "demovm",
    "PublicIP": "172.202.104.182",
    "City": "Des Moines",
    "Country": "US"
  }
}
```

## 🧩 Panel Integration

Most overlays integrate with `panelManager.js` for detailed views:

```javascript
// Show item details in side panel
handleClick(feature) {
  const panelContent = this.createDetailPanel(feature.properties);
  window.panelManager.open('Device Details', panelContent);
}
```

## 🎭 Demo Mode Support

All overlays respect demo mode flag:

```javascript
import { getDataUrl } from '../shared/demoMode.js';

async show() {
  // Automatically adds ?demo=true if demo mode enabled
  const response = await fetch(getDataUrl('device-locations'));
  // ...
}
```

## 📝 Adding New Overlays

1. Create new file: `myOverlay.js`
2. Implement class with `show()` and `hide()` methods
3. Define GeoJSON data source
4. Create marker styling
5. Add hover and click event handlers
6. Import in `app.js`
7. Add toggle control in UI

Template:
```javascript
export class MyOverlay {
  constructor(map) {
    this.map = map;
    this.markers = [];
    this.popup = new atlas.Popup();
  }
  
  async show() {
    const response = await fetch('/api/data/my-data');
    const geojson = await response.json();
    // Create markers...
  }
  
  hide() {
    this.markers.forEach(m => this.map.markers.remove(m));
    this.markers = [];
  }
}
```

## 🧪 Testing

Test overlays in browser console:

```javascript
// Show overlay
await signInActivityOverlay.show();

// Check markers
console.log('Markers:', signInActivityOverlay.markers.length);

// Hide overlay
signInActivityOverlay.hide();

// Test data loading
const resp = await fetch('/api/data/device-locations');
const data = await resp.json();
console.log('Features:', data.features.length);
```
