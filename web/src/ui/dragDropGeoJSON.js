/* global atlas */

/**
 * Drag and Drop GeoJSON File onto Map
 * Allows users to drag GeoJSON files onto the map for visualization
 */

let droppedDataSource = null;
const DROPPED_LAYER_PREFIX = "dropped-geojson-";
let layerCounter = 0;

export function enableDragAndDrop(map) {
  const mapContainer = document.getElementById('map');
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    mapContainer.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop zone on drag over
  ['dragenter', 'dragover'].forEach(eventName => {
    mapContainer.addEventListener(eventName, () => {
      mapContainer.style.outline = '3px dashed #3b82f6';
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    mapContainer.addEventListener(eventName, () => {
      mapContainer.style.outline = 'none';
    }, false);
  });

  // Handle dropped files
  mapContainer.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    
    if (files.length > 0) {
      handleFiles(files, map);
    }
  }, false);
}

function handleFiles(files, map) {
  Array.from(files).forEach(file => {
    if (file.type === 'application/json' || 
        file.type === 'application/geo+json' || 
        file.name.endsWith('.geojson') || 
        file.name.endsWith('.json')) {
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const geojsonData = JSON.parse(e.target.result);
          displayGeoJSON(geojsonData, map, file.name);
          showNotification(`Loaded: ${file.name}`, 'success');
        } catch (error) {
          console.error('Error parsing GeoJSON:', error);
          showNotification(`Error loading ${file.name}: ${error.message}`, 'error');
        }
      };
      
      reader.readAsText(file);
    } else {
      showNotification(`Unsupported file type: ${file.name}. Please drop a GeoJSON file.`, 'error');
    }
  });
}

function displayGeoJSON(geojsonData, map, fileName) {
  // Create a new data source for the dropped file
  const sourceId = `${DROPPED_LAYER_PREFIX}source-${layerCounter}`;
  const dataSource = new atlas.source.DataSource(sourceId);
  map.sources.add(dataSource);
  
  // Add the GeoJSON data to the data source
  dataSource.add(geojsonData);
  
  // Determine the geometry type and add appropriate layers
  const features = dataSource.toJson().features;
  
  if (features.length > 0) {
    const firstGeomType = features[0].geometry.type;
    
    // Add symbol layer for points
    if (firstGeomType === 'Point' || firstGeomType === 'MultiPoint') {
      const bubbleLayer = new atlas.layer.BubbleLayer(dataSource, `${DROPPED_LAYER_PREFIX}bubble-${layerCounter}`, {
        radius: 6,
        color: '#3b82f6',
        strokeColor: '#ffffff',
        strokeWidth: 2,
        opacity: 0.8
      });
      map.layers.add(bubbleLayer);
    }
    
    // Add line layer for lines
    if (firstGeomType.includes('Line')) {
      const lineLayer = new atlas.layer.LineLayer(dataSource, `${DROPPED_LAYER_PREFIX}line-${layerCounter}`, {
        strokeColor: '#3b82f6',
        strokeWidth: 3,
        opacity: 0.8
      });
      map.layers.add(lineLayer);
    }
    
    // Add polygon layer for polygons
    if (firstGeomType.includes('Polygon')) {
      const polygonLayer = new atlas.layer.PolygonLayer(dataSource, `${DROPPED_LAYER_PREFIX}polygon-${layerCounter}`, {
        fillColor: '#3b82f6',
        fillOpacity: 0.4
      });
      
      const outlineLayer = new atlas.layer.LineLayer(dataSource, `${DROPPED_LAYER_PREFIX}outline-${layerCounter}`, {
        strokeColor: '#3b82f6',
        strokeWidth: 2,
        opacity: 0.8
      });
      
      map.layers.add(polygonLayer);
      map.layers.add(outlineLayer);
    }
    
    // Zoom to the data
    const bounds = atlas.data.BoundingBox.fromData(geojsonData);
    map.setCamera({
      bounds: bounds,
      padding: 50
    });
  }
  
  layerCounter++;
  console.log(`Loaded GeoJSON file: ${fileName} with ${features.length} features`);
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.padding = '12px 24px';
  notification.style.borderRadius = '6px';
  notification.style.zIndex = '10000';
  notification.style.fontFamily = 'system-ui, sans-serif';
  notification.style.fontSize = '14px';
  notification.style.fontWeight = '500';
  notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
  notification.style.backdropFilter = 'blur(8px)';
  notification.style.maxWidth = '400px';
  notification.style.textAlign = 'center';
  
  if (type === 'success') {
    notification.style.backgroundColor = 'rgba(34, 197, 94, 0.95)';
    notification.style.color = 'white';
  } else if (type === 'error') {
    notification.style.backgroundColor = 'rgba(239, 68, 68, 0.95)';
    notification.style.color = 'white';
  } else {
    notification.style.backgroundColor = 'rgba(59, 130, 246, 0.95)';
    notification.style.color = 'white';
  }
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s';
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}
