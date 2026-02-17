/**
 * Demo mode state management
 */

let demoMode = false;

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
  // Use Function App endpoint (uses MI, no account keys exposed)
  const baseUrl = `https://func-sentinel-activity-maps.azurewebsites.net/api/data/${filename}`;
  return demoMode ? `${baseUrl}?demo=true` : baseUrl;
}
