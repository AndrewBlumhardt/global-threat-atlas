"""
Azure Static Web App API endpoint to serve threat intelligence data from blob storage.
Uses managed identity to access blob storage.
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
    logger.info(f'Function environment: STORAGE_ACCOUNT_URL={os.environ.get("STORAGE_ACCOUNT_URL")}, STORAGE_CONTAINER_DATASETS={os.environ.get("STORAGE_CONTAINER_DATASETS")}')
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
    logger.info(f'Received filename: {filename}')
    if not filename:
        logger.error('No filename specified in route params')
        return func.HttpResponse(
            '{"error": "No filename specified"}',
            status_code=400,
            mimetype='application/json',
            headers={'Access-Control-Allow-Origin': '*'}
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
    logger.info(f'Normalized blob name: {blob_name}, content_type: {content_type}')
    
    # Prepend demo_data/ folder if demo mode is enabled
    if demo_mode:
        blob_name = f'demo_data/{blob_name}'
        logger.info(f'Demo mode enabled - using demo data: {blob_name}')
    
    logger.info(f'Requesting blob: {blob_name}')
    

    # Only use managed identity for blob access
    storage_account_url = os.environ.get('STORAGE_ACCOUNT_URL', '')
    container_name = os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')
    logger.info(f'Using storage_account_url={storage_account_url}, container_name={container_name}')

    if not storage_account_url:
        logger.error('STORAGE_ACCOUNT_URL not configured')
        return func.HttpResponse(
            json.dumps({"error": "Storage not configured - STORAGE_ACCOUNT_URL missing"}),
            status_code=500,
            mimetype='application/json',
            headers={'Access-Control-Allow-Origin': '*'}
        )

    try:
        logger.info('Starting blob access logic (managed identity only)')
        if BlobServiceClient is None:
            logger.error(f'Storage SDK unavailable: {STORAGE_SDK_IMPORT_ERROR}')
            return func.HttpResponse(
                json.dumps({
                    'error': 'Storage SDK unavailable in SWA data function',
                    'details': str(STORAGE_SDK_IMPORT_ERROR)
                }),
                status_code=500,
                mimetype='application/json',
                headers={'Access-Control-Allow-Origin': '*'}
            )

        if DefaultAzureCredential is None:
            logger.error(f'Identity SDK unavailable: {IDENTITY_SDK_IMPORT_ERROR}')
            return func.HttpResponse(
                json.dumps({
                    'error': 'Identity SDK unavailable',
                    'details': str(IDENTITY_SDK_IMPORT_ERROR)
                }),
                status_code=500,
                mimetype='application/json',
                headers={'Access-Control-Allow-Origin': '*'}
            )

        credential = DefaultAzureCredential()
        blob_service_client = BlobServiceClient(account_url=storage_account_url, credential=credential)
        logger.info('✅ BlobServiceClient created using managed identity')

        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        logger.info(f'✅ Blob client created for {container_name}/{blob_name}')

        # Check if blob exists
        logger.info('Checking if blob exists...')
        exists = blob_client.exists()
        logger.info(f'✅ Blob exists: {exists}')

        # For HEAD requests, just return existence status
        if req.method == 'HEAD':
            logger.info(f'HEAD request for blob: {blob_name}, exists={exists}')
            if exists:
                logger.info('HEAD request: blob exists, returning 200')
                return func.HttpResponse(
                    status_code=200,
                    headers={
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    }
                )
            else:
                logger.info('HEAD request: blob does not exist, returning 404')
                return func.HttpResponse(
                    status_code=404,
                    headers={'Access-Control-Allow-Origin': '*'}
                )

        if not exists:
            logger.error(f'Blob not found: {blob_name}')
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
        logger.info(f'Downloading blob: {container_name}/{blob_name} using managed identity')
        blob_data = blob_client.download_blob()
        content = blob_data.readall()

        logger.info(f'Successfully retrieved {len(content)} bytes from blob {blob_name} using managed identity')

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
        logger.error(f'Error retrieving blob data with managed identity: {e}', exc_info=True)
        return func.HttpResponse(
            f'{{"error": "Failed to retrieve data: {str(e)}"}}',
            status_code=500,
            mimetype='application/json',
            headers={
                'Access-Control-Allow-Origin': '*'
            }
        )
