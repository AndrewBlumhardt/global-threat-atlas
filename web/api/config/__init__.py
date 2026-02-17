"""
Azure Static Web App API endpoint to retrieve configuration securely.
"""
import azure.functions as func
import json
import os
import logging

logger = logging.getLogger(__name__)


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns configuration for the web app, including Azure Maps key from app settings.
    
    Note: Azure Maps subscription key is stored as a plain value in SWA app settings
    (not as a Key Vault reference, since SWA doesn't resolve KV references for custom code).
    """
    logger.info('Config API endpoint called')
    
    config = {
        'azureMapsKey': os.environ.get('AZURE_MAPS_SUBSCRIPTION_KEY', ''),
        'storageAccountUrl': os.environ.get('STORAGE_ACCOUNT_URL', ''),
        'datasetsContainer': os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')
    }
    
    if config['azureMapsKey']:
        logger.info(f'✅ Azure Maps key from app settings (length: {len(config["azureMapsKey"])})')
    else:
        logger.error('❌ Azure Maps key not found in app settings')
    
    return func.HttpResponse(
        body=json.dumps(config),
        mimetype='application/json',
        headers={
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    )
