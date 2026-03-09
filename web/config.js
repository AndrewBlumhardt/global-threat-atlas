// Custom layer display name defaults to 'Custom Source'.
// If CUSTOM_LAYER_DISPLAY_NAME is set as an app setting, it will be returned by /api/config
// and applied in app.js after the config fetch. This value is the fallback.
window.CUSTOM_LAYER_DISPLAY_NAME = 'Custom Source';
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
