# User Interface Components

Interactive UI controls and panels for the map application.

## 📄 Files

### `panelManager.js`
**Side Panel Management**

Manages the sliding side panel for displaying detailed information.

Export: `PanelManager` class

Features:
- **Slide-in panel**: Animated side panel from right
- **Dynamic content**: HTML content injection
- **Auto-scroll**: Automatically scrolls to show content
- **Close button**: User-dismissible
- **Overlay dimming**: Background darkens when open

Methods:
```javascript
const manager = new PanelManager('panel-container');

// Open panel with content
manager.open('Device Details', '<div>Device info...</div>');

// Close panel
manager.close();

// Check if open
if (manager.isOpen) {
  console.log('Panel is open');
}
```

Usage:
```javascript
// Show device details when marker clicked
deviceMarker.addEventListener('click', (e) => {
  const content = `
    <div class="detail-section">
      <h3>Device: ${device.DeviceName}</h3>
      <p>IP: ${device.PublicIP}</p>
      <p>Location: ${device.City}, ${device.Country}</p>
    </div>
  `;
  panelManager.open('Device Information', content);
});
```

---

### `threatIntelToggle.js`
**Threat Intelligence Layer Toggle**

Controls visibility of threat intelligence indicator overlay.

Export: `initThreatIntelToggle(toggleId, overlay)` function

Features:
- **Layer visibility**: Show/hide threat intel markers
- **Data loading**: Fetches data on first show
- **State persistence**: Remembers on/off state
- **Loading indicator**: Shows loading state during data fetch

Usage:
```javascript
import { initThreatIntelToggle } from './ui/threatIntelToggle.js';

// Initialize toggle control
const toggle = document.getElementById('threat-intel-toggle');
initThreatIntelToggle(toggle.id, threatIntelOverlay);

// Toggle automatically handles show/hide
```

HTML:
```html
<label class="toggle-container">
  <input type="checkbox" id="threat-intel-toggle">
  <span>Threat Intelligence</span>
</label>
```

---

### `threatActorsToggle.js`
**Threat Actors Heatmap Toggle**

Controls visibility of threat actors country heatmap overlay.

Export: `initThreatActorsToggle(toggleId, legendId, showCallback, hideCallback)` function

Features:
- **Heatmap visibility**: Show/hide country shading
- **Legend control**: Show/hide color scale legend
- **Callbacks**: Custom show/hide logic
- **Coordinated UI**: Toggles both map layer and legend

Usage:
```javascript
import { initThreatActorsToggle } from './ui/threatActorsToggle.js';

const toggle = document.getElementById('threat-actors-toggle');
const legend = document.getElementById('heatmap-legend');

initThreatActorsToggle(
  toggle.id,
  legend.id,
  () => showThreatActorsHeatmap(),  // Show callback
  () => hideThreatActorsHeatmap()   // Hide callback
);
```

HTML:
```html
<label class="toggle-container">
  <input type="checkbox" id="threat-actors-toggle">
  <span>Threat Actors by Country</span>
</label>

<div id="heatmap-legend" class="legend" style="display: none;">
  <!-- Color scale -->
</div>
```

---

### `autoScroll.js`
**Automatic Panel Scrolling**

Utility for smooth scrolling to show hidden content in panels.

Export: `autoScrollToShowContent(element)` function

Features:
- **Visibility detection**: Checks if element is in viewport
- **Smooth scroll**: Animated scrolling
- **Container-aware**: Works with scrollable containers
- **Debounced**: Prevents scroll jank

Usage:
```javascript
import { autoScrollToShowContent } from './ui/autoScroll.js';

// After adding content to panel
panelManager.open('Details', content);

// Scroll to show specific element
const element = document.querySelector('.detail-section');
autoScrollToShowContent(element);
```

Common Use Cases:
- Scroll to show threat intel details after panel opens
- Ensure proximity search results are visible
- Auto-scroll to latest event in activity list

---

## 🎨 UI Component Architecture

### Panel System
```
┌─────────────────────────────────┐
│      Map Container              │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │      Azure Maps         │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                  │
│  ┌──────────────────┐           │
│  │ Side Panel       │ ←─────────┤ panelManager.js
│  │ ┌──────────────┐ │           │
│  │ │ Title        │ │           │
│  │ ├──────────────┤ │           │
│  │ │ Content      │ │           │
│  │ │ (scrollable) │ │ ←─────────┤ autoScroll.js
│  │ └──────────────┘ │           │
│  └──────────────────┘           │
└─────────────────────────────────┘
```

### Toggle Controls
```
┌─────────────────────────────────┐
│  Controls Panel                 │
│  ┌──────────────────────────┐   │
│  │ ☑ Sign-In Activity       │   │
│  │ ☑ Device Locations       │   │
│  │ ☑ Threat Intelligence    │ ←─┤ threatIntelToggle.js
│  │ ☑ Threat Actors Heatmap  │ ←─┤ threatActorsToggle.js
│  │ ☐ Demo Mode              │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

## 🔄 Event Flow

### Panel Opening
```
User clicks marker
    ↓
Overlay click handler
    ↓
panelManager.open(title, content)
    ↓
Panel slides in (CSS transition)
    ↓
Content injected into DOM
    ↓
autoScrollToShowContent() if needed
    ↓
User sees details
```

### Toggle Interaction
```
User clicks toggle checkbox
    ↓
Change event listener
    ↓
Check toggle state (checked/unchecked)
    ↓
If checked: overlay.show()
    ↓ Load data
    ↓ Create markers
    ↓ Add to map
If unchecked: overlay.hide()
    ↓ Remove markers
    ↓ Close popup
```

## 📱 Responsive Design

UI components adapt to screen size:
- **Desktop**: Side panel 400px wide
- **Tablet**: Panel 350px, overlays map partially
- **Mobile**: Panel full-width, slides from bottom

CSS media queries handle responsive behavior:
```css
@media (max-width: 768px) {
  .side-panel {
    width: 100%;
    height: 50%;
  }
}
```

## 🎭 State Management

UI components track state:
- **Panel**: Open/closed, current content
- **Toggles**: Layer visibility per overlay
- **Demo mode**: Global app state

State changes trigger UI updates:
```javascript
// Panel state
panelManager.isOpen // boolean

// Toggle state
document.getElementById('toggle').checked // boolean

// Demo mode state
isDemoMode() // boolean
```

## 🧪 Testing

Test UI components in browser console:

```javascript
// Test panel
panelManager.open('Test', '<p>Hello World</p>');
setTimeout(() => panelManager.close(), 3000);

// Test toggle programmatically
const toggle = document.getElementById('threat-intel-toggle');
toggle.checked = true;
toggle.dispatchEvent(new Event('change'));

// Test auto-scroll
const elem = document.querySelector('.detail-section');
autoScrollToShowContent(elem);
```

## 📝 Notes

- All UI components use vanilla JavaScript (no framework)
- CSS transitions for smooth animations
- Event delegation for performance
- Accessible (keyboard navigation, ARIA labels)
- Touch-friendly (larger hit targets on mobile)
