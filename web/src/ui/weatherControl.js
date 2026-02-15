/* global atlas */

/**
 * Weather Overlay Control
 * Manages radar and infrared weather layers independently
 */

let radarTileLayer = null;
let infraredTileLayer = null;

/**
 * Toggle weather radar overlay on/off
 * @param {atlas.Map} map - Azure Maps instance
 * @param {boolean} turnOn - Enable or disable weather radar
 */
export async function toggleWeatherRadar(map, turnOn) {
  if (turnOn) {
    if (radarTileLayer) return; // Already enabled
    
    // Get Azure Maps subscription key
    const authOptions = map.authentication.getOptions();
    const subscriptionKey = authOptions.authType === 'subscriptionKey' 
      ? authOptions.subscriptionKey 
      : authOptions.getToken();
    
    const tilesetId = 'microsoft.weather.radar.main';
    const tileUrl = `https://atlas.microsoft.com/map/tile?api-version=2.0&tilesetId=${tilesetId}&zoom={z}&x={x}&y={y}&subscription-key=${subscriptionKey}`;
    
    radarTileLayer = new atlas.layer.TileLayer({
      tileUrl: tileUrl,
      opacity: 0.6,
      tileSize: 256
    });

    // Add layer on top of everything
    map.layers.add(radarTileLayer);
    console.log('Weather radar enabled');
  } else {
    if (radarTileLayer) {
      map.layers.remove(radarTileLayer);
      radarTileLayer = null;
      console.log('Weather radar disabled');
    }
  }
}

/**
 * Toggle weather infrared overlay on/off
 * @param {atlas.Map} map - Azure Maps instance
 * @param {boolean} turnOn - Enable or disable weather infrared
 */
export async function toggleWeatherInfrared(map, turnOn) {
  if (turnOn) {
    if (infraredTileLayer) return; // Already enabled
    
    // Get Azure Maps subscription key
    const authOptions = map.authentication.getOptions();
    const subscriptionKey = authOptions.authType === 'subscriptionKey' 
      ? authOptions.subscriptionKey 
      : authOptions.getToken();
    
    const tilesetId = 'microsoft.weather.infrared.main';
    const tileUrl = `https://atlas.microsoft.com/map/tile?api-version=2.0&tilesetId=${tilesetId}&zoom={z}&x={x}&y={y}&subscription-key=${subscriptionKey}`;
    
    infraredTileLayer = new atlas.layer.TileLayer({
      tileUrl: tileUrl,
      opacity: 0.6,
      tileSize: 256
    });

    // Add layer on top of everything
    map.layers.add(infraredTileLayer);
    console.log('Weather infrared enabled');
  } else {
    if (infraredTileLayer) {
      map.layers.remove(infraredTileLayer);
      infraredTileLayer = null;
      console.log('Weather infrared disabled');
    }
  }
}
