/* global atlas */

/**
 * Threat Intel Indicators Overlay
 * Displays threat intelligence indicators from pre-generated GeoJSON
 */

import { showIPDetails } from "../ui/panelManager.js";

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
    console.log("Loading threat intel indicators from API...");

    // Fetch GeoJSON from blob storage via API proxy
    console.log("Fetching from /api/data/threat-intel-indicators...");
    const response = await fetch("/api/data/threat-intel-indicators");
    console.log("API response status:", response.status, response.statusText);
    
    if (!response.ok) {
      // Try to get error details
      const errorText = await response.text();
      console.error("API error response:", errorText);
      
      let errorMsg = `Failed to load threat intel: ${response.status} ${response.statusText}`;
      
      // Parse error response if JSON
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
        
        let content = '<div style="padding:10px;width:250px;box-sizing:border-box;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;">';
        
        // IP Address (prominent)
        if (props.ObservableValue || props.ip) {
          content += `<div style="font-weight:600;font-size:14px;margin-bottom:8px;"><strong>IP:</strong> <span style="display:inline;word-break:break-all;white-space:normal;">${props.ObservableValue || props.ip}</span></div>`;
        }
        
        // Location (City, Country)
        const city = props.City || props.city || '';
        const country = props.Country || props.country || '';
        if (city || country) {
          const location = [city, country].filter(Boolean).join(', ');
          content += `<div style="margin-bottom:8px;"><strong>Location:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;">${location}</span></div>`;
        }
        
        if (props.Type || props.type) {
          content += `<strong>Type:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;">${props.Type || props.type}</span><br/>`;
        }
        
        if (props.count || props.Count) {
          content += `<strong>Count:</strong> ${props.count || props.Count}<br/>`;
        }
        
        if (props.Confidence || props.confidence) {
          content += `<strong>Confidence:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;">${props.Confidence || props.confidence}</span><br/>`;
        }
        
        if (props.Description || props.description) {
          const desc = String(props.Description || props.description);
          content += `<div style="margin-top:4px;font-size:11px;color:#666;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;">${desc}</div>`;
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

  } catch (error) {
    console.error("Error enabling threat intel overlay:", error);
    disable(map);
    throw error;
  }
}

/**
 * Disable the overlay - remove layers and sources
 */
function disable(map) {
  // Remove layer
  try {
    const layer = map.layers.getLayerById(THREAT_INTEL_LAYER_ID);
    if (layer) {
      map.events.remove("mousemove", layer);
      map.events.remove("mouseleave", layer);
      map.layers.remove(THREAT_INTEL_LAYER_ID);
    }
  } catch (e) {
    console.warn("Error removing threat intel layer:", e);
  }

  // Remove source
  try {
    if (map.sources.getById(THREAT_INTEL_SOURCE_ID)) {
      map.sources.remove(THREAT_INTEL_SOURCE_ID);
    }
  } catch (e) {
    console.warn("Error removing threat intel source:", e);
  }

  map.getCanvasContainer().style.cursor = "grab";
  isEnabled = false;
  console.log("Threat intel overlay disabled");
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
      ip: item.properties.ObservableValue || item.properties.ip || 'Unknown',
      city: item.properties.City || item.properties.city || '',
      country: item.properties.Country || item.properties.country || '',
      type: item.properties.Type || item.properties.type || '',
      confidence: item.properties.Confidence || item.properties.confidence || '',
      description: item.properties.Description || item.properties.description || '',
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
