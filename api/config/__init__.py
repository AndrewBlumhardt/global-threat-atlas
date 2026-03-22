"""
Azure Static Web App API endpoint to retrieve configuration securely.
Reads app settings server-side and returns only what the browser needs.
Credentials never appear in static files or client-side code.
"""
import azure.functions as func
import json
import os
import logging

logger = logging.getLogger(__name__)


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns non-sensitive configuration for the web app from SWA app settings.
    The Azure Maps key and storage URL are read from os.environ (server-side only)
    and included in the JSON response for the browser to use at runtime.
    """
    logger.info('Config API endpoint called')

    config = {
        'azureMapsKey':                 os.environ.get('AZURE_MAPS_SUBSCRIPTION_KEY', ''),
        'storageAccountUrl':             os.environ.get('STORAGE_ACCOUNT_URL', ''),
        'datasetsContainer':             os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets'),
        'customLayerDisplayName':        os.environ.get('CUSTOM_LAYER_DISPLAY_NAME', ''),
        'liveRefreshIntervalMinutes':    int(os.environ.get('LIVE_REFRESH_INTERVAL_MINUTES') or '5'),
        'configSource':                  'swa',
    }

    return func.HttpResponse(
        body=json.dumps(config),
        mimetype='application/json',
        headers={
            # Allow the SWA frontend (same origin in production) to read this response.
            # The wildcard is acceptable here because the Azure Maps key is a low-privilege
            # credential that only authorises map rendering and weather tiles — it cannot
            # be used to modify Maps account settings or access other Azure resources.
            # If stricter isolation is needed, replace '*' with the SWA origin URL.
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
    )
