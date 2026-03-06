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
  const storageAccountUrl = window.STORAGE_ACCOUNT_URL;
  const datasetsContainer = window.DATASETS_CONTAINER;
  if (demoMode) {
    // Use demo_data subfolder in blob storage for demo mode
    if (storageAccountUrl && datasetsContainer) {
      const demoBlobUrl = `${storageAccountUrl}/${datasetsContainer}/demo_data/${filename}`;
      console.log(`[getDataUrl] Demo mode active, using blob: ${demoBlobUrl}`);
      return demoBlobUrl;
    }
    // Fallback to Function API if config missing
    const demoApiUrl = getApiUrl(`/api/data/demo_data/${filename}`);
    console.log(`[getDataUrl] Demo mode active, using API fallback: ${demoApiUrl}`);
    return demoApiUrl;
  }
  if (storageAccountUrl && datasetsContainer) {
    const blobUrl = `${storageAccountUrl}/${datasetsContainer}/${filename}`;
    console.log(`[getDataUrl] Blob path: ${blobUrl}, file: ${filename}`);
    return blobUrl;
  }
  // Fallback to Function API if config missing
  const baseUrl = getApiUrl(`/api/data/${filename}`);
  console.log(`[getDataUrl] Using Function API fallback for file: ${filename}`);
  return baseUrl;
}
