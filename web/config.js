// Set the display name for the custom source layer (UI label only)
// Read CUSTOM_LAYER_DISPLAY_NAME from SEA environment variables if available, with detailed logging
console.log('[config.js] SEA:', typeof SEA !== 'undefined' ? SEA : 'SEA is undefined');
if (typeof SEA !== 'undefined') {
    console.log('[config.js] SEA.CUSTOM_LAYER_DISPLAY_NAME:', SEA.CUSTOM_LAYER_DISPLAY_NAME);
}
if (typeof SEA !== 'undefined' && SEA.CUSTOM_LAYER_DISPLAY_NAME) {
    window.CUSTOM_LAYER_DISPLAY_NAME = SEA.CUSTOM_LAYER_DISPLAY_NAME;
    console.log('[config.js] Using SEA.CUSTOM_LAYER_DISPLAY_NAME:', window.CUSTOM_LAYER_DISPLAY_NAME);
} else {
    window.CUSTOM_LAYER_DISPLAY_NAME = 'Custom Source';
    console.log('[config.js] SEA.CUSTOM_LAYER_DISPLAY_NAME not set, using fallback:', window.CUSTOM_LAYER_DISPLAY_NAME);
}
// Azure Maps and Storage configuration
// This file is auto-generated during deployment

// Set top-level global variables for direct access in JS
window.STORAGE_ACCOUNT_URL = 'https://sentinelmapsstore.blob.core.windows.net';
window.DATASETS_CONTAINER = 'datasets';

const config = {
    azureMapsKey: '',
    storageAccountUrl: window.STORAGE_ACCOUNT_URL,
    datasetsContainer: window.DATASETS_CONTAINER,
    storageAccountKey: '',
    geoJsonFileName: 'threat-intel-indicators.geojson',
    get threatIntelGeoJsonUrl() {
        return `/api/data/threat-intel-indicators`;
    },
    threatActorsTsvUrl: './data/threat-actors.tsv',
    map: {
        center: [0, 20],
        zoom: 2,
        style: 'road',
        language: 'en-US'
    }
};
window.mapConfig = config;
