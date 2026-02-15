/* global atlas */

/**
 * Weather Overlay Control
 * Manages weather overlay with radar/infrared mode selection
 */

let weatherTileLayer = null;
let isEnabled = false;
let currentMode = 'radar';

/**
 * Toggle weather overlay on/off
 * @param {atlas.Map} map - Azure Maps instance
 * @param {boolean} turnOn - Enable or disable weather
 * @param {string} mode - 'radar' or 'infrared'
 */
export async function toggleWeatherOverlay(map, turnOn, mode = 'radar') {
  if (turnOn) {
    // If already enabled with same mode, do nothing
    if (isEnabled && currentMode === mode) return;
    
    // If already enabled with different mode, switch mode
    if (isEnabled && currentMode !== mode) {
      disableWeather(map);
    }
    
    currentMode = mode;
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
  
  const tilesetId = mode === 'radar' 
    ? 'microsoft.weather.radar.main' 
    : 'microsoft.weather.infrared.main';
  
  const tileUrl = `https://atlas.microsoft.com/map/tile?api-version=2022-08-01&tilesetId=${tilesetId}&zoom={z}&x={x}&y={y}&subscription-key=${subscriptionKey}`;
  
  weatherTileLayer = new atlas.layer.TileLayer({
    tileUrl: tileUrl,
    opacity: 0.9,
    tileSize: 256
  });

  // Add layer before labels so weather appears below text labels
  map.layers.add(weatherTileLayer, 'labels');
  console.log(`Weather overlay enabled: ${mode}`);
}

function disableWeather(map) {
  if (weatherTileLayer) {
    map.layers.remove(weatherTileLayer);
    weatherTileLayer = null;
    console.log('Weather overlay disabled');
  }
}
