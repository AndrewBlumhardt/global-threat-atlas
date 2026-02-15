/* global atlas */

/**
 * Weather Overlay Control
 * Allows users to toggle weather layers (radar, infrared)
 */

let weatherTileLayer = null;
let isEnabled = false;
let currentType = 'radar'; // 'radar' or 'infrared'

/**
 * Toggle weather overlay on/off
 * @param {atlas.Map} map - Azure Maps instance
 * @param {boolean} turnOn - Enable or disable weather
 * @param {string} mode - 'radar' or 'infrared'
 */
export async function toggleWeatherOverlay(map, turnOn, mode = 'radar') {
  if (turnOn) {
    if (isEnabled && currentType === mode) return;
    
    // If already enabled with different mode, disable first
    if (isEnabled) {
      disableWeather(map);
    }
    
    currentType = mode;
    enableWeather(map, mode);
    isEnabled = true;
  } else {
    if (!isEnabled) return;
    disableWeather(map);
    isEnabled = false;
  }
}

function enableWeather(map, mode) {
  if (weatherTileLayer) return;

  // Get Azure Maps subscription key
  const authOptions = map.authentication.getOptions();
  const subscriptionKey = authOptions.authType === 'subscriptionKey' 
    ? authOptions.subscriptionKey 
    : authOptions.getToken();
  
  // Azure Maps Weather tile service
  let tilesetId;
  if (mode === 'radar') {
    tilesetId = 'microsoft.weather.radar.main';
  } else if (mode === 'infrared') {
    tilesetId = 'microsoft.weather.infrared.main';
  }
  
  const tileUrl = `https://atlas.microsoft.com/map/tile?api-version=2.0&tilesetId=${tilesetId}&zoom={z}&x={x}&y={y}&subscription-key=${subscriptionKey}`;
  
  weatherTileLayer = new atlas.layer.TileLayer({
    tileUrl: tileUrl,
    opacity: 0.6,
    tileSize: 256
  });

  map.layers.add(weatherTileLayer);
  console.log(`Weather overlay enabled: ${mode}`);
}

function disableWeather(map) {
  if (weatherTileLayer) {
    map.layers.remove(weatherTileLayer);
    weatherTileLayer = null;
    console.log('Weather overlay disabled');
  }
}
