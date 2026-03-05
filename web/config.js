// Azure Maps and Storage configuration
// This file is auto-generated during deployment
const config = {
    // Azure Maps subscription key 
    azureMapsKey: '',
    
    // Storage account URL for GeoJSON data
    storageAccountUrl: window.env?.STORAGE_ACCOUNT_URL || 'https://sentinelmapsstore.blob.core.windows.net',

    // Container name for datasets
    datasetsContainer: window.env?.DATASETS_CONTAINER || 'datasets',

    // Storage account key for direct blob access (set via window.env for security)
    storageAccountKey: window.env?.STORAGE_ACCOUNT_KEY || '',
    
    // GeoJSON file name for threat intel indicators
    geoJsonFileName: 'threat-intel-indicators.geojson',
    
    // Full URL to threat intel GeoJSON
    get threatIntelGeoJsonUrl() {
        // In production, use /api/data/threat-intel-indicators endpoint
        return `/api/data/threat-intel-indicators`;
    },
    
    // Local threat actors TSV file (fallback)
    threatActorsTsvUrl: './data/threat-actors.tsv',
    
    // Map configuration
    map: {
        center: [0, 20],
        zoom: 2,
        style: 'road',
        language: 'en-US'
    }
};

// Make config globally available
window.mapConfig = config;
