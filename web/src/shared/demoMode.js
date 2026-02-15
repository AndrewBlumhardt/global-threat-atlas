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
 * Build API data URL with demo parameter if demo mode is enabled
 */
export function getDataUrl(filename) {
  const baseUrl = `/api/data/${filename}`;
  return demoMode ? `${baseUrl}?demo=true` : baseUrl;
}
