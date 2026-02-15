/* global atlas */

/**
 * Custom Source Overlay
 * Displays custom GeoJSON data from blob storage
 * Expected file naming format: custom-source.geojson
 */

const CUSTOM_SOURCE_ID = "custom-source";
const CUSTOM_BUBBLE_LAYER_ID = "custom-bubble-layer";
const CUSTOM_LINE_LAYER_ID = "custom-line-layer";
const CUSTOM_POLYGON_LAYER_ID = "custom-polygon-layer";

let isEnabled = false;

/**
 * Toggle the custom source overlay on or off
 */
export async function toggleCustomSourceOverlay(map, turnOn) {
  console.log("toggleCustomSourceOverlay called with turnOn =", turnOn);
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
  console.log("enable() called, isEnabled =", isEnabled);
  if (isEnabled) return;

  try {
    console.log("Loading custom source from blob storage...");

    // Fetch GeoJSON from blob storage via API proxy
    // Expected naming format: custom-source.geojson
    console.log("Fetching from /api/data/custom-source...");
    const response = await fetch("/api/data/custom-source");
    console.log("API response status:", response.status, response.statusText);
    
    if (!response.ok) {
      // Try to get error details
      const errorText = await response.text();
      console.error("API error response:", errorText);
      
      let errorMsg = `Custom source not found: ${response.status} ${response.statusText}`;
      
      // Parse error response if JSON
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMsg = errorData.error;
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
    console.log("Custom GeoJSON loaded:", geojson);
    
    if (!geojson.features || geojson.features.length === 0) {
      console.warn("No custom source features found");
      throw new Error("No custom source data available");
    }

    console.log(`Loaded ${geojson.features.length} custom source features`);

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
          content += '<strong>Custom Source</strong><br/>';
          
          // Show all properties
          Object.keys(props).forEach(key => {
            if (key !== 'Shape' && key !== 'geometry') {
              content += `<strong>${key}:</strong> <span style="display:inline;white-space:normal;word-wrap:break-word;">${props[key]}</span><br/>`;
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
      });
    }

    if (geometryTypes.has('LineString') || geometryTypes.has('MultiLineString')) {
      const lineLayer = new atlas.layer.LineLayer(dataSource, CUSTOM_LINE_LAYER_ID, {
        strokeColor: "#9333ea",
        strokeWidth: 2,
        opacity: 0.8
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
    console.log("Custom source overlay enabled");
  } catch (error) {
    console.error("Failed to load custom source:", error);
    alert(`Failed to load custom source:\n\n${error.message}\n\nPlease upload a 'custom-source.geojson' file to blob storage.`);
  }
}

/**
 * Disable the overlay
 */
function disable(map) {
  console.log("disable() called");
  if (!isEnabled) return;

  const dataSource = map.sources.getById(CUSTOM_SOURCE_ID);
  if (dataSource) {
    // Remove layers
    [CUSTOM_BUBBLE_LAYER_ID, CUSTOM_LINE_LAYER_ID, CUSTOM_POLYGON_LAYER_ID].forEach(layerId => {
      const layer = map.layers.getLayerById(layerId);
      if (layer) {
        map.layers.remove(layerId);
      }
    });
    
    // Remove source
    map.sources.remove(dataSource);
  }

  isEnabled = false;
  console.log("Custom source overlay disabled");
}
