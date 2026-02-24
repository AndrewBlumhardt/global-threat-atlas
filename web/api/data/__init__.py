"""
Azure Static Web App API endpoint to serve threat intelligence data from blob storage.
Uses STORAGE_CONNECTION_STRING to access blob storage.
"""
import azure.functions as func
import logging
import json
import os
from urllib import request as urllib_request
from urllib import error as urllib_error
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

try:
    from azure.storage.blob import BlobServiceClient
    STORAGE_SDK_IMPORT_ERROR = None
except Exception as import_error:
    BlobServiceClient = None
    STORAGE_SDK_IMPORT_ERROR = import_error

try:
    from azure.identity import DefaultAzureCredential
    IDENTITY_SDK_IMPORT_ERROR = None
except Exception as import_error:
    DefaultAzureCredential = None
    IDENTITY_SDK_IMPORT_ERROR = import_error


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns threat intelligence GeoJSON data from blob storage.
    Route parameter 'filename' determines which file to fetch.
    """
    logger.info(f'Data API endpoint called: {req.method}')
    
    # Handle CORS preflight  
    if req.method == 'OPTIONS':
        return func.HttpResponse(
            status_code=200,
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        )
    
    # Get filename from route parameter
    filename = req.route_params.get('filename')
    if not filename:
        return func.HttpResponse(
            '{"error": "No filename specified"}',
            status_code=400,
            mimetype='application/json'
        )
    
    # Check if demo mode is enabled via query parameter
    demo_mode = req.params.get('demo', '').lower() == 'true'
    
    # Determine blob name and content type based on file extension
    if filename.endswith('.tsv'):
        blob_name = filename
        content_type = 'text/tab-separated-values'
    elif filename.endswith('.geojson'):
        blob_name = filename
        content_type = 'application/json'
    else:
        # Default: add .geojson extension
        blob_name = f'{filename}.geojson'
        content_type = 'application/json'
    
    # Prepend demo_data/ folder if demo mode is enabled
    if demo_mode:
        blob_name = f'demo_data/{blob_name}'
        logger.info(f'Demo mode enabled - using demo data')
    
    logger.info(f'Requesting blob: {blob_name}')
    
    # Preferred path: proxy data request to Function App /api/data endpoint.
    # This keeps storage auth centralized in the Function App and avoids SWA secrets.
    function_app_base_url = os.environ.get('FUNCTION_APP_BASE_URL', '').rstrip('/')
    require_proxy = os.environ.get('REQUIRE_FUNCTION_DATA_PROXY', 'false').lower() == 'true'

    if function_app_base_url:
        query_pairs = []
        for key in req.params.keys():
            value = req.params.get(key)
            if value is not None:
                query_pairs.append((key, value))

        query_string = urlencode(query_pairs)
        target_url = f"{function_app_base_url}/api/data/{filename}"
        if query_string:
            target_url = f"{target_url}?{query_string}"

        try:
            logger.info(f'Proxying data request to Function App: {target_url}')
            proxy_request = urllib_request.Request(target_url, method=req.method)
            with urllib_request.urlopen(proxy_request, timeout=20) as response:
                proxied_body = response.read()
                proxied_content_type = response.headers.get('Content-Type', content_type)

            return func.HttpResponse(
                body=proxied_body,
                status_code=200,
                mimetype=proxied_content_type,
                headers={
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=300',
                    'Content-Type': proxied_content_type
                }
            )
        except urllib_error.HTTPError as http_error:
            logger.warning(f'Function App data proxy returned HTTP error: {http_error.code}')
            if require_proxy:
                error_body = http_error.read()
                return func.HttpResponse(
                    body=error_body,
                    status_code=http_error.code,
                    mimetype=http_error.headers.get('Content-Type', 'application/json'),
                    headers={'Access-Control-Allow-Origin': '*'}
                )
            logger.info('Function App data proxy is optional; falling back to local blob read path')
        except Exception as proxy_error:
            logger.warning(f'Function App data proxy failed, using local fallback: {proxy_error}')
            if require_proxy:
                return func.HttpResponse(
                    body=json.dumps({
                        'error': 'Function data proxy required but unavailable',
                        'proxyError': str(proxy_error)
                    }),
                    status_code=502,
                    mimetype='application/json',
                    headers={'Access-Control-Allow-Origin': '*'}
                )

    # Fallback path: access blob directly from SWA API with managed identity.
    # Keep this for local/dev resilience when FUNCTION_APP_BASE_URL is not set.
    storage_account_url = os.environ.get('STORAGE_ACCOUNT_URL', '')
    container_name = os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')

    if not storage_account_url:
        logger.error('STORAGE_ACCOUNT_URL not configured')
        return func.HttpResponse(
            json.dumps({"error": "Storage not configured - STORAGE_ACCOUNT_URL missing"}),
            status_code=500,
            mimetype='application/json',
            headers={'Access-Control-Allow-Origin': '*'}
        )
    
    try:
        if BlobServiceClient is None:
            return func.HttpResponse(
                json.dumps({
                    'error': 'Storage SDK unavailable in SWA data function',
                    'details': str(STORAGE_SDK_IMPORT_ERROR)
                }),
                status_code=500,
                mimetype='application/json',
                headers={'Access-Control-Allow-Origin': '*'}
            )

        # Create BlobServiceClient with managed identity first.
        # Fallback to connection string only if MI auth fails.
        logger.info(f'Creating blob service client for container: {container_name}')
        try:
            if DefaultAzureCredential is None:
                raise RuntimeError(f'Identity SDK unavailable: {IDENTITY_SDK_IMPORT_ERROR}')
            credential = DefaultAzureCredential()
            blob_service_client = BlobServiceClient(account_url=storage_account_url, credential=credential)
            logger.info('✅ BlobServiceClient created (managed identity)')
        except Exception as mi_error:
            logger.warning(f'Managed identity auth failed in SWA API fallback: {mi_error}')
            connection_string = os.environ.get('STORAGE_CONNECTION_STRING', '')
            if not connection_string:
                return func.HttpResponse(
                    json.dumps({
                        'error': 'Storage authentication unavailable',
                        'details': 'Managed identity failed and STORAGE_CONNECTION_STRING is missing'
                    }),
                    status_code=500,
                    mimetype='application/json',
                    headers={'Access-Control-Allow-Origin': '*'}
                )
            blob_service_client = BlobServiceClient.from_connection_string(connection_string)
            logger.info('✅ BlobServiceClient created (connection string fallback)')
        
        # Get blob client
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        logger.info(f'✅ Blob client created for {container_name}/{blob_name}')
        
        # Check if blob exists
        logger.info('Checking if blob exists...')
        exists = blob_client.exists()
        logger.info(f'✅ Blob exists: {exists}')
        
        # For HEAD requests, just return existence status
        if req.method == 'HEAD':
            if exists:
                return func.HttpResponse(
                    status_code=200,
                    headers={
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    }
                )
            else:
                return func.HttpResponse(
                    status_code=404,
                    headers={'Access-Control-Allow-Origin': '*'}
                )
            
        if not exists:
            # List available blobs to help with debugging
            logger.info('Blob not found, listing available blobs...')
            try:
                container_client = blob_service_client.get_container_client(container_name)
                blobs = [blob.name for blob in container_client.list_blobs()]
                logger.error(f'Blob not found: {blob_name}. Available blobs: {blobs}')
                return func.HttpResponse(
                    f'{{"error": "File not found: {blob_name}", "available_files": {json.dumps(blobs)}}}',
                    status_code=404,
                    mimetype='application/json',
                    headers={'Access-Control-Allow-Origin': '*'}
                )
            except Exception as e:
                logger.error(f'Failed to list blobs: {e}')
                return func.HttpResponse(
                    f'{{"error": "File not found: {blob_name}", "list_error": "{str(e)}"}}',
                    status_code=404,
                    mimetype='application/json',
                    headers={'Access-Control-Allow-Origin': '*'}
                )
        
        # Download the blob
        logger.info(f'Downloading blob: {container_name}/{blob_name}')
        blob_data = blob_client.download_blob()
        content = blob_data.readall()
        
        logger.info(f'Successfully retrieved {len(content)} bytes')
        
        return func.HttpResponse(
            body=content,
            mimetype=content_type,
            headers={
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300',  # Cache for 5 minutes
                'Content-Type': content_type
            }
        )
        
    except Exception as e:
        logger.error(f'Error retrieving blob data: {e}')
        return func.HttpResponse(
            f'{{"error": "Failed to retrieve data: {str(e)}"}}',
            status_code=500,
            mimetype='application/json',
            headers={
                'Access-Control-Allow-Origin': '*'
            }
        )
