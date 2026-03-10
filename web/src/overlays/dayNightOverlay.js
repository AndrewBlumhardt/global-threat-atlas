/* global atlas */

/**
 * Day/Night Terminator Overlay
 *
 * Draws a semi-transparent "night" polygon over the dark half of the globe
 * based on the current UTC time and date.  No API calls — pure astronomy math.
 *
 * Solar position algorithm:
 *   - Declination from approximate orbital formula
 *   - Subsolar longitude from UTC time (sun is directly overhead on the meridian
 *     where local solar noon is happening)
 *   - Terminator latitude per longitude: atan(-cos(Δlon) / tan(decl))
 *
 * Updates every 5 minutes while enabled.
 */

const SOURCE_ID = 'day-night-source';
const NIGHT_LAYER_ID = 'day-night-night';
const TERMINATOR_LAYER_ID = 'day-night-terminator';

const DEG = Math.PI / 180;

let _refreshTimer = null;
let _clockTimer = null;
let _isEnabled = false;

// ─── Public API ──────────────────────────────────────────────────────────────

export function toggleDayNightOverlay(map, turnOn) {
  if (turnOn) {
    _enable(map);
  } else {
    _disable(map);
  }
}

// ─── Enable / Disable ────────────────────────────────────────────────────────

function _enable(map) {
  if (_isEnabled) return;
  _isEnabled = true;

  // Datasource
  const source = new atlas.source.DataSource(SOURCE_ID);
  map.sources.add(source);

  // Night polygon layer (behind other data)
  map.layers.add(new atlas.layer.PolygonLayer(source, NIGHT_LAYER_ID, {
    fillColor: 'rgba(10, 15, 40, 0.45)',
    fillOpacity: 1,
  }), 'labels');   // insert below label layer so labels stay readable

  // Terminator line
  map.layers.add(new atlas.layer.LineLayer(source, TERMINATOR_LAYER_ID, {
    strokeColor: 'rgba(255, 220, 100, 0.55)',
    strokeWidth: 1.5,
    filter: ['==', ['geometry-type'], 'LineString'],
  }), 'labels');

  // Initial draw
  _updateOverlay(map);

  // Clock label
  _startClock();

  // Refresh every 5 minutes
  _refreshTimer = setInterval(() => _updateOverlay(map), 5 * 60 * 1000);
}

function _disable(map) {
  if (!_isEnabled) return;
  _isEnabled = false;

  clearInterval(_refreshTimer);
  _refreshTimer = null;
  clearInterval(_clockTimer);
  _clockTimer = null;

  _removeClockLabel();

  try { map.layers.remove(NIGHT_LAYER_ID); } catch (_) {}
  try { map.layers.remove(TERMINATOR_LAYER_ID); } catch (_) {}
  try { map.sources.remove(SOURCE_ID); } catch (_) {}
}

// ─── Core update ─────────────────────────────────────────────────────────────

function _updateOverlay(map) {
  const source = map.sources.getById(SOURCE_ID);
  if (!source) return;

  const now = new Date();
  const { lat: sunLat, lon: sunLon } = _subsolarPoint(now);

  const terminatorPoints = _computeTerminator(sunLat, sunLon);
  const nightPolygon     = _buildNightPolygon(terminatorPoints, sunLat);
  const terminatorLine   = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: terminatorPoints },
  };

  source.clear();
  source.add([nightPolygon, terminatorLine]);
}

// ─── Solar maths ─────────────────────────────────────────────────────────────

/**
 * Approximate subsolar point (lat/lon directly under the sun) for a given Date.
 */
function _subsolarPoint(date) {
  // Day of year (1-based)
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear   = Math.floor((date.getTime() - startOfYear) / 86400000) + 1;

  // Solar declination in degrees (approx)
  // Peaks +23.45° at summer solstice (~day 172), -23.45° at winter solstice (~day 355)
  const decl = -23.45 * Math.cos(2 * Math.PI / 365 * (dayOfYear + 10));

  // UTC fractional hours
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // The sun is at longitude 0° at UTC 12:00; each hour is 15° of longitude.
  // Moving westward as UTC advances → sunLon decreases.
  const sunLon = (12 - utcH) * 15;

  return { lat: decl, lon: sunLon };
}

/**
 * For each integer longitude [-180…180], compute the terminator latitude
 * (boundary between day and night).
 */
function _computeTerminator(sunLatDeg, sunLonDeg) {
  const sunLatRad = sunLatDeg * DEG;
  const points = [];

  for (let lon = -180; lon <= 180; lon++) {
    const dLonRad = (lon - sunLonDeg) * DEG;
    let latDeg;

    if (Math.abs(sunLatDeg) < 0.1) {
      // Near equinox — terminator runs pole-to-pole; clamp to ±89
      latDeg = 0;
    } else {
      const tanLat = -Math.cos(dLonRad) / Math.tan(sunLatRad);
      latDeg = Math.atan(tanLat) / DEG;
    }

    points.push([lon, Math.max(-89.9, Math.min(89.9, latDeg))]);
  }

  return points;
}

/**
 * Build a closed GeoJSON Polygon covering the night side.
 * Closes via the dark pole so the polygon fills the correct hemisphere.
 */
function _buildNightPolygon(terminatorPoints, sunLatDeg) {
  // The dark pole is the one opposite the sun's hemisphere
  const darkPole = sunLatDeg >= 0 ? -90 : 90;

  let coords;
  if (Math.abs(sunLatDeg) < 0.1) {
    // Equinox: night is exactly one hemisphere split by the terminator meridians
    coords = [
      ...terminatorPoints,
      [180, darkPole],
      [-180, darkPole],
      terminatorPoints[0],
    ];
  } else {
    coords = [
      ...terminatorPoints,
      [180, darkPole],
      [-180, darkPole],
      terminatorPoints[0],
    ];
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

// ─── Clock label ─────────────────────────────────────────────────────────────

function _startClock() {
  _removeClockLabel();

  const el = document.createElement('div');
  el.id = 'dayNightClock';
  el.style.cssText = `
    position: absolute;
    bottom: 36px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10, 15, 40, 0.72);
    color: rgba(255, 220, 100, 0.9);
    font-size: 12px;
    font-family: monospace;
    padding: 4px 10px;
    border-radius: 4px;
    pointer-events: none;
    z-index: 10;
    letter-spacing: 0.05em;
    border: 1px solid rgba(255, 220, 100, 0.3);
  `;

  const mapEl = document.getElementById('map');
  if (mapEl) mapEl.appendChild(el);

  const tick = () => {
    const now = new Date();
    const { lat, lon } = _subsolarPoint(now);
    const utc = now.toISOString().substring(11, 19) + ' UTC';
    const latStr = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(lon % 360 > 180 ? lon % 360 - 360 : lon % 360).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
    if (el.isConnected) {
      el.textContent = `☀ ${utc}  ·  subsolar ${latStr} ${lonStr}`;
    }
  };

  tick();
  _clockTimer = setInterval(tick, 5000);
}

function _removeClockLabel() {
  const el = document.getElementById('dayNightClock');
  if (el) el.remove();
}
