// config.sample.js — copy this file to config.js and update values for your deployment.
//
// The Azure Maps key is NOT stored here.  It is read from the Function App's
// AZURE_MAPS_SUBSCRIPTION_KEY app setting and served to the browser at runtime
// by /api/config — it never appears in static files or source control.
//
// Replace the storage account URL below with your own after running deploy.ps1.

// Custom layer display name (optional — overridden by CUSTOM_LAYER_DISPLAY_NAME app setting)
window.CUSTOM_LAYER_DISPLAY_NAME = 'Custom Source';

// Storage fallbacks — replace with your storage account URL
window.STORAGE_ACCOUNT_URL = 'https://<YOUR-STORAGE-ACCOUNT>.blob.core.windows.net';
window.DATASETS_CONTAINER = 'datasets';

// Uncomment to force all data requests through the Function App API
// (required when the storage container has public access disabled).
// window.USE_FUNCTION_API_ONLY = true;
