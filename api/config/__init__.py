"""
Azure Static Web App API endpoint to retrieve configuration securely.
"""
import azure.functions as func
import json
import os
import logging
from urllib import request as urllib_request
from urllib import error as urllib_error

logger = logging.getLogger(__name__)


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns configuration for the web app.
    Preferred path: proxy to Function App /api/config so SWA does not store Maps key.
    Fallback path: local SWA app settings for resilience.
    """
    logger.info('Config API endpoint called')

    function_app_base_url = os.environ.get('FUNCTION_APP_BASE_URL', '').rstrip('/')
    require_proxy = os.environ.get('REQUIRE_FUNCTION_CONFIG_PROXY', 'false').lower() == 'true'
    proxy_error = None
    if function_app_base_url:
        target_url = f"{function_app_base_url}/api/config"
        try:
            logger.info(f'Proxying config request to Function App: {target_url}')
            with urllib_request.urlopen(target_url, timeout=10) as response:
                body = response.read().decode('utf-8')
                proxied_config = json.loads(body)

            # Add source metadata for troubleshooting and security validation.
            if isinstance(proxied_config, dict):
                proxied_config['configSource'] = 'function-proxy'

            return func.HttpResponse(
                body=json.dumps(proxied_config),
                mimetype='application/json',
                headers={
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            )
        except (urllib_error.URLError, urllib_error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            proxy_error = str(e)
            logger.warning(f'Function App config proxy failed, using local fallback: {e}')

    if require_proxy:
        return func.HttpResponse(
            body=json.dumps({
                'error': 'Function config proxy required but unavailable',
                'configSource': 'proxy-required-error',
                'proxyError': proxy_error or 'FUNCTION_APP_BASE_URL missing'
            }),
            status_code=502,
            mimetype='application/json',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        )

    config = {
        'azureMapsKey': os.environ.get('AZURE_MAPS_SUBSCRIPTION_KEY', ''),
        'storageAccountUrl': os.environ.get('STORAGE_ACCOUNT_URL', ''),
        'datasetsContainer': os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets'),
        'configSource': 'swa-fallback'
    }
    
    return func.HttpResponse(
        body=json.dumps(config),
        mimetype='application/json',
        headers={
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    )
