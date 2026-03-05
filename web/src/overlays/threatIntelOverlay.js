/* global atlas */

/**
 * Threat Intel Indicators Overlay
 * Displays threat intelligence indicators from pre-generated GeoJSON
 */

import { showIPDetails } from "../ui/panelManager.js";
import { getDataUrl } from "../shared/demoMode.js";

const THREAT_INTEL_SOURCE_ID = "threat-intel-source";
const THREAT_INTEL_LAYER_ID = "threat-intel-layer";

let isEnabled = false;

/**
 * Toggle the threat intel overlay on or off
 */
export async function toggleThreatIntelOverlay(map, turnOn) {
  console.log("toggleThreatIntelOverlay called with turnOn =", turnOn);
  if (turnOn) {
    await enable(map);
  } else {
    disable(map);
  }
}

/**
 * Enable the overlay - fetch and display GeoJSON from blob storage
 */
async function enable(map) {
  console.log("enable() called, isEnabled =", isEnabled);
  if (isEnabled) return;

  try {
    const storageAccountUrl = window.env?.STORAGE_ACCOUNT_URL;
    const datasetsContainer = window.env?.DATASETS_CONTAINER;
    if (!storageAccountUrl || !datasetsContainer) {
      console.error("Missing STORAGE_ACCOUNT_URL or DATASETS_CONTAINER in window.env");
      throw new Error("Missing required storage config");
    }
    const blobPath = `${storageAccountUrl}/${datasetsContainer}/threat-intel-indicators`;
    console.log(`Loading threat intel indicators from blob: ${blobPath}`);
    let response = await fetch(getDataUrl("threat-intel-indicators"));
    if (response.ok) {
      console.log(`Success: Loaded threat intel indicators from blob: ${blobPath}`);
    } else {
      console.error(`Error: Failed to load threat intel indicators from blob: ${blobPath} (status: ${response.status})`);
      // Fallback to Function API
      response = await fetch("/api/data/threat-intel-indicators");
      if (response.ok) {
        console.log("Success: Loaded threat intel indicators from Function API fallback.");
      } else {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        let errorMsg = `Failed to load threat intel: ${response.status} ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMsg = errorData.error;
          }
          if (errorData.available_files) {
            console.log("Available files in blob storage:", errorData.available_files);
            errorMsg += `\n\nAvailable files: ${errorData.available_files.join(", ")}`;
          }
        } catch (e) {
          // Not JSON, use text
          if (errorText) {
            errorMsg += `\n\n${errorText}`;
          }
        }
        throw new Error(errorMsg);
      }
    }

    const geojson = await response.json();
    console.log("GeoJSON loaded:", geojson);

    if (!geojson.features || geojson.features.length === 0) {
      console.warn("No threat intel indicators found");
      throw new Error("No threat intelligence indicators available");
    }

    console.log(`Loaded ${geojson.features.length} threat intel indicators`);

    // Create data source
    const dataSource = new atlas.source.DataSource(THREAT_INTEL_SOURCE_ID);
    map.sources.add(dataSource);
    dataSource.add(geojson);

    // Find max for color scaling
    const counts = geojson.features
      .map(f => f.properties?.count || f.properties?.Count || 1)
      .filter(c => typeof c === 'number' && !isNaN(c));
    const maxCount = counts.length > 0 ? Math.max(...counts) : 1;

    console.log(`Threat intel count range: 1 to ${maxCount}`);

    // Add symbol layer for indicators (peg-like markers with 3D effect)
    // Use smaller, more dimensional visualization
    const bubbleLayer = new atlas.layer.BubbleLayer(dataSource, THREAT_INTEL_LAYER_ID, {
      radius: 4,
      color: "#e51010",
      strokeColor: "#eb6060",
      strokeWidth: 1,
      opacity: 0.7,
      pitchAlignment: "map"
    });

        map.layers.add(bubbleLayer);

        // Create popup for hover interactions
        const popup = new atlas.Popup({
          pixelOffset: [0, -10],
          closeButton: false
        });

        // Show details on hover
        map.events.add("mousemove", bubbleLayer, (e) => {
          if (e.shapes && e.shapes.length > 0) {
            const props = e.shapes[0].getProperties();

            let content = '<div style="padding:10px;width:280px;box-sizing:border-box;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;">';

            // IP Address (prominent)
            if (props.ObservableValue || props.observableValue || props.ip) {
              const ip = props.ObservableValue || props.observableValue || props.ip;
              content += `<div style="font-weight:600;font-size:14px;margin-bottom:8px;"><strong>IP:</strong> <span style="display:inline;word-break:break-all;white-space:normal;">${ip}</span></div>`;
            }

            // Location (City, Country)
            const city = props.City || props.city || '';
            const country = props.Country || props.country || '';
            if (city || country) {
              const location = [city, country].filter(Boolean).join(', ');
              content += `<div style="margin-bottom:6px;"><strong>Location:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;">${location}</span></div>`;
            }

            // Type
            if (props.Type || props.type) {
              content += `<div style="margin-bottom:4px;"><strong>Type:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;">${props.Type || props.type}</span></div>`;
            }

            // Label
            if (props.Label || props.label) {
              content += `<div style="margin-bottom:4px;"><strong>Label:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;">${props.Label || props.label}</span></div>`;
            }

            // Confidence
            if (props.Confidence || props.confidence) {
              content += `<div style="margin-bottom:4px;"><strong>Confidence:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;">${props.Confidence || props.confidence}</span></div>`;
            }

            // Description
            if (props.Description || props.description) {
              const desc = String(props.Description || props.description);
              content += `<div style="margin-top:6px;margin-bottom:6px;font-size:12px;color:#666;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;">${desc}</div>`;
            }

            // Source System
            if (props.SourceSystem || props.sourceSystem) {
              content += `<div style="font-size:11px;color:#888;margin-bottom:4px;"><strong>Source:</strong> <span style="display:inline;white-space:normal;">${props.SourceSystem || props.sourceSystem}</span></div>`;
            }

            // Created date
            if (props.Created || props.created) {
              const created = props.Created || props.created;
              const dateStr = new Date(created).toLocaleString();
              content += `<div style="font-size:11px;color:#888;"><strong>Created:</strong> <span style="display:inline;white-space:normal;">${dateStr}</span></div>`;
            }

            content += '</div>';

            popup.setOptions({
              content: content,
              position: e.shapes[0].getCoordinates()
            });
            popup.open(map);
          }
        });

        map.events.add("mouseleave", bubbleLayer, () => {
          popup.close();
        });

        // Change cursor on hover
        map.events.add("mousemove", bubbleLayer, () => {
          map.getCanvasContainer().style.cursor = "pointer";
        });

        map.events.add("mouseleave", bubbleLayer, () => {
          map.getCanvasContainer().style.cursor = "grab";
        });

        // Add click event to show nearby IPs in panel
        map.events.add("click", bubbleLayer, (e) => {
          if (e.shapes && e.shapes.length > 0) {
            const clickedPosition = e.shapes[0].getCoordinates();
            showNearbyIPsPanel(map, clickedPosition, dataSource);
          }
        });

        isEnabled = true;
        console.log("Threat intel overlay enabled");
  try {
    if (map.layers.getById(THREAT_INTEL_LAYER_ID)) {
      map.layers.remove(THREAT_INTEL_LAYER_ID);
    }
    if (map.sources.getById(THREAT_INTEL_SOURCE_ID)) {
      map.sources.remove(THREAT_INTEL_SOURCE_ID);
    }
    map.getCanvasContainer().style.cursor = "grab";
    isEnabled = false;
    console.log("Threat intel overlay disabled");
  } catch (error) {
    console.error("Error disabling threat intel overlay:", error);
  }
}

/**
 * Show nearby IPs in the left panel when user clicks on the map
 * @param {atlas.Map} map - The map instance
 * @param {atlas.data.Position} position - Click position [lng, lat]
 * @param {atlas.source.DataSource} dataSource - The threat intel data source
 */
function showNearbyIPsPanel(map, position, dataSource) {
  const radiusKm = 100; // 100 km radius
  const clickLng = position[0];
  const clickLat = position[1];
  
  // Get all features from data source
  const allFeatures = dataSource.toJson().features;
  
  // Calculate distance and filter nearby IPs
  const nearbyIPs = allFeatures
    .map(feature => {
      const coords = feature.geometry.coordinates;
      const distance = calculateDistance(clickLat, clickLng, coords[1], coords[0]);
      return {
        feature: feature,
        distance: distance,
        properties: feature.properties
      };
    })
    .filter(item => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
  
  // Create location name from click position (use first nearby IP's location if available)
  let locationName = "Selected Area";
  if (nearbyIPs.length > 0) {
    const firstIP = nearbyIPs[0].properties;
    const city = firstIP.City || firstIP.city || '';
    const country = firstIP.Country || firstIP.country || '';
    locationName = [city, country].filter(Boolean).join(', ') || "Unknown Location";
  }
  
  // Show in panel
  showIPDetails({
    location: locationName,
    count: nearbyIPs.length,
    radius: radiusKm,
    ips: nearbyIPs.map(item => ({
      ip: item.properties.ObservableValue || item.properties.observableValue || item.properties.ip || 'Unknown',
      city: item.properties.City || item.properties.city || '',
      country: item.properties.Country || item.properties.country || '',
      type: item.properties.Type || item.properties.type || '',
      label: item.properties.Label || item.properties.label || '',
      confidence: item.properties.Confidence || item.properties.confidence || '',
      description: item.properties.Description || item.properties.description || '',
      sourceSystem: item.properties.SourceSystem || item.properties.sourceSystem || '',
      created: item.properties.Created || item.properties.created || '',
      distance: Math.round(item.distance * 10) / 10 // Round to 1 decimal
    }))
  });
}

/**
 * Calculate distance between two lat/lng points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
