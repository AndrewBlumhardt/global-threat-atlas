/* global atlas */

/**
 * Custom Source Overlay
 * Displays custom GeoJSON data from blob storage
 * Expected file naming format: custom-source.geojson
 */

import { showCustomSourceDetails } from "../ui/panelManager.js";
import { getDataUrl } from "../shared/demoMode.js";

const CUSTOM_SOURCE_ID = "custom-source";
const CUSTOM_BUBBLE_LAYER_ID = "custom-bubble-layer";
const CUSTOM_LINE_LAYER_ID = "custom-line-layer";
const CUSTOM_POLYGON_LAYER_ID = "custom-polygon-layer";

let isEnabled = false;

/**
 * Toggle the custom source overlay on or off
 */
export async function toggleCustomSourceOverlay(map, turnOn) {
  if (turnOn) {
    await enable(map);
  } else {
    disable(map);
  }
}

/**
 * Enable the overlay - fetch and display custom GeoJSON from blob storage
 */
async function enable(map) {
  if (isEnabled) return;

  try {
    const storageAccountUrl = window.STORAGE_ACCOUNT_URL;
    const datasetsContainer = window.DATASETS_CONTAINER;
    if (!storageAccountUrl || !datasetsContainer) {
      console.error('[customSourceOverlay] Missing STORAGE_ACCOUNT_URL or DATASETS_CONTAINER');
      throw new Error('Missing required storage config');
    }
    const dataUrl = getDataUrl('custom-source.geojson');

    let resp;
    try {
      resp = await fetch(dataUrl, { cache: 'no-store' });
    } catch (fetchErr) {
      throw new Error(`Network error fetching custom source: ${fetchErr}`);
    }
    if (!resp.ok) {
      try {
        resp = await fetch('/api/data/custom-source.geojson', { cache: 'no-store' });
      } catch (apiErr) {
        throw new Error(`Network error fetching custom source from API: ${apiErr}`);
      }
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Could not load custom source: ${resp.status} ${resp.statusText}${errorText ? '\n\n' + errorText : ''}`);
      }
    }

    const geojson = await resp.json();

    if (!geojson.features || geojson.features.length === 0) {
      console.warn('[customSourceOverlay] No features found in custom source dataset');
      throw new Error('No custom source data available');
    }

    // Robustly sanitize null numeric properties
    // Only set nulls to 0 for properties that are expected to be numbers
    // This prevents errors in map rendering when numeric values are missing
    geojson.features.forEach(f => {
      if (f.properties) {
        Object.keys(f.properties).forEach(key => {
          if (f.properties[key] === null) {
            // Check if the property is used as a number (common keys: 'value', 'count', 'radius', 'score')
            // Add more keys as needed for your data
            if (["value", "count", "radius", "score"].includes(key)) {
              f.properties[key] = 0;
            }
          }
        });
      }
    });

    console.log(`[customSourceOverlay] Loaded ${geojson.features.length} features from custom-source.geojson`);

    // Create data source
    const dataSource = new atlas.source.DataSource(CUSTOM_SOURCE_ID);
    map.sources.add(dataSource);
    dataSource.add(geojson);

    // Create popup for hover interactions
    const popup = new atlas.Popup({
      pixelOffset: [0, -10],
      closeButton: false
    });

    // Add appropriate layers based on geometry types
    const geometryTypes = new Set(geojson.features.map(f => f.geometry.type));

    if (geometryTypes.has('Point') || geometryTypes.has('MultiPoint')) {
      const bubbleLayer = new atlas.layer.BubbleLayer(dataSource, CUSTOM_BUBBLE_LAYER_ID, {
        radius: 6,
        color: "#9333ea",
        strokeColor: "#c084fc",
        strokeWidth: 1,
        opacity: 0.7
      });
      map.layers.add(bubbleLayer);

      // Add hover popup
      map.events.add("mousemove", bubbleLayer, (e) => {
        if (e.shapes && e.shapes.length > 0) {
          const props = e.shapes[0].getProperties();

          let content = '<div style="padding:10px;width:250px;box-sizing:border-box;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;">';

          // Feature name, falling back to the configured layer display name
          const title = props.name || props.Name || props.title || props.Title || window.CUSTOM_LAYER_DISPLAY_NAME || 'Custom Source';
          const safeTitle = String(title).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          content += `<div style="font-weight:600;font-size:14px;margin-bottom:8px;">${safeTitle}</div>`;
          
          // Location if available
          const city = props.City || props.city || props.location || '';
          const country = props.Country || props.country || '';
          if (city || country) {
            const location = [city, country].filter(Boolean).join(', ');
            const safeLocation = String(location).replace(/</g, '&lt;').replace(/>/g, '&gt;');
            content += `<div style="margin-bottom:8px;"><strong>Location:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;">${safeLocation}</span></div>`;
          }
          
          // Show remaining properties
          Object.keys(props).forEach(key => {
            if (key !== 'Shape' && key !== 'geometry' && 
                key !== 'name' && key !== 'Name' && key !== 'title' && key !== 'Title' &&
                key !== 'City' && key !== 'city' && key !== 'Country' && key !== 'country' && key !== 'location') {
              const safeKey = String(key).replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const safeValue = String(props[key]).replace(/</g, '&lt;').replace(/>/g, '&gt;');
              content += `<div style="font-size:12px;margin-bottom:4px;"><strong>${safeKey}:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;">${safeValue}</span></div>`;
            }
          });
          
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
        map.getCanvasContainer().style.cursor = "grab";
      });
      
      // Change cursor on hover
      map.events.add("mousemove", bubbleLayer, () => {
        map.getCanvasContainer().style.cursor = "pointer";
      });
      
      // Add click event to show nearby items in panel
      map.events.add("click", bubbleLayer, (e) => {
        if (e.shapes && e.shapes.length > 0) {
          const clickedPosition = e.shapes[0].getCoordinates();
          showNearbyCustomItemsPanel(map, clickedPosition, dataSource);
        }
      });
    }

    if (geometryTypes.has('LineString') || geometryTypes.has('MultiLineString')) {
      // Use data-driven styling: read 'stroke' and 'stroke-width' from each feature's properties
      // if present (simplestyle-spec), otherwise fall back to defaults.
      const lineLayer = new atlas.layer.LineLayer(dataSource, CUSTOM_LINE_LAYER_ID, {
        strokeColor: ['coalesce', ['get', 'stroke'], '#9333ea'],
        strokeWidth: ['coalesce', ['get', 'stroke-width'], 2],
        opacity: ['coalesce', ['get', 'stroke-opacity'], 0.8]
      });
      map.layers.add(lineLayer);
    }

    if (geometryTypes.has('Polygon') || geometryTypes.has('MultiPolygon')) {
      const polygonLayer = new atlas.layer.PolygonLayer(dataSource, CUSTOM_POLYGON_LAYER_ID, {
        fillColor: "#9333ea",
        fillOpacity: 0.3,
        strokeColor: "#c084fc",
        strokeWidth: 1
      });
      map.layers.add(polygonLayer);
    }

    isEnabled = true;
  } catch (error) {
    console.error('[customSourceOverlay] Failed to load custom source:', error);
  }
}

/**
 * Disable the overlay
 */
function disable(map) {
  if (!isEnabled) return;

  // Remove all custom source layers
  [CUSTOM_BUBBLE_LAYER_ID, CUSTOM_LINE_LAYER_ID, CUSTOM_POLYGON_LAYER_ID].forEach(layerId => {
    if (map.layers.getLayerById) {
      const layer = map.layers.getLayerById(layerId);
      if (layer) map.layers.remove(layerId);
    }
  });
  // Remove custom source data source
  if (map.sources.getById) {
    const dataSource = map.sources.getById(CUSTOM_SOURCE_ID);
    if (dataSource) map.sources.remove(dataSource);
  }

  isEnabled = false;
}

/**
 * Show nearby custom source items in the left panel when user clicks
 * @param {atlas.Map} map - The map instance
 * @param {atlas.data.Position} position - Click position [lng, lat]
 * @param {atlas.source.DataSource} dataSource - The custom source data source
 */
function showNearbyCustomItemsPanel(map, position, dataSource) {
  const radiusKm = 100; // 100 km radius
  const clickLng = position[0];
  const clickLat = position[1];
  
  // Get all features from data source
  const allFeatures = dataSource.toJson().features;
  
  // Calculate distance and filter nearby items
  const nearbyItems = allFeatures
    .filter(f => f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint')
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
  
  // Create location name from click position
  let locationName = "Selected Area";
  if (nearbyItems.length > 0) {
    const firstItem = nearbyItems[0].properties;
    const city = firstItem.City || firstItem.city || firstItem.location || '';
    const country = firstItem.Country || firstItem.country || '';
    locationName = [city, country].filter(Boolean).join(', ') || "Custom Source Area";
  }
  
  // Show in panel
  showCustomSourceDetails({
    location: locationName,
    count: nearbyItems.length,
    radius: radiusKm,
    items: nearbyItems.map(item => ({
      name: item.properties.name || item.properties.Name || item.properties.title || item.properties.Title || 'Unnamed',
      city: item.properties.City || item.properties.city || item.properties.location || '',
      country: item.properties.Country || item.properties.country || '',
      type: item.properties.type || item.properties.Type || '',
      properties: item.properties,
      distance: Math.round(item.distance * 10) / 10 // Round to 1 decimal
    }))
  });
}

/**
 * Calculate distance between two lat/lng points using Haversine formula
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

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
