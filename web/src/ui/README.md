# ui

UI controls and panel utilities.

## Files

| File | Description |
|---|---|
| `panelManager.js` | Manages the side panel that shows feature details when a marker is clicked. Includes VirusTotal search links for IP-bearing features. |
| `layerControl.js` | Layer toggle control rendered in the map toolbar. |
| `autoScroll.js` | Auto-scroll control that slowly pans the map camera for unattended wallboard displays. |
| `downloadControl.js` | Screenshot capture control. |
| `dragDropGeoJSON.js` | Drag-and-drop handler for local GeoJSON files onto the map canvas. |
| `threatActorsToggle.js` | Toggle button for the threat actors heatmap layer. |
| `threatIntelToggle.js` | Toggle button for the threat intelligence indicators layer. |
| `weatherControl.js` | Toggle control for weather radar and infrared tile layers. |
| `newsTicker.js` | Cyber News Feed ticker bar fixed to the bottom of the viewport. Fetches up to 5 headlines from `/api/news`, loops them seamlessly, and speeds up when auto-scroll is active. |
