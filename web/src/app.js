import { createMap } from "./map/map-init.js";
import { toggleThreatActorsHeatmap } from "./overlays/threatActorsHeatmap.js";
import { toggleThreatIntelOverlay } from "./overlays/threatIntelOverlay.js";
import { toggleCustomSourceOverlay } from "./overlays/customSourceOverlay.js";
import { toggleWeatherRadar, toggleWeatherInfrared } from "./ui/weatherControl.js";
import { initLayerControl, updateLayerAvailability } from "./ui/layerControl.js";
import { showCountryDetails, initPanelControls } from "./ui/panelManager.js";
import { addAutoScrollControl } from "./ui/autoScroll.js";
import { addDownloadControl } from "./ui/downloadControl.js";
import { enableDragAndDrop } from "./ui/dragDropGeoJSON.js";

async function main() {
  console.log("Starting Sentinel Activity Maps...");

  const map = await createMap({
    containerId: "map",
    initialView: { center: [-20, 25], zoom: 2 },
    style: "road"
  });

  map.events.add("ready", () => {
    console.log("Map ready.");
    
    initPanelControls();
    
    // Initialize layer control with toggle callback
    initLayerControl(async (layerType, enabled, mode) => {
      console.log(`Layer toggle: ${layerType} = ${enabled}`, mode);
      
      switch (layerType) {
        case 'threatActors':
          await toggleThreatActorsHeatmap(map, enabled, mode, (countryProps) => {
            showCountryDetails(countryProps);
          });
          break;
        case 'threatIntel':
          await toggleThreatIntelOverlay(map, enabled);
          break;
        case 'weatherRadar':
          await toggleWeatherRadar(map, enabled);
          break;
        case 'weatherInfrared':
          await toggleWeatherInfrared(map, enabled);
          break;
        case 'signInActivity':
          // Future: toggle sign-in activity layer
          console.log('Sign-in activity layer not yet implemented');
          break;
        case 'deviceLocations':
          // Future: toggle device locations layer
          console.log('Device locations layer not yet implemented');
          break;
        case 'customSource':
          await toggleCustomSourceOverlay(map, enabled);
          break;
      }
    });
    
    // Mark available layers (all current layers are available)
    updateLayerAvailability('ThreatActors', true);
    updateLayerAvailability('ThreatIntel', true);
    updateLayerAvailability('WeatherRadar', true);
    updateLayerAvailability('WeatherInfrared', true);
    // Future layers start disabled (enabled when data is available)
    updateLayerAvailability('SignInActivity', false);
    updateLayerAvailability('DeviceLocations', false);
    
    // Check if custom source file exists and enable if available
    checkCustomSourceAvailability();
    
    // Add map controls
    addAutoScrollControl(map);
    addDownloadControl(map);
    
    // Enable drag and drop for GeoJSON files
    enableDragAndDrop(map);
    
    console.log('All features initialized: auto-scroll, download, weather (radar/infrared), drag-and-drop');
  });

  map.events.add("error", (e) => {
    console.error("Map error:", e);
  });
}

/**
 * Check if custom source file exists in blob storage
 */
async function checkCustomSourceAvailability() {
  try {
    const response = await fetch("/api/data/custom-source", { method: 'HEAD' });
    const isAvailable = response.ok;
    console.log(`Custom source file ${isAvailable ? 'found' : 'not found'} - layer ${isAvailable ? 'enabled' : 'disabled'}`);
    updateLayerAvailability('CustomSource', isAvailable);
  } catch (error) {
    console.log('Custom source not available:', error);
    updateLayerAvailability('CustomSource', false);
  }
}

main().catch((e) => {
  console.error("Startup failed:", e?.message || String(e));
});
