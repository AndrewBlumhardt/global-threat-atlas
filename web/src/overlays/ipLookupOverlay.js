/* global atlas */

/**
 * IP Lookup Overlay
 * Allows ad-hoc lookup of any public IP via MaxMind GeoIP2.
 * Drops a unique teal marker on the map for each result.
 * Multiple lookups accumulate until cleared.
 */

import { showIPLookupDetails } from "../ui/panelManager.js";

// Track active markers so they can all be cleared at once
const activeMarkers = [];
// Track marker data for panel display
const markerDataMap = new WeakMap();

/**
 * Look up an IP address and place a marker on the map.
 * Returns a status object: { success, message, noMatch }
 */
export async function lookupAndPlaceIP(map, ip) {
  if (!ip || !ip.trim()) {
    return { success: false, message: 'Please enter an IP address.' };
  }

  ip = ip.trim();

  try {
    const resp = await fetch(`/api/lookup-ip?ip=${encodeURIComponent(ip)}`);
    const data = await resp.json();

    if (!resp.ok) {
      // no_match means the IP is valid but not found / private
      return {
        success: false,
        message: data.error || `Lookup failed (${resp.status})`,
        noMatch: data.no_match === true
      };
    }

    const { latitude, longitude } = data;
    if (latitude == null || longitude == null) {
      return {
        success: false,
        message: `No coordinates returned for ${ip}`,
        noMatch: true
      };
    }

    // Build a distinctive teal marker element
    const markerEl = _buildMarkerElement(data);
    const position = [longitude, latitude];

    const marker = new atlas.HtmlMarker({
      htmlContent: markerEl,
      position: position,
      anchor: 'bottom'
    });

    map.markers.add(marker);
    activeMarkers.push(marker);
    markerDataMap.set(marker, data);

    // Hover popup
    const popup = new atlas.Popup({
      pixelOffset: [0, -36],
      closeButton: false
    });

    map.events.add('mouseover', marker, () => {
      popup.setOptions({
        content: _buildHoverContent(data),
        position: position
      });
      popup.open(map);
    });

    map.events.add('mouseout', marker, () => {
      popup.close();
    });

    // Click → open details panel
    map.events.add('click', marker, () => {
      showIPLookupDetails(data);
    });

    // Pan map to the new marker
    map.setCamera({ center: position, zoom: Math.max(map.getCamera().zoom, 4) });

    return { success: true, message: `Located: ${_buildLocationSummary(data)}` };

  } catch (e) {
    console.error('[ipLookupOverlay] Lookup error:', e);
    return { success: false, message: `Network error: ${e.message}` };
  }
}

/**
 * Remove all lookup markers from the map.
 */
export function clearAllLookups(map) {
  activeMarkers.forEach(m => map.markers.remove(m));
  activeMarkers.length = 0;
}

/**
 * Returns count of active lookup markers.
 */
export function getLookupCount() {
  return activeMarkers.length;
}

// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * Build the HTML element used as the map marker.
 * Teal pin with a magnifier icon to distinguish from other layers.
 */
function _buildMarkerElement(data) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
  `;

  // Risk badge color based on anonymizer/proxy flags
  const isHighRisk = data.is_tor_exit_node || data.is_anonymous_vpn || data.is_public_proxy;
  const isMedRisk = data.is_anonymous || data.is_anonymous_proxy || data.is_hosting_provider;
  const pinColor = isHighRisk ? '#ef4444' : isMedRisk ? '#f59e0b' : '#0891b2';

  wrapper.innerHTML = `
    <div style="
      width: 28px; height: 28px;
      background: ${pinColor};
      border: 2px solid #fff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
    ">
      <span style="transform: rotate(45deg); font-size: 13px; line-height: 1;">🔍</span>
    </div>
    <div style="
      font-size: 9px; color: #fff; background: rgba(0,0,0,0.6);
      padding: 1px 4px; border-radius: 3px; margin-top: 2px;
      white-space: nowrap; max-width: 70px; overflow: hidden;
      text-overflow: ellipsis;
    ">${_escHtml(data.ip)}</div>
  `;

  return wrapper;
}

/**
 * Build compact hover popup content.
 */
function _buildHoverContent(data) {
  const location = [data.city, data.country].filter(Boolean).join(', ');
  const flags = _riskFlags(data);

  return `
    <div style="padding:10px; width:240px; box-sizing:border-box;">
      <div style="font-weight:600; font-size:13px; margin-bottom:6px; word-break:break-all;">
        🔍 <strong>${_escHtml(data.ip)}</strong>
      </div>
      ${location ? `<div style="margin-bottom:4px;"><strong>Location:</strong> ${_escHtml(location)}</div>` : ''}
      ${data.isp ? `<div style="margin-bottom:4px; font-size:12px;"><strong>ISP:</strong> ${_escHtml(data.isp)}</div>` : ''}
      ${data.organization ? `<div style="margin-bottom:4px; font-size:12px;"><strong>Org:</strong> ${_escHtml(data.organization)}</div>` : ''}
      ${flags.length ? `<div style="margin-top:6px;">${flags.map(f => `<span style="display:inline-block; padding:2px 6px; background:${f.color}; color:#fff; border-radius:3px; font-size:10px; font-weight:600; margin-right:4px;">${f.label}</span>`).join('')}</div>` : ''}
      <div style="font-size:10px; color:#aaa; margin-top:6px;">Click for full details</div>
    </div>
  `;
}

/**
 * Build a short location summary string for status messages.
 */
function _buildLocationSummary(data) {
  const parts = [data.city, data.state, data.country].filter(Boolean);
  return parts.length ? parts.join(', ') : data.ip;
}

/**
 * Build an array of risk flag objects for display.
 */
function _riskFlags(data) {
  const flags = [];
  if (data.is_tor_exit_node) flags.push({ label: 'TOR Exit', color: '#7c3aed' });
  if (data.is_anonymous_vpn) flags.push({ label: 'VPN', color: '#7c3aed' });
  if (data.is_public_proxy) flags.push({ label: 'Proxy', color: '#ef4444' });
  if (data.is_anonymous_proxy) flags.push({ label: 'Anon Proxy', color: '#ef4444' });
  if (data.is_hosting_provider) flags.push({ label: 'Hosting', color: '#f59e0b' });
  if (data.is_anonymous) flags.push({ label: 'Anonymous', color: '#f59e0b' });
  if (data.is_residential_proxy) flags.push({ label: 'Residential Proxy', color: '#f59e0b' });
  return flags;
}

function _escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
