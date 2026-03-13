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


def _blob_age_hours(storage_url, container, blob_name):
    """Return hours since last modification, or None if inaccessible."""
    try:
        from azure.identity import DefaultAzureCredential
        from azure.storage.blob import BlobServiceClient
        client = BlobServiceClient(account_url=storage_url, credential=DefaultAzureCredential())
        props = client.get_blob_client(container=container, blob=blob_name).get_blob_properties()
        return round((datetime.now(timezone.utc) - props['last_modified']).total_seconds() / 3600, 2)
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

    # SDK availability
    sdk_status = {}
    for module in ('azure.identity', 'azure.storage.blob', 'azure.monitor.query'):
        try:
            __import__(module)
            sdk_status[module] = 'available'
        except ImportError:
            sdk_status[module] = 'unavailable'

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
