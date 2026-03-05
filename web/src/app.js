import { createMap } from "./map/map-init.js";
import { toggleThreatActorsHeatmap } from "./overlays/threatActorsHeatmap.js";
import { toggleThreatIntelOverlay } from "./overlays/threatIntelOverlay.js";
import { toggleSignInActivityOverlay } from "./overlays/signInActivityOverlay.js";
import { toggleDeviceLocationsOverlay } from "./overlays/deviceLocationsOverlay.js";
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

  const { map, subscriptionKey } = await createMap({
    containerId: "map",
    initialView: { center: [-20, 25], zoom: 2 },
    style: "road"
  });

  map.events.add("ready", () => {
    console.log("Map ready.");
    window.dispatchEvent(new Event('mapReady'));
    
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
        const deviceLocationsEnabled = document.getElementById('layerDeviceLocations')?.checked;
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
        
        if (deviceLocationsEnabled) {
          await toggleDeviceLocationsOverlay(map, false); // Turn off
          await toggleDeviceLocationsOverlay(map, true); // Turn back on with new data
        }
        
        if (customSourceEnabled) {
          await toggleCustomSourceOverlay(map, false); // Turn off
          await toggleCustomSourceOverlay(map, true); // Turn back on with new data
        }
        
        // Recheck custom source availability
        await checkCustomSourceAvailability();
        await checkDeviceLocationsAvailability();
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
          await toggleWeatherRadar(map, enabled, subscriptionKey);
          break;
        case 'weatherInfrared':
          await toggleWeatherInfrared(map, enabled, subscriptionKey);
          break;
        case 'signInActivity':
          await toggleSignInActivityOverlay(map, enabled);
          break;
        case 'deviceLocations':
          await toggleDeviceLocationsOverlay(map, enabled);
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
    
    // Check if custom source, sign-in activity, and device locations files exist
    checkCustomSourceAvailability();
    checkSignInActivityAvailability();
    checkDeviceLocationsAvailability();
    
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
    // Try direct blob access first
    let response = await fetch(getDataUrl("custom-source.geojson"), { method: 'HEAD' });
    if (!response.ok) {
      console.log('Direct blob access failed, falling back to Function API.');
      // Fallback to Function API
      const fallbackUrl = `/api/data/custom-source.geojson`;
      response = await fetch(fallbackUrl, { method: 'HEAD' });
    }
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
    // Try direct blob access first
    let response = await fetch(getDataUrl("signin-activity.geojson"), { method: 'HEAD' });
    if (!response.ok) {
      console.log('Direct blob access failed, falling back to Function API.');
      // Fallback to Function API
      const fallbackUrl = `/api/data/signin-activity.geojson`;
      response = await fetch(fallbackUrl, { method: 'HEAD' });
    }
    const isAvailable = response.ok;
    console.log(`Sign-in activity file ${isAvailable ? 'found' : 'not found'} - layer ${isAvailable ? 'enabled' : 'disabled'}`);
    updateLayerAvailability('SignInActivity', isAvailable);
  } catch (error) {
    console.log('Sign-in activity not available:', error);
    updateLayerAvailability('SignInActivity', false);
  }
}

/**
 * Check if device locations file exists in blob storage
 */
async function checkDeviceLocationsAvailability() {
  try {
    // Try direct blob access first
    let response = await fetch(getDataUrl("mde-devices.geojson"), { method: 'HEAD' });
    if (!response.ok) {
      console.log('Direct blob access failed, falling back to Function API.');
      // Fallback to Function API
      const fallbackUrl = `/api/data/mde-devices.geojson`;
      response = await fetch(fallbackUrl, { method: 'HEAD' });
    }
    const isAvailable = response.ok;
    console.log(`Device locations file ${isAvailable ? 'found' : 'not found'} - layer ${isAvailable ? 'enabled' : 'disabled'}`);
    updateLayerAvailability('DeviceLocations', isAvailable);
  } catch (error) {
    console.log('Device locations not available:', error);
    updateLayerAvailability('DeviceLocations', false);
  }
}

main().catch((e) => {
  console.error("Startup failed:", e?.message || String(e));
});
