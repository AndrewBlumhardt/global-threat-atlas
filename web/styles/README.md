# Styles

CSS stylesheets for the Sentinel Activity Maps application.

## 📄 Files

### `app.css`
**Main Application Stylesheet**

Comprehensive styles for all UI components and map elements.

## 🎨 Style Sections

### Layout & Structure
- **Map container**: Full viewport height, responsive
- **Control panels**: Positioned overlays on map
- **Side panel**: Sliding drawer with animations
- **Responsive grid**: Flexbox layouts

### Map Controls
- **Toggle switches**: Custom checkbox styling with labels
- **Buttons**: Consistent button styles for actions
- **Legends**: Color scales and indicator keys
- **Zoom controls**: Azure Maps control positioning

### Markers & Popups
- **CSS bubbles**: Circular markers with colors
- **Popup styles**: Info window styling
- **Hover effects**: Brightness changes on hover
- **Click feedback**: Scale transitions

### Color Palette
```css
/* Success/Safe */
--success-green: #10b981;

/* Failure/Danger */
--danger-red: #ef4444;

/* Information */
--info-blue: #3b82f6;

/* Warning */
--warning-orange: #f59e0b;
--warning-yellow: #eab308;

/* Neutral */
--gray-light: #f3f4f6;
--gray-dark: #1f2937;
```

### Typography
- **Headings**: `h1-h6` with consistent sizing
- **Body text**: Readable font size (16px base)
- **Monospace**: Code and IP addresses
- **Font stack**: System fonts for performance

### Responsive Breakpoints
```css
/* Mobile: < 768px */
@media (max-width: 767px) { }

/* Tablet: 768px - 1024px */
@media (min-width: 768px) and (max-width: 1024px) { }

/* Desktop: > 1024px */
@media (min-width: 1025px) { }
```

## 🎯 Component Styles

### Side Panel
```css
.side-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 8px rgba(0,0,0,0.2);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  overflow-y: auto;
}

.side-panel.open {
  transform: translateX(0);
}
```

### Toggle Switches
```css
.toggle-container {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

input[type="checkbox"] {
  appearance: none;
  width: 40px;
  height: 20px;
  background: #ddd;
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
}

input[type="checkbox"]:checked {
  background: #10b981;
}

input[type="checkbox"]::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  top: 2px;
  left: 2px;
  transition: transform 0.3s;
}

input[type="checkbox"]:checked::before {
  transform: translateX(20px);
}
```

### Marker Bubbles
```css
.marker-bubble {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  pointer-events: auto;
  cursor: pointer;
  transition: transform 0.2s, filter 0.2s;
}

.marker-bubble:hover {
  transform: scale(1.2);
  filter: brightness(1.1);
}

.marker-bubble.success {
  background-color: #10b981;
}

.marker-bubble.failure {
  background-color: #ef4444;
}

.marker-bubble.device {
  background-color: #3b82f6;
}
```

### Threat Heatmap Legend
```css
.heatmap-legend {
  position: absolute;
  bottom: 30px;
  left: 20px;
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 100;
}

.legend-scale {
  display: flex;
  height: 20px;
  width: 200px;
  border-radius: 4px;
  overflow: hidden;
}

.legend-step {
  flex: 1;
  height: 100%;
}
```

### Detail Panels
```css
.detail-section {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.detail-section h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #1f2937;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
}

.detail-label {
  font-weight: 600;
  color: #6b7280;
}

.detail-value {
  color: #1f2937;
  text-align: right;
}
```

## 🎨 Design System

### Spacing Scale
```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
```

### Border Radius
```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-full: 9999px; /* Circles */
```

### Shadows
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.1);
--shadow-md: 0 2px 4px rgba(0,0,0,0.15);
--shadow-lg: 0 4px 8px rgba(0,0,0,0.2);
--shadow-xl: 0 8px 16px rgba(0,0,0,0.25);
```

### Transitions
```css
--transition-fast: 150ms ease;
--transition-normal: 300ms ease;
--transition-slow: 500ms ease;
```

## 📱 Responsive Adjustments

### Mobile (< 768px)
- Side panel becomes full-width bottom drawer
- Toggle controls stack vertically
- Map controls repositioned to top
- Larger touch targets (44px minimum)

### Tablet (768px - 1024px)
- Side panel width reduced to 350px
- Control panels condensed
- Moderate font size adjustments

### Desktop (> 1024px)
- Full 400px side panel
- Multi-column layouts where applicable
- Hover effects enabled
- Keyboard shortcuts active

## 🌙 Dark Mode Support

(Future enhancement - structure in place)

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1f2937;
    --text-primary: #f3f4f6;
    --border-color: #4b5563;
  }
}
```

## 🧪 Testing Styles

Test CSS in browser DevTools:

```javascript
// Toggle dark mode manually
document.body.classList.toggle('dark-mode');

// Test responsive breakpoints
window.innerWidth // Current viewport width

// Inspect computed styles
const panel = document.querySelector('.side-panel');
getComputedStyle(panel).transform;

// Test animations
panel.classList.add('open');
setTimeout(() => panel.classList.remove('open'), 3000);
```

## 📝 Notes

- Uses CSS custom properties (variables) for theming
- No preprocessor (plain CSS for simplicity)
- Mobile-first responsive design approach
- Accessible contrast ratios (WCAG AA compliant)
- Smooth 60fps animations
- No external CSS frameworks (vanilla CSS only)
