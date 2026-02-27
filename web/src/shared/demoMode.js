/**
 * Demo mode state management
 */

let demoMode = false;

/**
 * Normalize optional Function App base URL from runtime environment.
 * When not set, callers fall back to same-origin /api routes.
 */
function getFunctionAppBaseUrl() {
  const rawBaseUrl = window.ENV?.FUNCTION_APP_BASE_URL || "";
  return rawBaseUrl.replace(/\/+$/, "");
}

/**
 * Build API URL path for either direct Function App calls or same-origin fallback.
 */
export function getApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const functionAppBaseUrl = getFunctionAppBaseUrl();
  return functionAppBaseUrl ? `${functionAppBaseUrl}${normalizedPath}` : normalizedPath;
}

/**
 * Get current demo mode state
 */
export function isDemoMode() {
  return demoMode;
}

/**
 * Set demo mode state
 */
export function setDemoMode(enabled) {
  demoMode = enabled;
  console.log(`Demo mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Build API data URL via Function App (uses Managed Identity)
 * This retrieves blobs from secure storage without exposing account keys
 */
export function getDataUrl(filename) {
  // Use direct Function App URL when configured; otherwise keep same-origin /api path.
  const baseUrl = getApiUrl(`/api/data/${filename}`);
  return demoMode ? `${baseUrl}?demo=true` : baseUrl;
}
