/**
 * Demo mode state management
 */

if (typeof window.demoMode === 'undefined') window.demoMode = false;

/**
 * All backend secrets and config are now securely fetched via API endpoints.
 * No local environment variables are used in production.
 */
function getFunctionAppBaseUrl() {
  // In production, base URL is determined by deployment; no local env variables are used.
  return "";
}

/**
 * Build API URL path for either direct Function App calls or same-origin fallback.
 */
export function getApiUrl(path) {
  // In production, all API calls are proxied through SWA to the Function App
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedPath;
}

/**
 * Get current demo mode state
 */
export function isDemoMode() {
  return window.demoMode;
}

/**
 * Set demo mode state
 */
export function setDemoMode(enabled) {
  window.demoMode = enabled;
}

/**
 * Build API data URL via Function App (uses Managed Identity).
 * All blob reads go through /api/data/ — no anonymous blob access required.
 * Demo mode appends ?demo=true so the API reads from the demo_data/ prefix.
 */
export function getDataUrl(filename) {
  const demo = isDemoMode() ? '?demo=true' : '';
  return getApiUrl(`/api/data/${filename}${demo}`);
}

// --- Anonymous blob probe (single attempt, cached for the session) ---
let _probePromise = null;
let _useDirectBlob = false;

function buildDirectBlobUrl(filename) {
  const base = (window.STORAGE_ACCOUNT_URL || '').replace(/\/$/, '');
  const container = window.DATASETS_CONTAINER || 'datasets';
  if (!base) return null;
  const prefix = isDemoMode() ? 'demo_data/' : '';
  return `${base}/${container}/${prefix}${filename}`;
}

async function _probeAnonymousAccess(filename) {
  const base = (window.STORAGE_ACCOUNT_URL || '').replace(/\/$/, '');
  const container = window.DATASETS_CONTAINER || 'datasets';
  if (!base) return false;
  try {
    const resp = await fetch(`${base}/${container}/${filename}`, { method: 'HEAD' });
    if (resp.ok) {
      console.log('[demoMode] Anonymous blob access confirmed — using direct URLs');
      return true;
    }
  } catch (_) {
    // CORS block or network failure — anonymous not available
  }
  console.log('[demoMode] Anonymous blob access unavailable — routing through function API');
  return false;
}

/**
 * Resolve a data URL for the given filename.
 * On the first call ever, fires a single HEAD probe against the blob container.
 * If anonymous access succeeds → all requests go direct (zero function invocations).
 * If not → falls through to the function API route as before.
 */
export async function resolveDataUrl(filename) {
  if (_probePromise === null) {
    _probePromise = _probeAnonymousAccess(filename);
  }
  _useDirectBlob = await _probePromise;
  if (_useDirectBlob) {
    return buildDirectBlobUrl(filename);
  }
  const demo = isDemoMode() ? '?demo=true' : '';
  return getApiUrl(`/api/data/${filename}${demo}`);
}
