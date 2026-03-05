  console.log("[deviceLocationsOverlay] STORAGE_ACCOUNT_URL:", window.STORAGE_ACCOUNT_URL);
  console.log("[deviceLocationsOverlay] DATASETS_CONTAINER:", window.DATASETS_CONTAINER);
  console.log("[deviceLocationsOverlay] getDataUrl result:", getDataUrl("mde-devices-enriched.tsv"));
/* global atlas */

/**
 * Device Locations Overlay
 * Displays last known location for each device from pre-generated GeoJSON
 */

import { getDataUrl } from "../shared/demoMode.js";
import { showDeviceDetails } from "../ui/panelManager.js";

let isEnabled = false;
let map = null;
let htmlMarkers = [];
let popup = null;

/**
 * Enable the overlay - fetch and display GeoJSON as HTML markers with device icons
 */
async function enable(azureMap) {
  console.log("Device locations enable() called, isEnabled =", isEnabled);
  if (isEnabled) return;

  map = azureMap;
  
  try {
    const storageAccountUrl = window.STORAGE_ACCOUNT_URL;
    const datasetsContainer = window.DATASETS_CONTAINER;
    if (!storageAccountUrl || !datasetsContainer) {
      console.error("Missing STORAGE_ACCOUNT_URL or DATASETS_CONTAINER in global window scope", {
        STORAGE_ACCOUNT_URL: storageAccountUrl,
        DATASETS_CONTAINER: datasetsContainer
      });
      throw new Error("Missing required storage config");
    }
    // Hard-coded Azure Blob Storage URL for device locations (.geojson)
    const dataUrl = "https://sentinelmapsstore.blob.core.windows.net/datasets/mde-devices.geojson";
    console.log(`Loading device locations from blob: ${dataUrl}`);
    let resp;
    try {
      resp = await fetch(dataUrl, { cache: "no-store" });
    } catch (fetchErr) {
      console.error("Fetch error for device locations:", fetchErr);
      throw new Error(`Network error fetching device locations: ${fetchErr}`);
    }
    if (resp.ok) {
      console.log(`Success: Loaded device locations from blob: ${dataUrl}`);
    } else {
      console.error(`Error: Failed to load device locations from blob: ${dataUrl} (status: ${resp.status})`);
      try {
        resp = await fetch("/api/data/mde-devices.geojson", { cache: "no-store" });
      } catch (apiErr) {
        console.error("Function API fetch error for device locations:", apiErr);
        throw new Error(`Network error fetching device locations from API: ${apiErr}`);
      }
      if (resp.ok) {
        console.log("Success: Loaded device locations from Function API fallback.");
      } else {
        const errorText = await resp.text();
        console.error("Failed to load device locations:", errorText);
        throw new Error(`Could not load device locations: ${resp.status} ${resp.statusText}`);
      }
    }

    const geojsonData = await resp.json();
    console.log("Device locations GeoJSON loaded:", geojsonData.features?.length || 0, "features");
    
    if (!geojsonData.features || geojsonData.features.length === 0) {
      console.warn("No device location features found in GeoJSON");
      return;
    }
    
    // Check for duplicate coordinates
    const coordSet = new Set();
    const duplicates = [];
    geojsonData.features.forEach(f => {
      const key = `${f.geometry.coordinates[0]},${f.geometry.coordinates[1]}`;
      if (coordSet.has(key)) {
        duplicates.push(key);
      }
      coordSet.add(key);
    });
    console.log(`Found ${coordSet.size} unique locations out of ${geojsonData.features.length} devices`);
    if (duplicates.length > 0) {
      console.warn(`${duplicates.length} duplicate coordinates detected`);
    }

    // Create popup for hover events
    popup = new atlas.Popup({
      pixelOffset: [0, -30],
      closeButton: false
    });

    // Create HTML markers with simple CSS bubbles
    // Small circles: blue for computers, green for phones
    geojsonData.features.forEach(feature => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      const deviceType = props.DeviceType || '';
      const isMobile = deviceType === 'Mobile' || deviceType === 'Tablet';
      
      // Create simple CSS bubble marker
      const bubbleColor = isMobile ? '#10b981' : '#3b82f6';
      const marker = new atlas.HtmlMarker({
        position: [coords[0], coords[1]],
        htmlContent: `<div class="device-marker" style="width: 14px; height: 14px; border-radius: 50%; background-color: ${bubbleColor}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer; pointer-events: auto;"></div>`,
        anchor: 'center',
        pixelOffset: [0, 0]
      });
      
      // Store properties on the marker element for event handlers
      marker.properties = props;
      marker.coordinates = coords;
      
      // Add hover popup
      map.events.add('mouseover', marker, () => {
        showDevicePopup(marker.properties, marker.coordinates);
      });
      
      map.events.add('mouseleave', marker, () => {
        popup.close();
      });
      
      // Add click handler for proximity search (300km radius)
      map.events.add('click', marker, (e) => {
        if (e && e.originalEvent) {
          e.originalEvent.stopPropagation();
        }
        showNearbyDevicesPanel(map, marker.coordinates, geojsonData.features);
      });
      
      map.markers.add(marker);
      htmlMarkers.push(marker);
    });

    console.log(`Added ${htmlMarkers.length} device markers to map`);
    isEnabled = true;
    console.log("Device locations overlay enabled successfully");

  } catch (error) {
    console.error("Failed to enable device locations overlay:", error);
    alert(`Failed to load device locations data: ${error.message}`);
  }
}

/**
 * Show popup for device marker
 */
function showDevicePopup(props, coords) {
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

/**
 * Disable the overlay
 */
function disable() {
  console.log("Device locations disable() called, isEnabled =", isEnabled);
  if (!isEnabled || !map) return;

  try {
    // Remove all HTML markers
    htmlMarkers.forEach(marker => {
      map.markers.remove(marker);
    });
    htmlMarkers = [];

    if (popup) {
      popup.close();
    }

    isEnabled = false;
    console.log("Device locations overlay disabled successfully");
  } catch (error) {
    console.error("Error disabling device locations overlay:", error);
  }
}

/**
 * Show nearby devices in the left panel when user clicks on the map
 */
function showNearbyDevicesPanel(map, position, allFeatures) {
  const radiusKm = 300; // 300 km radius
  const clickLng = position[0];
  const clickLat = position[1];
  
  // Calculate distances and filter by radius
  const nearbyDevices = allFeatures
    .map(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      const distance = calculateDistance(clickLat, clickLng, lat, lng);
      return {
        distance,
        properties: feature.properties,
        coordinates: feature.geometry.coordinates
      };
    })
    .filter(item => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
  
  // Create location name from click position
  let locationName = "Selected Area";
  if (nearbyDevices.length > 0) {
    const firstDevice = nearbyDevices[0].properties;
    const city = firstDevice.City || '';
    const country = firstDevice.CountryOrRegion || '';
    locationName = [city, country].filter(Boolean).join(', ') || "Unknown Location";
  }
  
  // Get threat intel IPs for correlation (if threat intel layer is active)
  const threatIntelIPs = getThreatIntelIPsForDevices(map, nearbyDevices);
  
  // Show in panel
  showDeviceDetails({
    location: locationName,
    count: nearbyDevices.length,
    radius: radiusKm,
    devices: nearbyDevices.map(item => ({
      name: item.properties.DeviceName || 'Unknown',
      deviceId: item.properties.DeviceId || '',
      deviceType: item.properties.DeviceType || '',
      user: item.properties.UserDisplayName || item.properties.UserPrincipalName || '',
      userPrincipal: item.properties.UserPrincipalName || '',
      ip: item.properties.IPAddress || item.properties.PublicIP || '',
      city: item.properties.City || '',
      country: item.properties.CountryOrRegion || '',
      os: item.properties.OperatingSystem || item.properties.OSPlatform || '',
      browser: item.properties.Browser || '',
      isMsIP: item.properties.IsMicrosoftIP === true || item.properties.IsMicrosoftIP === 'True',
      isCompliant: item.properties.isCompliant === 'True' || item.properties.isCompliant === true,
      isManaged: item.properties.isManaged === 'True' || item.properties.isManaged === true,
      cloudPlatform: item.properties.CloudPlatform || '',
      sensorHealth: item.properties.SensorHealthState || '',
      exposureLevel: item.properties.ExposureLevel || '',
      time: item.properties.TimeGenerated || '',
      distance: Math.round(item.distance * 10) / 10
    })),
    threatIntelIPs
  });
}

/**
 * Get threat intel IPs that match device IPs
 */
function getThreatIntelIPsForDevices(map, devices) {
  try {
    const threatIntelSource = map.sources.getById('threat-intel-source');
    if (!threatIntelSource) return [];
    
    const deviceIPs = new Set(devices.map(d => d.properties.IPAddress || d.properties.PublicIP).filter(Boolean));
    const threatFeatures = threatIntelSource.toJson().features;
    
    return threatFeatures
      .filter(feature => {
        const ip = feature.properties.ObservableValue || feature.properties.observableValue || feature.properties.ip;
        return deviceIPs.has(ip);
      })
      .map(feature => ({
        ip: feature.properties.ObservableValue || feature.properties.observableValue || feature.properties.ip || 'Unknown',
        city: feature.properties.City || feature.properties.city || '',
        country: feature.properties.Country || feature.properties.country || '',
        type: feature.properties.Type || feature.properties.type || '',
        label: feature.properties.Label || feature.properties.label || '',
        confidence: feature.properties.Confidence || feature.properties.confidence || '',
        description: feature.properties.Description || feature.properties.description || ''
      }));
  } catch (e) {
    console.warn('Could not get threat intel IPs:', e);
    return [];
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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
