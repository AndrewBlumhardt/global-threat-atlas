/**
 * Download Map as Image Control
 * Allows users to export the current map view as a PNG image
 */

export function addDownloadControl(map) {
  const control = document.createElement("div");
  control.className = "azure-maps-control-container";
  control.style.position = "fixed";
  control.style.bottom = "180px";
  control.style.right = "10px";
  control.style.zIndex = "1000";
  control.style.pointerEvents = "auto";

  const button = document.createElement("button");
  button.className = "azure-maps-control-button";
  button.title = "Download Map Image";
  button.textContent = "📥";
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
    button.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    button.style.borderColor = "rgba(255, 255, 255, 0.5)";
  });

  button.addEventListener("click", () => {
    downloadMapImage(map);
  });

  control.appendChild(button);
  document.body.appendChild(control);
}

/**
 * Download the map as an image
 */
function downloadMapImage(map) {
  map.getCanvas().toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentinel-map-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.click();
    URL.revokeObjectURL(url);
  });
}
