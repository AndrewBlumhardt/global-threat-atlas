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
