/* global atlas */

/**
 * Sign-In Activity Overlay
 * Displays sign-in activity events from pre-generated GeoJSON
 */

import { getDataUrl } from "../shared/demoMode.js";

const SIGNIN_SOURCE_ID = "signin-activity-source";
const SIGNIN_BUBBLE_LAYER_ID = "signin-activity-bubbles";

let isEnabled = false;
let map = null;

/**
 * Enable the overlay - fetch and display GeoJSON from blob storage
 */
async function enable(azureMap) {
  console.log("enable() called, isEnabled =", isEnabled);
  if (isEnabled) return;

  map = azureMap;
  
  try {
    console.log("Loading sign-in activity from API...");

    // Fetch GeoJSON from blob storage via API proxy
    console.log("Fetching from /api/data/signin-activity...");
    const response = await fetch(getDataUrl("signin-activity"));
    console.log("API response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
      throw new Error(`Failed to load sign-in activity: ${response.status} ${response.statusText}`);
    }
    
    const geojsonData = await response.json();
    console.log("Sign-in activity GeoJSON loaded:", geojsonData.features?.length || 0, "features");
    
    if (!geojsonData.features || geojsonData.features.length === 0) {
      console.warn("No sign-in activity features found in GeoJSON");
      return;
    }

    // Create data source
    const dataSource = new atlas.source.DataSource(SIGNIN_SOURCE_ID);
    map.sources.add(dataSource);
    console.log("Data source created:", SIGNIN_SOURCE_ID);

    // Add GeoJSON data to source
    dataSource.add(geojsonData);
    console.log("GeoJSON added to data source");

    // Create bubble layer for sign-in locations
    const bubbleLayer = new atlas.layer.BubbleLayer(dataSource, SIGNIN_BUBBLE_LAYER_ID, {
      radius: 8,
      color: [
        'case',
        ['==', ['get', 'ResultSignature'], 'SUCCESS'], '#10b981', // Green for success
        '#ef4444' // Red for failures
      ],
      strokeColor: '#fff',
      strokeWidth: 2,
      opacity: 0.8,
      blur: 0.4
    });
    
    map.layers.add(bubbleLayer);
    console.log("Bubble layer added:", SIGNIN_BUBBLE_LAYER_ID);

    // Add hover popup
    const popup = new atlas.Popup({
      pixelOffset: [0, -10],
      closeButton: false
    });

    map.events.add("mouseover", bubbleLayer, (e) => {
      if (e.shapes && e.shapes.length > 0) {
        const props = e.shapes[0].getProperties();
        const coords = e.shapes[0].getCoordinates();
        
        const user = props.UserDisplayName || props.UserPrincipalName || "Unknown User";
        const city = props.City || "";
        const state = props.State || "";
        const country = props.CountryOrRegion || "";
        const location = [city, state, country].filter(Boolean).join(", ");
        const status = props.ResultSignature || "Unknown";
        const ip = props.IPAddress || "";
        const browser = props.Browser || "";
        const os = props.OperatingSystem || "";
        const device = props.isManaged === "True" ? "Managed" : (props.isCompliant === "True" ? "Compliant" : "Unmanaged");
        const risk = props.RiskState || "none";
        const time = props.TimeGenerated ? new Date(props.TimeGenerated).toLocaleString() : "";
        
        const statusColor = status === 'SUCCESS' ? '#10b981' : '#ef4444';
        const riskColor = risk === 'atRisk' ? '#ef4444' : risk === 'confirmedSafe' ? '#10b981' : '#6b7280';

        popup.setOptions({
          content: `
            <div style="padding: 12px; min-width: 280px; max-width: 350px; word-wrap: break-word; white-space: normal;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #1f2937;">
                ${user.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
              </div>
              ${location ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${location.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                <span style="display: inline-block; padding: 3px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">
                  ${status.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                </span>
                <span style="display: inline-block; padding: 3px 8px; background: ${riskColor}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">
                  ${risk.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                </span>
                <span style="display: inline-block; padding: 3px 8px; background: #3b82f6; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">
                  ${device}
                </span>
              </div>
              ${ip ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>IP:</strong> ${ip.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              ${browser ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>Browser:</strong> ${browser.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              ${os ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>OS:</strong> ${os.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              ${time ? `<div style="font-size: 10px; color: #9ca3af; margin-top: 8px;">${time.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
            </div>
          `,
          position: coords
        });

        popup.open(map);
      }
    });

    map.events.add("mouseleave", bubbleLayer, () => {
      popup.close();
    });

    // Change cursor on hover
    map.events.add("mousemove", bubbleLayer, () => {
      map.getCanvasContainer().style.cursor = "pointer";
    });

    map.events.add("mouseleave", bubbleLayer, () => {
      map.getCanvasContainer().style.cursor = "grab";
    });

    isEnabled = true;
    console.log("Sign-in activity overlay enabled successfully");

  } catch (error) {
    console.error("Failed to enable sign-in activity overlay:", error);
    alert(`Failed to load sign-in activity data: ${error.message}`);
  }
}

/**
 * Disable the overlay
 */
function disable() {
  console.log("disable() called, isEnabled =", isEnabled);
  if (!isEnabled || !map) return;

  try {
    // Remove layers
    if (map.layers.getLayerById(SIGNIN_BUBBLE_LAYER_ID)) {
      map.layers.remove(SIGNIN_BUBBLE_LAYER_ID);
      console.log("Bubble layer removed");
    }

    // Remove data source
    if (map.sources.getById(SIGNIN_SOURCE_ID)) {
      map.sources.remove(SIGNIN_SOURCE_ID);
      console.log("Data source removed");
    }

    isEnabled = false;
    console.log("Sign-in activity overlay disabled successfully");
  } catch (error) {
    console.error("Error disabling sign-in activity overlay:", error);
  }
}

/**
 * Toggle the overlay on or off
 */
export async function toggleSignInActivityOverlay(azureMap, enabled) {
  console.log(`toggleSignInActivityOverlay(enabled = ${enabled})`);
  if (enabled) {
    await enable(azureMap);
  } else {
    disable();
  }
}
