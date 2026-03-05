/* global atlas */

/**
 * Sign-In Activity Overlay
 * Displays sign-in activity events from pre-generated GeoJSON
 */

import { getDataUrl } from "../shared/demoMode.js";
import { showSignInDetails } from "../ui/panelManager.js";

let isEnabled = false;
let map = null;
let htmlMarkers = [];
let popup = null;

/**
 * Enable the overlay - fetch and display GeoJSON as HTML markers with lollipop pins
 */
async function enable(azureMap) {
  console.log("enable() called, isEnabled =", isEnabled);
  if (isEnabled) return;

  map = azureMap;
  
  try {
    console.log("Loading sign-in activity from blob storage...");

    // Try direct blob access first
    let response = await fetch(getDataUrl("signin-activity"));
    if (response.ok) {
      console.log("Sign-in activity loaded via direct blob access.");
    } else {
      console.warn("Direct blob access failed (status:", response.status, ") - falling back to Function API.");
      // Fallback to Function API
      response = await fetch("/api/data/signin-activity");
      if (response.ok) {
        console.log("Sign-in activity loaded via Function API fallback.");
      } else {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(`Failed to load sign-in activity: ${response.status} ${response.statusText}`);
      }
    }

    const geojsonData = await response.json();
    console.log("Sign-in activity GeoJSON loaded:", geojsonData.features?.length || 0, "features");
    
    if (!geojsonData.features || geojsonData.features.length === 0) {
      console.warn("No sign-in activity features found in GeoJSON");
      return;
    }

    // Create popup for hover events
    popup = new atlas.Popup({
      pixelOffset: [0, -30],
      closeButton: false
    });

    // Create HTML markers with simple CSS bubbles
    // Small circles: green for success, bright red for failure
    geojsonData.features.forEach(feature => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      const isSuccess = props.ResultSignature === 'SUCCESS';
      
      // Create simple CSS bubble marker
      const bubbleColor = isSuccess ? '#10b981' : '#ef4444';
      const marker = new atlas.HtmlMarker({
        position: [coords[0], coords[1]],
        htmlContent: `<div class="signin-marker" style="width: 14px; height: 14px; border-radius: 50%; background-color: ${bubbleColor}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer; pointer-events: auto;"></div>`,
        anchor: 'center',
        pixelOffset: [0, 0]
      });
      
      // Store properties on the marker element for event handlers
      marker.properties = props;
      marker.coordinates = coords;
      
      // Add hover popup
      map.events.add('mouseover', marker, () => {
        showSignInPopup(marker.properties, marker.coordinates);
      });
      
      map.events.add('mouseleave', marker, () => {
        popup.close();
      });
      
      // Add click handler for proximity search (300km radius)
      map.events.add('click', marker, (e) => {
        if (e && e.originalEvent) {
          e.originalEvent.stopPropagation();
        }
        showNearbySignInsPanel(map, marker.coordinates, geojsonData.features);
      });
      
      map.markers.add(marker);
      htmlMarkers.push(marker);
    });

    console.log(`Added ${htmlMarkers.length} sign-in lollipop markers to map`);
    isEnabled = true;
    console.log("Sign-in activity overlay enabled successfully");

  } catch (error) {
    console.error("Failed to enable sign-in activity overlay:", error);
    alert(`Failed to load sign-in activity data: ${error.message}`);
  }
}

/**
 * Show popup for sign-in marker
 */
function showSignInPopup(props, coords) {
  const user = props.UserDisplayName || props.UserPrincipalName || "Unknown User";
  const upn = props.UserPrincipalName || "";
  const city = props.City || "";
  const state = props.State || "";
  const country = props.CountryOrRegion || "";
  const location = [city, state, country].filter(Boolean).join(", ");
  const status = props.ResultSignature || "Unknown";
  const resource = props.ResourceDisplayName || "Unknown App";
  const ip = props.IPAddress || "";
  const isMsIP = props.IsMicrosoftIP === true || props.IsMicrosoftIP === "True" || props.IsMicrosoftIP === "true";
  const browser = props.Browser || "";
  const os = props.OperatingSystem || "";
  const device = props.isManaged === "True" || props.isManaged === true ? "Managed" : (props.isCompliant === "True" || props.isCompliant === true ? "Compliant" : "Unmanaged");
  const risk = props.RiskState || "none";
  const riskReason = props.RiskReason || "";
  const caStatus = props.ConditionalAccessStatus || "";
  const time = props.TimeGenerated ? new Date(props.TimeGenerated).toLocaleString() : "";
  
  const statusColor = status === 'SUCCESS' ? '#10b981' : '#ef4444';
  const riskColor = risk === 'atRisk' ? '#ef4444' : risk === 'confirmedSafe' ? '#10b981' : '#6b7280';

  popup.setOptions({
    content: `
      <div style="padding: 12px; min-width: 300px; max-width: 380px; word-wrap: break-word; white-space: normal;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #1f2937;">
          ${user.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>
        ${upn && upn !== user ? `<div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">${upn.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
        ${location ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">📍 ${location.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
          <span style="display: inline-block; padding: 3px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">
            ${status.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </span>
          ${risk !== "none" ? `<span style="display: inline-block; padding: 3px 8px; background: ${riskColor}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">
            ${risk.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </span>` : ""}
          <span style="display: inline-block; padding: 3px 8px; background: #3b82f6; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">
            ${device}
          </span>
          ${isMsIP ? `<span style="display: inline-block; padding: 3px 8px; background: #059669; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">MS IP</span>` : ""}
        </div>
        ${resource !== "Unknown App" ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>App:</strong> ${resource.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
        ${ip ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>IP:</strong> ${ip.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
        ${riskReason ? `<div style="font-size: 11px; color: #dc2626; margin-bottom: 4px;"><strong>Risk:</strong> ${riskReason.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
        ${caStatus ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>CA Status:</strong> ${caStatus.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
        ${browser ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>Browser:</strong> ${browser.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
        ${os ? `<div style="font-size: 11px; color: #374151; margin-bottom: 4px;"><strong>OS:</strong> ${os.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
        ${time ? `<div style="font-size: 10px; color: #9ca3af; margin-top: 8px;">${time.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
      </div>
    `,
    position: coords
  });

  popup.open(map);
}

/**
 * Disable the overlay
 */
function disable() {
  console.log("disable() called, isEnabled =", isEnabled);
  if (!isEnabled || !map) return;

  try {
    // Remove all HTML markers
    htmlMarkers.forEach(marker => {
      map.markers.remove(marker);
    });
    htmlMarkers = [];

    if (popup) {
      popup.close();
    }

    isEnabled = false;
    console.log("Sign-in activity overlay disabled successfully");
  } catch (error) {
    console.error("Error disabling sign-in activity overlay:", error);
  }
}

/**
 * Show nearby sign-ins in the left panel when user clicks on the map
 */
function showNearbySignInsPanel(map, position, allFeatures) {
  const radiusKm = 300; // 300 km radius
  const clickLng = position[0];
  const clickLat = position[1];
  
  // Calculate distances and filter by radius
  const nearbySignIns = allFeatures
    .map(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      const distance = calculateDistance(clickLat, clickLng, lat, lng);
      return {
        distance,
        properties: feature.properties,
        coordinates: feature.geometry.coordinates
      };
    })
    .filter(item => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
  
  // Create location name from click position
  let locationName = "Selected Area";
  if (nearbySignIns.length > 0) {
    const firstSignIn = nearbySignIns[0].properties;
    const city = firstSignIn.City || '';
    const country = firstSignIn.CountryOrRegion || '';
    locationName = [city, country].filter(Boolean).join(', ') || "Unknown Location";
  }
  
  // Get threat intel IPs for correlation (if threat intel layer is active)
  const threatIntelIPs = getThreatIntelIPsForSignIns(map, nearbySignIns);
  
  // Show in panel
  showSignInDetails({
    location: locationName,
    count: nearbySignIns.length,
    radius: radiusKm,
    signIns: nearbySignIns.map(item => ({
      user: item.properties.UserDisplayName || item.properties.UserPrincipalName || 'Unknown',
      userPrincipal: item.properties.UserPrincipalName || '',
      ip: item.properties.IPAddress || '',
      city: item.properties.City || '',
      country: item.properties.CountryOrRegion || '',
      result: item.properties.ResultSignature || '',
      resource: item.properties.ResourceDisplayName || '',
      browser: item.properties.Browser || '',
      os: item.properties.OperatingSystem || '',
      deviceId: item.properties.DeviceId || '',
      isMsIP: item.properties.IsMicrosoftIP === true || item.properties.IsMicrosoftIP === 'True',
      isCompliant: item.properties.isCompliant === 'True' || item.properties.isCompliant === true,
      isManaged: item.properties.isManaged === 'True' || item.properties.isManaged === true,
      riskState: item.properties.RiskState || '',
      riskReason: item.properties.RiskReason || '',
      caStatus: item.properties.ConditionalAccessStatus || '',
      time: item.properties.TimeGenerated || '',
      distance: Math.round(item.distance * 10) / 10
    })),
    threatIntelIPs
  });
}

/**
 * Get threat intel IPs that match sign-in IPs
 */
function getThreatIntelIPsForSignIns(map, signIns) {
  try {
    const threatIntelSource = map.sources.getById('threat-intel-source');
    if (!threatIntelSource) return [];
    
    const signInIPs = new Set(signIns.map(s => s.properties.IPAddress).filter(Boolean));
    const threatFeatures = threatIntelSource.toJson().features;
    
    return threatFeatures
      .filter(feature => {
        const ip = feature.properties.ObservableValue || feature.properties.observableValue || feature.properties.ip;
        return signInIPs.has(ip);
      })
      .map(feature => ({
        ip: feature.properties.ObservableValue || feature.properties.observableValue || feature.properties.ip || 'Unknown',
        city: feature.properties.City || feature.properties.city || '',
        country: feature.properties.Country || feature.properties.country || '',
        type: feature.properties.Type || feature.properties.type || '',
        label: feature.properties.Label || feature.properties.label || '',
        confidence: feature.properties.Confidence || feature.properties.confidence || '',
        description: feature.properties.Description || feature.properties.description || ''
      }));
  } catch (e) {
    console.warn('Could not get threat intel IPs:', e);
    return [];
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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
