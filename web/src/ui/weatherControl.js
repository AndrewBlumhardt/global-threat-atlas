/* global atlas */

/**
 * Weather Overlay Control
 * Manages radar and infrared weather layers (mutually exclusive).
 *
 * Security note — subscription key in tile URLs:
 * Azure Maps tile requests embed the subscription key as a query parameter
 * (?subscription-key=...).  The key is delivered to the browser via /api/config
 * (never in a static file), but it is visible in browser DevTools network tab
 * while weather layers are active.  This is the standard tradeoff for Maps
 * subscription key auth.  For higher-security deployments, switch to Entra ID
 * (authType: "aad") in map-init.js and request tiles via an authenticated
 * TileLayer with atlas.service.AuthenticationManager — the browser would then
 * receive short-lived tokens instead of the durable subscription key.
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
  } else {
    if (radarTileLayer) {
      map.layers.remove(radarTileLayer);
      radarTileLayer = null;
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
  } else {
    if (infraredTileLayer) {
      map.layers.remove(infraredTileLayer);
      infraredTileLayer = null;
    }
  }
}
