"""
Health check and keepalive endpoint.

Returns API status, configuration presence (not values), and blob data freshness
using metadata-only blob property reads — no data transfer.

Also serves as a periodic keepalive ping from the SWA. On Premium plan this
reduces cold-start frequency; on Consumption it acts as a lightweight
freshness monitor during active sessions.
"""
import azure.functions as func
import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _get_mi_token(resource='https://storage.azure.com/'):
    """Obtain a managed-identity token (App Service MSI or IMDS fallback)."""
    from urllib import request as _req
    import json as _json
    identity_endpoint = os.environ.get('IDENTITY_ENDPOINT')
    identity_header   = os.environ.get('IDENTITY_HEADER')
    if identity_endpoint and identity_header:
        url = f'{identity_endpoint}?resource={resource}&api-version=2019-08-01'
        r = _req.Request(url)
        r.add_header('X-IDENTITY-HEADER', identity_header)
    else:
        url = (
            'http://169.254.169.254/metadata/identity/oauth2/token'
            f'?api-version=2018-02-01&resource={resource}'
        )
        r = _req.Request(url, headers={'Metadata': 'true'})
    with _req.urlopen(r, timeout=10) as resp:
        return _json.loads(resp.read())['access_token']


def _blob_age_hours(storage_url, container, blob_name):
    """Return hours since last modification via blob REST HEAD, or None if inaccessible."""
    from urllib import request as _req, error as _err
    from email.utils import parsedate_to_datetime
    try:
        token = _get_mi_token()
        url = f"{storage_url.rstrip('/')}/{container}/{blob_name}"
        req = _req.Request(url, method='HEAD')
        req.add_header('Authorization', f'Bearer {token}')
        req.add_header('x-ms-version', '2020-04-08')
        with _req.urlopen(req) as resp:
            last_mod = resp.headers.get('Last-Modified')
            if not last_mod:
                return None
            dt = parsedate_to_datetime(last_mod)
            return round((datetime.now(timezone.utc) - dt).total_seconds() / 3600, 2)
    except Exception:
        return None


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns API health, configuration presence, blob data freshness, and SDK status.
    Configuration values are never included — only whether each setting is present.
    """
    logger.info('Health check called')

    storage_url = os.environ.get('STORAGE_ACCOUNT_URL', '')
    container = os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')

    # Report whether each required setting is configured — never the actual values
    config_status = {
        'storage_url':         bool(storage_url),
        'maps_key':            bool(os.environ.get('AZURE_MAPS_SUBSCRIPTION_KEY')),
        'sentinel_workspace':  bool(os.environ.get('SENTINEL_WORKSPACE_ID')),
        'maxmind_credentials': bool(
            os.environ.get('MAXMIND_ACCOUNT_ID') and os.environ.get('MAXMIND_LICENSE_KEY')
        ),
    }

    # Blob data freshness via metadata only — no data transferred
    data_freshness_hours = {}
    if storage_url:
        for blob in ('mde-devices.geojson', 'signin-activity.geojson', 'threat-intel-indicators.geojson'):
            data_freshness_hours[blob] = _blob_age_hours(storage_url, container, blob)

    # SDK availability — import the specific class so namespace-package false
    # positives are avoided (__import__ alone succeeds for dirs without __init__.py)
    sdk_checks = [
        ('azure.identity',       'azure.identity',       'DefaultAzureCredential'),
        ('azure.storage.blob',   'azure.storage.blob',   'BlobServiceClient'),
        ('azure.monitor.query',  'azure.monitor.query',  'LogsQueryClient'),
    ]
    sdk_status = {}
    for label, module, attr in sdk_checks:
        try:
            mod = __import__(module, fromlist=[attr])
            getattr(mod, attr)
            sdk_status[label] = 'available'
        except Exception:
            sdk_status[label] = 'unavailable'

    return func.HttpResponse(
        body=json.dumps({
            'status': 'healthy',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'configuration': config_status,
            'data_freshness_hours': data_freshness_hours,
            'sdk': sdk_status,
        }, indent=2),
        mimetype='application/json',
        headers={
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
        },
    )
