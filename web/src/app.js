import { createMap } from "./map/map-init.js";
import { toggleThreatActorsHeatmap } from "./overlays/threatActorsHeatmap.js";
import { toggleThreatIntelOverlay } from "./overlays/threatIntelOverlay.js";
import { toggleSignInActivityOverlay } from "./overlays/signInActivityOverlay.js";
import { toggleDeviceLocationsOverlay } from "./overlays/deviceLocationsOverlay.js";
import { toggleCustomSourceOverlay } from "./overlays/customSourceOverlay.js";
import { toggleDayNightOverlay } from "./overlays/dayNightOverlay.js";
import { toggleWeatherRadar, toggleWeatherInfrared } from "./ui/weatherControl.js";
import { initLayerControl, updateLayerAvailability } from "./ui/layerControl.js";
import { showCountryDetails, initPanelControls } from "./ui/panelManager.js";
import { addAutoScrollControl } from "./ui/autoScroll.js";
import { addDownloadControl } from "./ui/downloadControl.js";
import { enableDragAndDrop } from "./ui/dragDropGeoJSON.js";
import { setDemoMode, getDataUrl, isDemoMode } from "./shared/demoMode.js";
import { lookupAndPlaceIP, clearAllLookups } from "./overlays/ipLookupOverlay.js";

async function main() {
  console.log("Starting Sentinel Activity Maps...");

  // Resolve app config — use the promise started early in index.html (already in-flight)
  // so we don't pay a full round-trip delay here.
  let appConfig = null;
  try {
    const configFetch = window._configPromise ||
      fetch('/api/config').then(r => r.ok ? r.json() : null).catch(() => null);

    // After 5s show a status update so the user knows a cold start is in progress,
    // then keep waiting — the Azure Maps key must come from the API.
    const slowNotice = setTimeout(() => {
      const text = document.querySelector('#loadingOverlay .loading-text');
      if (text) text.textContent = 'Waiting for API (cold start, please wait…)';
    }, 5000);

    appConfig = await configFetch;
    clearTimeout(slowNotice);
    if (appConfig) {
      // Apply custom layer display name if set via app settings
      if (appConfig.customLayerDisplayName) {
        window.CUSTOM_LAYER_DISPLAY_NAME = appConfig.customLayerDisplayName;
      }
      // Apply storage config if returned
      if (appConfig.storageAccountUrl) window.STORAGE_ACCOUNT_URL = appConfig.storageAccountUrl;
      if (appConfig.datasetsContainer) window.DATASETS_CONTAINER = appConfig.datasetsContainer;
    } else {
      console.warn('[config] /api/config returned null or could not be reached, using defaults.');
    }
  } catch (e) {
    console.warn('[config] Could not fetch /api/config, using defaults:', e.message);
  }

  const { map, subscriptionKey } = await createMap({
    containerId: "map",
    initialView: { center: [-20, 25], zoom: 2 },
    style: "road",
    subscriptionKey: appConfig?.azureMapsKey
  });

  map.events.add("ready", () => {
    console.log("Map ready.");
    window.dispatchEvent(new Event('mapReady'));

    // Dismiss the loading overlay now that tiles have rendered
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    
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
        case 'dayNight':
          toggleDayNightOverlay(map, enabled);
          break;
      }
    });
    
    // Mark available layers (all current layers are available)
    updateLayerAvailability('ThreatActors', true);
    updateLayerAvailability('ThreatIntel', true);
    updateLayerAvailability('WeatherRadar', true);
    updateLayerAvailability('WeatherInfrared', true);
    updateLayerAvailability('DayNight', true);
    // Future layers start disabled (enabled when data is available)
    updateLayerAvailability('DeviceLocations', false);
    
    // Check if custom source, sign-in activity, and device locations files exist (in parallel)
    Promise.all([
      checkCustomSourceAvailability(),
      checkSignInActivityAvailability(),
      checkDeviceLocationsAvailability()
    ]);
    
    // Add map controls
    addAutoScrollControl(map);
    addDownloadControl(map);
    
    // Enable drag and drop for GeoJSON files
    enableDragAndDrop(map);

    // --- IP Lookup wiring ---
    const ipCheckbox = document.getElementById('layerIPLookup');
    const ipPanel    = document.getElementById('ipLookupPanel');
    const ipInput    = document.getElementById('ipLookupInput');
    const ipBtn      = document.getElementById('ipLookupBtn');
    const ipStatus   = document.getElementById('ipLookupStatus');

    // Toggle lookup panel when checkbox changes; uncheck clears all pins
    if (ipCheckbox) {
      ipCheckbox.addEventListener('change', () => {
        if (ipPanel) ipPanel.style.display = ipCheckbox.checked ? 'block' : 'none';
        if (!ipCheckbox.checked) {
          clearAllLookups(map);
          if (ipInput)  ipInput.value = '';
          if (ipStatus) ipStatus.textContent = '';
        } else {
          // Focus input when panel opens
          if (ipInput) setTimeout(() => ipInput.focus(), 50);
        }
      });
    }

    function blinkInputRed() {
      if (!ipInput) return;
      ipInput.classList.remove('ip-input-error');
      // Force reflow so re-adding the class restarts the animation
      void ipInput.offsetWidth;
      ipInput.classList.add('ip-input-error');
    }

    // Basic IPv4/IPv6 format check (private/reserved filtered server-side)
    function isPlausibleIP(str) {
      // IPv4: four octets 0-255
      const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
      // IPv6: at least two colons or one :: pattern
      const ipv6 = /^[0-9a-fA-F:]{2,39}$/.test(str) && str.includes(':');
      if (ipv4.test(str)) {
        return str.split('.').every(o => parseInt(o, 10) <= 255);
      }
      return ipv6;
    }

    async function handleIPLookup() {
      const ip = ipInput ? ipInput.value.trim() : '';
      if (!ip) {
        blinkInputRed();
        if (ipStatus) ipStatus.textContent = 'Enter a public IP address.';
        return;
      }
      if (!isPlausibleIP(ip)) {
        blinkInputRed();
        if (ipStatus) ipStatus.textContent = 'Not a valid IP address format.';
        return;
      }
      if (ipStatus) ipStatus.textContent = 'Looking up…';
      if (ipBtn) ipBtn.disabled = true;
      try {
        const result = await lookupAndPlaceIP(map, ip);
        if (result && result.success) {
          if (ipStatus) ipStatus.textContent = result.message || 'Located';
          if (ipInput) ipInput.value = ''; // clear for next entry
        } else {
          blinkInputRed();
          if (ipStatus) ipStatus.textContent = (result && result.message) ? result.message : 'No result';
        }
      } catch (err) {
        blinkInputRed();
        if (ipStatus) ipStatus.textContent = 'Error: ' + (err.message || 'Unknown');
      } finally {
        if (ipBtn) ipBtn.disabled = false;
      }
    }

    if (ipBtn) ipBtn.addEventListener('click', handleIPLookup);
    if (ipInput) {
      ipInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleIPLookup();
      });
      // Remove error highlight once user starts typing again
      ipInput.addEventListener('input', () => ipInput.classList.remove('ip-input-error'));
    }

    // --- Find My IP button ---
    const ipFindBtn = document.getElementById('ipFindMyIPBtn');
    if (ipFindBtn) {
      ipFindBtn.addEventListener('click', async () => {
        if (ipStatus) ipStatus.textContent = 'Detecting your IP…';
        ipFindBtn.disabled = true;
        if (ipBtn) ipBtn.disabled = true;
        try {
          const resp = await fetch('https://api.ipify.org?format=json');
          if (!resp.ok) throw new Error(`ipify returned ${resp.status}`);
          const { ip } = await resp.json();
          if (ipInput) ipInput.value = ip;
          if (ipStatus) ipStatus.textContent = 'Looking up…';
          const result = await lookupAndPlaceIP(map, ip);
          if (result && result.success) {
            if (ipStatus) ipStatus.textContent = result.message || 'Located';
          } else {
            blinkInputRed();
            if (ipStatus) ipStatus.textContent = (result && result.message) ? result.message : 'No result';
          }
        } catch (err) {
          if (ipStatus) ipStatus.textContent = 'Could not detect IP: ' + (err.message || 'Network error');
        } finally {
          ipFindBtn.disabled = false;
          if (ipBtn) ipBtn.disabled = false;
        }
      });
    }

    console.log('All features initialized: auto-scroll, download, weather (radar/infrared), drag-and-drop, IP lookup, Find My IP');
  });

  map.events.add("error", (e) => {
    console.error("Map error:", e);
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      const spinner = loadingOverlay.querySelector('.spinner');
      const text = loadingOverlay.querySelector('.loading-text');
      if (spinner) spinner.style.display = 'none';
      if (text) text.textContent = 'Map failed to load. Check your Azure Maps key or try refreshing.';
    }
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
      // Fallback to Function API
      const fallbackUrl = `/api/data/custom-source.geojson`;
      response = await fetch(fallbackUrl, { method: 'HEAD' });
    }
    const isAvailable = response.ok;
    // Apply custom layer display name if set (from API config or fallback)
    const customLayerDisplayName = window.CUSTOM_LAYER_DISPLAY_NAME || 'Custom Source';
    if (window.updateCustomLayerMenuName) {
      window.updateCustomLayerMenuName(customLayerDisplayName);
    }
    updateLayerAvailability('CustomSource', isAvailable);
  } catch (error) {
    console.error('Custom source not available:', error);
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
      // Fallback to Function API
      const fallbackUrl = `/api/data/signin-activity.geojson`;
      response = await fetch(fallbackUrl, { method: 'HEAD' });
    }
    const isAvailable = response.ok;
    updateLayerAvailability('SignInActivity', isAvailable);
  } catch (error) {
    console.error('Sign-in activity not available:', error);
    updateLayerAvailability('SignInActivity', false);
  }
}

/**
 * Check if device locations file exists in blob storage
 */
async function checkDeviceLocationsAvailability() {
  try {
    // Try direct blob access first
    // Use device-locations.geojson in demo mode, mde-devices.geojson otherwise
    let deviceFile = getDataUrl(isDemoMode() ? "device-locations.geojson" : "mde-devices.geojson");
    let response = await fetch(deviceFile, { method: 'HEAD' });
    if (!response.ok) {
      // Fallback to Function API
      const fallbackUrl = `/api/data/mde-devices.geojson`;
      response = await fetch(fallbackUrl, { method: 'HEAD' });
    }
    const isAvailable = response.ok;
    updateLayerAvailability('DeviceLocations', isAvailable);
  } catch (error) {
    console.error('Device locations not available:', error);
    updateLayerAvailability('DeviceLocations', false);
  }
}

main().catch((e) => {
  console.error("Startup failed:", e?.message || String(e));
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    const spinner = loadingOverlay.querySelector('.spinner');
    const text = loadingOverlay.querySelector('.loading-text');
    if (spinner) spinner.style.display = 'none';
    if (text) text.textContent = e?.message?.includes('subscriptionKey')
      ? 'Azure Maps key not configured. Check app settings and refresh.'
      : 'Failed to start. Check the console for details and try refreshing.';
  }
});
