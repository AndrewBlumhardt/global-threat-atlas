/* global atlas */

/**
 * Weather Overlay Control
 * Manages radar and infrared weather layers (mutually exclusive)
 */

let radarTileLayer = null;
let infraredTileLayer = null;

/**
 * Toggle weather radar overlay on/off
 * @param {atlas.Map} map - Azure Maps instance
 * @param {boolean} turnOn - Enable or disable weather radar
 * @param {string} subscriptionKey - Azure Maps subscription key
 */
export async function toggleWeatherRadar(map, turnOn, subscriptionKey) {
  if (turnOn) {
    if (radarTileLayer) return; // Already enabled
    
    // Turn off infrared if it's on (mutually exclusive)
    if (infraredTileLayer) {
      await toggleWeatherInfrared(map, false, subscriptionKey);
    }
    
    const tileUrl = `https://atlas.microsoft.com/map/tile?api-version=2022-08-01&tilesetId=microsoft.weather.radar.main&zoom={z}&x={x}&y={y}&subscription-key=${subscriptionKey}`;
    
    radarTileLayer = new atlas.layer.TileLayer({
      tileUrl: tileUrl,
      opacity: 0.9,
      tileSize: 256
    });

    // Add layer on top of everything (no second parameter means topmost)
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
 * @param {string} subscriptionKey - Azure Maps subscription key
 */
export async function toggleWeatherInfrared(map, turnOn, subscriptionKey) {
  if (turnOn) {
    if (infraredTileLayer) return; // Already enabled
    
    // Turn off radar if it's on (mutually exclusive)
    if (radarTileLayer) {
      await toggleWeatherRadar(map, false, subscriptionKey);
    }
    
    const tileUrl = `https://atlas.microsoft.com/map/tile?api-version=2022-08-01&tilesetId=microsoft.weather.infrared.main&zoom={z}&x={x}&y={y}&subscription-key=${subscriptionKey}`;
    
    infraredTileLayer = new atlas.layer.TileLayer({
      tileUrl: tileUrl,
      opacity: 0.9,
      tileSize: 256
    });

    // Add layer on top of everything (no second parameter means topmost)
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
