// config.js — static fallbacks loaded synchronously before /api/config is available.
//
// The Azure Maps subscription key is NOT stored here.  It is read from the
// AZURE_MAPS_SUBSCRIPTION_KEY Function App setting and served to the browser at
// runtime by /api/config (api/config/__init__.py).  This keeps the key out of
// static files and version control.
//
// The storage URL and container name below are defaults used if /api/config is
// unreachable (e.g. cold-start timeout).  They are overridden at runtime by
// the values returned from /api/config.

// Custom layer display name — overridden by CUSTOM_LAYER_DISPLAY_NAME app setting via /api/config
window.CUSTOM_LAYER_DISPLAY_NAME = 'Custom Source';

// Storage fallbacks (overridden at runtime by /api/config values)
window.STORAGE_ACCOUNT_URL = 'https://sentinelmapsstore.blob.core.windows.net';
window.DATASETS_CONTAINER = 'datasets';
