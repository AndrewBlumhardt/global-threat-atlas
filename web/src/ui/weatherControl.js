/* global atlas */

/**
 * Weather Overlay Control
 * Allows users to toggle weather layers (radar, infrared)
 */

let weatherTileLayer = null;
let isEnabled = false;
let currentType = 'radar'; // 'radar' or 'infrared'

export function addWeatherControl(map) {
  const control = document.createElement("div");
  control.className = "azure-maps-control-container";
  control.style.position = "fixed";
  control.style.bottom = "215px";
  control.style.right = "10px";
  control.style.zIndex = "1000";
  control.style.pointerEvents = "auto";

  const button = document.createElement("button");
  button.className = "azure-maps-control-button";
  button.title = "Toggle Weather Overlay";
  button.textContent = "🌦️";
  button.style.fontSize = "20px";
  button.style.width = "32px";
  button.style.height = "32px";
  button.style.padding = "0";
  button.style.border = "2px solid rgba(255, 255, 255, 0.5)";
  button.style.borderRadius = "4px";
  button.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
  button.style.color = "#333";
  button.style.cursor = "pointer";
  button.style.transition = "all 0.2s";

  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "rgba(255, 255, 255, 1)";
    button.style.borderColor = "rgba(0, 123, 255, 0.8)";
  });

  button.addEventListener("mouseleave", () => {
    if (!isEnabled) {
      button.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
      button.style.borderColor = "rgba(255, 255, 255, 0.5)";
    }
  });

  button.addEventListener("click", () => {
    isEnabled = !isEnabled;
    
    if (isEnabled) {
      button.style.backgroundColor = "rgba(0, 123, 255, 0.9)";
      button.style.color = "#fff";
      button.style.borderColor = "rgba(0, 123, 255, 1)";
      enableWeather(map);
    } else {
      button.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
      button.style.color = "#333";
      button.style.borderColor = "rgba(255, 255, 255, 0.5)";
      disableWeather(map);
    }
  });

  control.appendChild(button);
  document.body.appendChild(control);
}

function enableWeather(map) {
  if (weatherTileLayer) return;

  // Get Azure Maps subscription key from map's auth options
  const subscriptionKey = map.authentication.getToken();
  
  // Azure Maps Weather Radar tile service
  const tileUrl = `https://atlas.microsoft.com/map/tile?api-version=2.0&tilesetId=microsoft.weather.radar.main&zoom={z}&x={x}&y={y}&subscription-key=${subscriptionKey}`;
  
  weatherTileLayer = new atlas.layer.TileLayer({
    tileUrl: tileUrl,
    opacity: 0.6,
    tileSize: 256
  });

  map.layers.add(weatherTileLayer);
  console.log('Weather overlay enabled');
}

function disableWeather(map) {
  if (weatherTileLayer) {
    map.layers.remove(weatherTileLayer);
    weatherTileLayer = null;
    console.log('Weather overlay disabled');
  }
}
