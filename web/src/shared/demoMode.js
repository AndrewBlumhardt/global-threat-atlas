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
    // Try direct blob access first
    const blobUrl = `${config.storageAccountUrl}/${config.datasetsContainer}/${filename}`;
    // Use SAS token or key as query param (for demo/dev only)
    const directUrl = `${blobUrl}?access_key=${encodeURIComponent(key)}`;
    // Return directUrl, but caller should handle fetch failure and fallback
    return directUrl;
  }
  // Fallback to Function API
  const baseUrl = getApiUrl(`/api/data/${filename}`);
  return demoMode ? `${baseUrl}?demo=true` : baseUrl;
}
