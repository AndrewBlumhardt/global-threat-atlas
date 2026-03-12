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
 * Build API data URL via Function App (uses Managed Identity)
 * This retrieves blobs from secure storage without exposing account keys
 */
export function getDataUrl(filename) {
  const storageAccountUrl = window.STORAGE_ACCOUNT_URL;
  const datasetsContainer = window.DATASETS_CONTAINER;
  if (isDemoMode()) {
    if (storageAccountUrl && datasetsContainer) {
      return `${storageAccountUrl}/${datasetsContainer}/demo_data/${filename}`;
    }
    return getApiUrl(`/api/data/demo_data/${filename}`);
  }
  if (storageAccountUrl && datasetsContainer) {
    return `${storageAccountUrl}/${datasetsContainer}/${filename}`;
  }
  return getApiUrl(`/api/data/${filename}`);
}
