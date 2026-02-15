/* global atlas */

/**
 * Device Locations Overlay
 * Displays last known location for each device from pre-generated GeoJSON
 */

import { getDataUrl } from "../shared/demoMode.js";

const DEVICE_SOURCE_ID = "device-locations-source";
const DEVICE_SYMBOL_LAYER_ID = "device-locations-symbols";

let isEnabled = false;
let map = null;

/**
 * Enable the overlay - fetch and display GeoJSON from blob storage
 */
async function enable(azureMap) {
  console.log("Device locations enable() called, isEnabled =", isEnabled);
  if (isEnabled) return;

  map = azureMap;
  
  try {
    console.log("Loading device locations from API...");

    // Fetch GeoJSON from blob storage via API proxy
    console.log("Fetching from /api/data/device-locations...");
    const response = await fetch(getDataUrl("device-locations"));
    console.log("API response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
      throw new Error(`Failed to load device locations: ${response.status} ${response.statusText}`);
    }
    
    const geojsonData = await response.json();
    console.log("Device locations GeoJSON loaded:", geojsonData.features?.length || 0, "features");
    
    if (!geojsonData.features || geojsonData.features.length === 0) {
      console.warn("No device location features found in GeoJSON");
      return;
    }

    // Create data source
    const dataSource = new atlas.source.DataSource(DEVICE_SOURCE_ID);
    map.sources.add(dataSource);
    console.log("Data source created:", DEVICE_SOURCE_ID);

    // Add GeoJSON data to source
    dataSource.add(geojsonData);
    console.log("GeoJSON added to data source");

    // Create symbol layer for device locations with conditional icons
    // Blue marker (computer icon) for Desktop/Laptop, Green marker (phone icon) for Mobile/Tablet
    const symbolLayer = new atlas.layer.SymbolLayer(dataSource, DEVICE_SYMBOL_LAYER_ID, {
      iconOptions: {
        image: [
          'match',
          ['get', 'DeviceType'],
          ['Mobile', 'Tablet'], 'marker-green',
          'marker-blue'
        ],
        size: 0.8,
        anchor: 'bottom'
      },
      textOptions: {
        textField: ['get', 'DeviceName'],
        offset: [0, -2.5],
        size: 10,
        color: '#1f2937',
        haloColor: '#ffffff',
        haloWidth: 2
      }
    });
    
    map.layers.add(symbolLayer);
    console.log("Symbol layer added:", DEVICE_SYMBOL_LAYER_ID);

    // Add hover popup
    const popup = new atlas.Popup({
      pixelOffset: [0, -30],
      closeButton: false
    });

    map.events.add("mouseover", symbolLayer, (e) => {
      if (e.shapes && e.shapes.length > 0) {
        const props = e.shapes[0].getProperties();
        const coords = e.shapes[0].getCoordinates();
        
        const deviceName = props.DeviceName || "Unknown Device";
        const deviceId = props.DeviceId || "";
        const user = props.UserDisplayName || props.UserPrincipalName || "";
        const city = props.City || "";
        const state = props.State || "";
        const country = props.CountryOrRegion || "";
        const location = [city, state, country].filter(Boolean).join(", ");
        const ip = props.IPAddress || props.PublicIP || "";
        const isMsIP = props.IsMicrosoftIP === true || props.IsMicrosoftIP === "True" || props.IsMicrosoftIP === "true";
        const os = props.OperatingSystem || props.OSPlatform || "";
        const browser = props.Browser || "";
        const isManaged = props.isManaged === "True" || props.isManaged === true;
        const isCompliant = props.isCompliant === "True" || props.isCompliant === true;
        const deviceType = props.DeviceType || "";
        const cloudPlatform = props.CloudPlatform || "";
        const sensorHealth = props.SensorHealthState || "";
        const exposureLevel = props.ExposureLevel || "None";
        const time = props.TimeGenerated ? new Date(props.TimeGenerated).toLocaleString() : "";
        
        // Color coding for exposure level
        const exposureColor = 
          exposureLevel === "High" ? "#ef4444" :
          exposureLevel === "Medium" ? "#f59e0b" :
          exposureLevel === "Low" ? "#10b981" : "#6b7280";
        
        const healthColor = sensorHealth === "Active" ? "#10b981" : "#f59e0b";

        popup.setOptions({
          content: `
            <div style="padding: 12px; min-width: 300px; max-width: 380px; word-wrap: break-word; white-space: normal;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #1f2937;">
                ${deviceName.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
              </div>
              ${user ? `<div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">👤 ${user.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              ${location ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">📍 ${location.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                ${exposureLevel !== "None" ? `<span style="display: inline-block; padding: 3px 8px; background: ${exposureColor}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">
                  ${exposureLevel} Risk
                </span>` : ""}
                ${sensorHealth ? `<span style="display: inline-block; padding: 3px 8px; background: ${healthColor}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">
                  ${sensorHealth}
                </span>` : ""}
                ${isManaged ? `<span style="display: inline-block; padding: 3px 8px; background: #3b82f6; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">Managed</span>` : ""}
                ${isCompliant ? `<span style="display: inline-block; padding: 3px 8px; background: #10b981; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">Compliant</span>` : ""}
                ${isMsIP ? `<span style="display: inline-block; padding: 3px 8px; background: #059669; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">MS IP</span>` : ""}
              </div>
              ${deviceType ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>Type:</strong> ${deviceType.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              ${cloudPlatform ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>Platform:</strong> ${cloudPlatform.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              ${os ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>OS:</strong> ${os.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              ${browser ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>Browser:</strong> ${browser.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              ${ip ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>IP:</strong> ${ip.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              ${deviceId ? `<div style="font-size: 10px; color: #9ca3af; margin-top: 4px; font-family: monospace;">${deviceId.substring(0, 16).replace(/</g, "&lt;").replace(/>/g, "&gt;")}...</div>` : ""}
              ${time ? `<div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">Last seen: ${time.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
            </div>
          `,
          position: coords
        });

        popup.open(map);
      }
    });

    map.events.add("mouseleave", symbolLayer, () => {
      popup.close();
    });

    // Change cursor on hover
    map.events.add("mousemove", symbolLayer, () => {
      map.getCanvasContainer().style.cursor = "pointer";
    });

    map.events.add("mouseleave", symbolLayer, () => {
      map.getCanvasContainer().style.cursor = "grab";
    });

    isEnabled = true;
    console.log("Device locations overlay enabled successfully");

  } catch (error) {
    console.error("Failed to enable device locations overlay:", error);
    alert(`Failed to load device locations data: ${error.message}`);
  }
}

/**
 * Disable the overlay
 */
function disable() {
  console.log("Device locations disable() called, isEnabled =", isEnabled);
  if (!isEnabled || !map) return;

  try {
    // Remove layers
    if (map.layers.getLayerById(DEVICE_SYMBOL_LAYER_ID)) {
      map.layers.remove(DEVICE_SYMBOL_LAYER_ID);
      console.log("Symbol layer removed");
    }

    // Remove data source
    if (map.sources.getById(DEVICE_SOURCE_ID)) {
      map.sources.remove(DEVICE_SOURCE_ID);
      console.log("Data source removed");
    }

    isEnabled = false;
    console.log("Device locations overlay disabled successfully");
  } catch (error) {
    console.error("Error disabling device locations overlay:", error);
  }
}

/**
 * Toggle the overlay on or off
 */
export async function toggleDeviceLocationsOverlay(azureMap, enabled) {
  console.log(`toggleDeviceLocationsOverlay(enabled = ${enabled})`);
  if (enabled) {
    await enable(azureMap);
  } else {
    disable();
  }
}
