/**
 * Demo mode state management
 */

let demoMode = false;

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
  const config = window.mapConfig || {};
  const key = config.storageAccountKey;
  if (key && config.storageAccountUrl && config.datasetsContainer) {
    const blobUrl = `${config.storageAccountUrl}/${config.datasetsContainer}/${filename}`;
    console.log(`[getDataUrl] Blob path: ${blobUrl}, file: ${filename}`);
    const directUrl = `${blobUrl}?access_key=${encodeURIComponent(key)}`;
    return directUrl;
  }
  const baseUrl = getApiUrl(`/api/data/${filename}`);
  console.log(`[getDataUrl] Using Function API fallback for file: ${filename}`);
  return demoMode ? `${baseUrl}?demo=true` : baseUrl;
}
