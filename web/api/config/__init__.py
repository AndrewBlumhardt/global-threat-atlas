"""
Azure Static Web App API endpoint to retrieve configuration securely.
"""
import azure.functions as func
import json
import os
import logging
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

logger = logging.getLogger(__name__)


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns configuration for the web app, including Azure Maps key from Key Vault.
    
    Priority order:
    1. Try to retrieve AZURE-MAPS-SUBSCRIPTION-KEY from Key Vault (via Managed Identity)
    2. Fall back to AZURE_MAPS_SUBSCRIPTION_KEY app setting if KV fails
    3. Return empty string if neither is available
    """
    logger.info('Config API endpoint called')
    
    # Get Key Vault name from environment
    kv_name = os.environ.get('KEY_VAULT_NAME')
    
    config = {
        'azureMapsKey': '',
        'storageAccountUrl': os.environ.get('STORAGE_ACCOUNT_URL', ''),
        'datasetsContainer': os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')
    }
    
    # Try to get Azure Maps key from Key Vault (preferred)
    if kv_name:
        try:
            vault_url = f"https://{kv_name}.vault.azure.net"
            logger.info(f'Attempting to retrieve Azure Maps key from Key Vault: {vault_url}')
            credential = DefaultAzureCredential()
            client = SecretClient(vault_url=vault_url, credential=credential)
            
            # Try to get the Azure Maps key
            try:
                secret = client.get_secret('AZURE-MAPS-SUBSCRIPTION-KEY')
                config['azureMapsKey'] = secret.value
                logger.info('✅ Retrieved Azure Maps key from Key Vault')
            except Exception as e:
                logger.warning(f'❌ Could not retrieve AZURE-MAPS-SUBSCRIPTION-KEY from Key Vault: {type(e).__name__}: {str(e)}')
        except Exception as e:
            logger.error(f'❌ Failed to connect to Key Vault {kv_name}: {type(e).__name__}: {str(e)}')
    else:
        logger.warning('KEY_VAULT_NAME not set - skipping Key Vault lookup')
    
    # Fall back to app settings if Key Vault failed
    if not config['azureMapsKey']:
        app_setting_key = os.environ.get('AZURE_MAPS_SUBSCRIPTION_KEY', '')
        if app_setting_key:
            config['azureMapsKey'] = app_setting_key
            logger.info('⚠️  Using Azure Maps key from app settings (fallback)')
        else:
            logger.error('❌ Azure Maps key not found in Key Vault or app settings')
    
    return func.HttpResponse(
        body=json.dumps(config),
        mimetype='application/json',
        headers={
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    )
