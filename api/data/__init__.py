"""
Azure Static Web App API endpoint to serve threat intelligence data from blob storage.
Uses managed identity via IMDS — no azure SDK packages required for this function.
"""
import azure.functions as func
import logging
import json
import os
from urllib import request as urllib_request
from urllib import error as urllib_error

logger = logging.getLogger(__name__)

_CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

# ---------------------------------------------------------------------------
# Token cache — MI tokens are valid ~1 hour; refresh 10 min before expiry.
# ---------------------------------------------------------------------------
import time as _time
_token_cache: dict = {}   # keys: resource -> {token, expires_at}


def _get_mi_token(resource='https://storage.azure.com/'):
    """
    Obtain a managed-identity bearer token, reusing a cached copy when still
    valid.  Fetching a fresh token on every invocation adds ~100-400 ms and
    causes contention when multiple requests arrive simultaneously on cold start.
    """
    now = _time.time()
    cached = _token_cache.get(resource)
    if cached and cached['expires_at'] > now:
        return cached['token']

    identity_endpoint = os.environ.get('IDENTITY_ENDPOINT')
    identity_header   = os.environ.get('IDENTITY_HEADER')
    if identity_endpoint and identity_header:
        url = f'{identity_endpoint}?resource={resource}&api-version=2019-08-01'
        req = urllib_request.Request(url)
        req.add_header('X-IDENTITY-HEADER', identity_header)
    else:
        url = (
            'http://169.254.169.254/metadata/identity/oauth2/token'
            f'?api-version=2018-02-01&resource={resource}'
        )
        req = urllib_request.Request(url, headers={'Metadata': 'true'})
    with urllib_request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())

    token = data['access_token']
    # expires_on is a Unix timestamp string; cache with a 10-minute safety margin
    expires_on = int(data.get('expires_on', now + 3600))
    _token_cache[resource] = {'token': token, 'expires_at': expires_on - 600}
    return token


def _blob_fetch(storage_url, container, blob_name, method='GET'):
    """
    Perform an authenticated GET or HEAD request against Azure Blob Storage
    using a managed-identity token. Returns (http_status, body_bytes_or_None).
    Raises RuntimeError if the token cannot be obtained.
    """
    token = _get_mi_token()
    blob_url = f"{storage_url.rstrip('/')}/{container}/{blob_name}"
    req = urllib_request.Request(blob_url, method=method)
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('x-ms-version', '2020-04-08')
    try:
        with urllib_request.urlopen(req) as resp:
            return resp.status, (None if method == 'HEAD' else resp.read())
    except urllib_error.HTTPError as exc:
        return exc.code, None


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns threat intelligence / map data from blob storage.
    Route parameter 'filename' determines which blob to fetch.
    """
    logger.info(f'Data API endpoint called: {req.method}')

    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers=_CORS_HEADERS)

    filename = req.route_params.get('filename')
    if not filename:
        return func.HttpResponse(
            json.dumps({'error': 'No filename specified'}),
            status_code=400, mimetype='application/json',
            headers={'Access-Control-Allow-Origin': '*'},
        )

    demo_mode = req.params.get('demo', '').lower() == 'true'

    if filename.endswith('.tsv'):
        blob_name, content_type = filename, 'text/tab-separated-values'
    elif filename.endswith('.geojson'):
        blob_name, content_type = filename, 'application/json'
    else:
        blob_name, content_type = f'{filename}.geojson', 'application/json'

    if demo_mode:
        blob_name = f'demo_data/{blob_name}'
        logger.info(f'Demo mode — using blob: {blob_name}')

    storage_url = os.environ.get('STORAGE_ACCOUNT_URL', '')
    container  = os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')

    if not storage_url:
        return func.HttpResponse(
            json.dumps({'error': 'STORAGE_ACCOUNT_URL not configured'}),
            status_code=500, mimetype='application/json',
            headers={'Access-Control-Allow-Origin': '*'},
        )

    try:
        method = req.method if req.method in ('GET', 'HEAD') else 'GET'
        status, body = _blob_fetch(storage_url, container, blob_name, method)
        logger.info(f'Blob fetch {method} {blob_name} -> HTTP {status}')

        if status == 404:
            return func.HttpResponse(
                json.dumps({'error': f'File not found: {blob_name}'}),
                status_code=404, mimetype='application/json',
                headers={'Access-Control-Allow-Origin': '*'},
            )
        if status != 200:
            return func.HttpResponse(
                json.dumps({'error': f'Blob storage returned {status}'}),
                status_code=502, mimetype='application/json',
                headers={'Access-Control-Allow-Origin': '*'},
            )

        if method == 'HEAD':
            return func.HttpResponse(
                status_code=200,
                headers={'Access-Control-Allow-Origin': '*', 'Content-Type': content_type},
            )

        logger.info(f'Returning {len(body)} bytes for {blob_name}')
        return func.HttpResponse(
            body=body,
            mimetype=content_type,
            headers={
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300',
                'Content-Type': content_type,
            },
        )

    except Exception as exc:
        logger.error(f'Error fetching blob {blob_name}: {exc}', exc_info=True)
        return func.HttpResponse(
            json.dumps({'error': str(exc)}),
            status_code=500, mimetype='application/json',
            headers={'Access-Control-Allow-Origin': '*'},
        )
