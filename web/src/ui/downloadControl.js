/**
 * Download Map as Image Control
 * Allows users to export the current map view as a PNG image
 */

export function addDownloadControl(map) {
  const control = document.createElement("div");
  control.className = "azure-maps-control-container";
  control.style.position = "fixed";
  control.style.bottom = "10px";
  control.style.right = "10px";
  control.style.zIndex = "1000";
  control.style.pointerEvents = "auto";

  const button = document.createElement("button");
  button.className = "azure-maps-control-button";
  button.title = "Download Map Image";
  button.textContent = "↓";
  button.style.fontSize = "20px";
  button.style.width = "32px";
  button.style.height = "25px";
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
  try {
    const canvas = map.getCanvas();
    if (!canvas) {
      console.error('Map canvas not found');
      return;
    }
    
    // Use toDataURL as a more reliable method
    const dataURL = canvas.toDataURL('image/png');
    
    // Check if we got valid data
    if (!dataURL || dataURL === 'data:,') {
      console.error('Canvas returned empty data');
      return;
    }
    
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `sentinel-map-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('Map image downloaded successfully');
  } catch (error) {
    console.error('Error downloading map image:', error);
    alert('Failed to download map image. This may be due to cross-origin restrictions.');
  }
}
