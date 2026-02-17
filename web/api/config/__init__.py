"""
Azure Static Web App API endpoint to retrieve configuration securely.

Note: SWA doesn't resolve KV references in custom app settings automatically,
so we must fetch secrets directly using REST API + Managed Identity.
"""
import azure.functions as func
import json
import os
import logging
import requests

logger = logging.getLogger(__name__)


def get_managed_identity_token(resource='https://vault.azure.net'):
    """Get managed identity access token using MSI endpoint."""
    try:
        # SWA provides MSI endpoint via environment variables
        msi_endpoint = os.environ.get('IDENTITY_ENDPOINT')
        msi_header = os.environ.get('IDENTITY_HEADER')
        
        if not msi_endpoint or not msi_header:
            logger.warning('MSI endpoint not available (IDENTITY_ENDPOINT/IDENTITY_HEADER not set)')
            return None
        
        headers = {'X-IDENTITY-HEADER': msi_header}
        params = {'resource': resource, 'api-version': '2019-08-01'}
        
        response = requests.get(msi_endpoint, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        
        return response.json().get('access_token')
    except Exception as e:
        logger.error(f'Failed to get MI token: {type(e).__name__}: {str(e)}')
        return None


def get_keyvault_secret(vault_name, secret_name, access_token):
    """Fetch secret from Key Vault using REST API."""
    try:
        vault_url = f"https://{vault_name}.vault.azure.net/secrets/{secret_name}?api-version=7.4"
        headers = {'Authorization': f'Bearer {access_token}'}
        
        response = requests.get(vault_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        return response.json().get('value')
    except requests.exceptions.HTTPError as e:
        logger.error(f'Key Vault API error: {e.response.status_code} - {e.response.text}')
        return None
    except Exception as e:
        logger.error(f'Failed to fetch secret: {type(e).__name__}: {str(e)}')
        return None


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns configuration for the web app, including Azure Maps key from Key Vault.
    
    Priority order:
    1. Try Key Vault via REST API with Managed Identity (SWA doesn't auto-resolve KV references)
    2. Fall back to raw app setting value if KV fails
    3. Return empty string if neither is available
    """
    logger.info('Config API endpoint called')
    
    config = {
        'azureMapsKey': '',
        'storageAccountUrl': os.environ.get('STORAGE_ACCOUNT_URL', ''),
        'datasetsContainer': os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')
    }
    
    # Get Key Vault name from environment
    kv_name = os.environ.get('KEY_VAULT_NAME')
    
    # Try to get Azure Maps key from Key Vault using REST API
    if kv_name:
        logger.info(f'Attempting to retrieve Azure Maps key from Key Vault: {kv_name}')
        
        # Get managed identity token for Key Vault
        token = get_managed_identity_token('https://vault.azure.net')
        
        if token:
            logger.info('✅ Obtained MI token for Key Vault')
            
            # Fetch secret using REST API
            secret_value = get_keyvault_secret(kv_name, 'AZURE-MAPS-SUBSCRIPTION-KEY', token)
            
            if secret_value:
                config['azureMapsKey'] = secret_value
                logger.info(f'✅ Retrieved Azure Maps key from Key Vault (length: {len(secret_value)})')
            else:
                logger.error('❌ Failed to retrieve secret from Key Vault')
        else:
            logger.error('❌ Failed to obtain MI token')
    else:
        logger.warning('KEY_VAULT_NAME not set - skipping Key Vault lookup')
    
    # Fall back to app settings if Key Vault failed  
    # (Check if it's an actual key, not a KV reference string)
    if not config['azureMapsKey']:
        app_setting_key = os.environ.get('AZURE_MAPS_SUBSCRIPTION_KEY', '')
        if app_setting_key and not app_setting_key.startswith('@Microsoft.KeyVault'):
            config['azureMapsKey'] = app_setting_key
            logger.info('⚠️  Using Azure Maps key from app settings (fallback)')
        elif app_setting_key:
            logger.warning(f'⚠️  App setting contains KV reference (not resolved): {app_setting_key[:50]}...')
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
