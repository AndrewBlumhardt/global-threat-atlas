import { createMap } from "./map/map-init.js";
import { toggleThreatActorsHeatmap } from "./overlays/threatActorsHeatmap.js";
import { toggleThreatIntelOverlay } from "./overlays/threatIntelOverlay.js";
import { toggleSignInActivityOverlay } from "./overlays/signInActivityOverlay.js";
import { toggleCustomSourceOverlay } from "./overlays/customSourceOverlay.js";
import { toggleWeatherRadar, toggleWeatherInfrared } from "./ui/weatherControl.js";
import { initLayerControl, updateLayerAvailability } from "./ui/layerControl.js";
import { showCountryDetails, initPanelControls } from "./ui/panelManager.js";
import { addAutoScrollControl } from "./ui/autoScroll.js";
import { addDownloadControl } from "./ui/downloadControl.js";
import { enableDragAndDrop } from "./ui/dragDropGeoJSON.js";
import { setDemoMode, getDataUrl } from "./shared/demoMode.js";

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
    
    // Initialize demo mode toggle
    const demoToggle = document.getElementById('demoModeToggle');
    if (demoToggle) {
      demoToggle.addEventListener('change', async (e) => {
        const isDemoEnabled = e.target.checked;
        setDemoMode(isDemoEnabled);
        console.log(`Demo mode ${isDemoEnabled ? 'enabled' : 'disabled'} - reloading layers...`);
        
        // Get current layer states
        const threatActorsEnabled = document.getElementById('layerThreatActors')?.checked;
        const threatIntelEnabled = document.getElementById('layerThreatIntel')?.checked;
        const signInActivityEnabled = document.getElementById('layerSignInActivity')?.checked;
        const customSourceEnabled = document.getElementById('layerCustomSource')?.checked;
        
        // Get current threat actors mode
        const activeMode = document.querySelector('.ta-mode-btn.active')?.getAttribute('data-mode') || 'heatmap';
        
        // Reload enabled layers with new data source
        if (threatActorsEnabled) {
          await toggleThreatActorsHeatmap(map, false); // Turn off
          await toggleThreatActorsHeatmap(map, true, activeMode, (countryProps) => {
            showCountryDetails(countryProps);
          }); // Turn back on with new data
        }
        
        if (threatIntelEnabled) {
          await toggleThreatIntelOverlay(map, false); // Turn off
          await toggleThreatIntelOverlay(map, true); // Turn back on with new data
        }
        
        if (signInActivityEnabled) {
          await toggleSignInActivityOverlay(map, false); // Turn off
          await toggleSignInActivityOverlay(map, true); // Turn back on with new data
        }
        
        if (customSourceEnabled) {
          await toggleCustomSourceOverlay(map, false); // Turn off
          await toggleCustomSourceOverlay(map, true); // Turn back on with new data
        }
        
        // Recheck custom source availability
        await checkCustomSourceAvailability();
      });
    }
    
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
          await toggleSignInActivityOverlay(map, enabled);
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
    updateLayerAvailability('DeviceLocations', false);
    
    // Check if custom source and sign-in activity files exist
    checkCustomSourceAvailability();
    checkSignInActivityAvailability();
    
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
    const response = await fetch(getDataUrl("custom-source"), { method: 'HEAD' });
    const isAvailable = response.ok;
    console.log(`Custom source file ${isAvailable ? 'found' : 'not found'} - layer ${isAvailable ? 'enabled' : 'disabled'}`);
    updateLayerAvailability('CustomSource', isAvailable);
  } catch (error) {
    console.log('Custom source not available:', error);
    updateLayerAvailability('CustomSource', false);
  }
}

/**
 * Check if sign-in activity file exists in blob storage
 */
async function checkSignInActivityAvailability() {
  try {
    const response = await fetch(getDataUrl("signin-activity"), { method: 'HEAD' });
    const isAvailable = response.ok;
    console.log(`Sign-in activity file ${isAvailable ? 'found' : 'not found'} - layer ${isAvailable ? 'enabled' : 'disabled'}`);
    updateLayerAvailability('SignInActivity', isAvailable);
  } catch (error) {
    console.log('Sign-in activity not available:', error);
    updateLayerAvailability('SignInActivity', false);
  }
}

main().catch((e) => {
  console.error("Startup failed:", e?.message || String(e));
});
