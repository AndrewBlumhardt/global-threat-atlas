"""
Azure Static Web App API endpoint to proxy threat intelligence data from blob storage.
Uses Managed Identity with DefaultAzureCredential for RBAC-only access.
"""
import azure.functions as func
import logging
import json
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential
import os

logger = logging.getLogger(__name__)


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
    
    # Get storage configuration
    # Note: SWA app settings can use Key Vault references
    # @Microsoft.KeyVault(SecretUri=https://vault.vault.azure.net/secrets/...)
    connection_string = os.environ.get('STORAGE_CONNECTION_STRING', '')
    container_name = os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')
    
    if not connection_string:
        logger.error('STORAGE_CONNECTION_STRING not configured')
        return func.HttpResponse(
            json.dumps({"error": "Storage not configured - STORAGE_CONNECTION_STRING missing"}),
            status_code=500,
            mimetype='application/json',
            headers={'Access-Control-Allow-Origin': '*'}
        )
    
    try:
        # Create BlobServiceClient with connection string
        # (SWA resolves Key Vault references automatically)
        logger.info(f'Creating blob service client for container: {container_name}')
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        logger.info('✅ BlobServiceClient created (connection string)')
        
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
