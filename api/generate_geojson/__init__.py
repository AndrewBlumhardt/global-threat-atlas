"""
GeoJSON generation endpoint.

Downloads an enriched TSV from blob storage, converts it to GeoJSON, and uploads
the result. Used for manual pipeline runs and re-processing existing enriched
data without re-querying Sentinel or MaxMind.

GET/POST /api/generate_geojson?source=<blob>&target=<blob>&type=devices|signin

Query params:
  source  — source blob name containing the enriched TSV
             (e.g. mde-devices-enriched.tsv)
  target  — target blob name for the output GeoJSON
             (e.g. mde-devices.geojson)
  type    — record type: 'devices' (default) or 'signin'

Required app settings: STORAGE_ACCOUNT_URL, STORAGE_CONTAINER_DATASETS
"""
import csv
import io
import azure.functions as func
import json
import logging
import os

logger = logging.getLogger(__name__)


def _blob_client(container, blob_name):
    from azure.identity import DefaultAzureCredential
    from azure.storage.blob import BlobServiceClient
    url = os.environ.get('STORAGE_ACCOUNT_URL', '')
    if not url:
        raise EnvironmentError('STORAGE_ACCOUNT_URL not configured')
    return BlobServiceClient(account_url=url, credential=DefaultAzureCredential()).get_blob_client(
        container=container, blob=blob_name
    )


def _device_feature(row):
    """Convert an enriched TSV row to a GeoJSON Feature for an MDE device."""
    try:
        lat = float(row.get('Latitude', '') or '')
        lon = float(row.get('Longitude', '') or '')
    except ValueError:
        return None
    return {
        'type': 'Feature',
        'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
        'properties': {
            'TimeGenerated':     row.get('TimeGenerated', ''),
            'DeviceName':        row.get('DeviceName', ''),
            'DeviceId':          row.get('DeviceId', ''),
            'OSPlatform':        row.get('OSPlatform', ''),
            'DeviceType':        row.get('DeviceType', ''),
            'CloudPlatform':     row.get('CloudPlatform', ''),
            'OnboardingStatus':  row.get('OnboardingStatus', ''),
            'PublicIP':          row.get('PublicIP', ''),
            'SensorHealthState': row.get('SensorHealthState', ''),
            'ExposureLevel':     row.get('ExposureLevel', ''),
            'Country':           row.get('Country', ''),
            'City':              row.get('City', ''),
        },
    }


def _signin_feature(row):
    """Convert an enriched TSV row to a GeoJSON Feature for a sign-in event."""
    try:
        lat = float(row.get('Latitude', '') or '')
        lon = float(row.get('Longitude', '') or '')
    except ValueError:
        return None
    return {
        'type': 'Feature',
        'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
        'properties': {
            'TimeGenerated':           row.get('TimeGenerated', ''),
            'UserPrincipalName':       row.get('UserPrincipalName', ''),
            'IPAddress':               row.get('IPAddress', ''),
            'Location':                row.get('Location', ''),
            'AppDisplayName':          row.get('AppDisplayName', ''),
            'ClientAppUsed':           row.get('ClientAppUsed', ''),
            'ConditionalAccessStatus': row.get('ConditionalAccessStatus', ''),
            'Country':                 row.get('Country', ''),
            'City':                    row.get('City', ''),
        },
    }


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Convert an enriched TSV blob to GeoJSON and write the result back to blob storage.
    Both source and target blob names are required as query parameters.
    """
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        })

    source = req.params.get('source', '').strip()
    target = req.params.get('target', '').strip()
    record_type = req.params.get('type', 'devices').strip().lower()

    if not source or not target:
        return _error("Both 'source' (enriched TSV blob name) and 'target' (GeoJSON blob name) are required.")
    if record_type not in ('devices', 'signin'):
        return _error("'type' must be 'devices' or 'signin'.")

    container = os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')

    try:
        raw = _blob_client(container, source).download_blob().readall()
        reader = csv.DictReader(io.StringIO(raw.decode('utf-8')), delimiter='\t')
        rows = list(reader)
    except Exception as e:
        logger.error(f'Failed to read source blob {source}: {e}')
        return _error(f'Could not read source blob \'{source}\': {e}', 500)

    converter = _device_feature if record_type == 'devices' else _signin_feature
    features = [f for f in (converter(r) for r in rows) if f is not None]
    skipped = len(rows) - len(features)

    try:
        from azure.storage.blob import ContentSettings
        _blob_client(container, target).upload_blob(
            data=json.dumps({'type': 'FeatureCollection', 'features': features}).encode(),
            overwrite=True,
            content_settings=ContentSettings(content_type='application/json'),
        )
    except Exception as e:
        logger.error(f'Failed to write target blob {target}: {e}')
        return _error(f'Could not write target blob \'{target}\': {e}', 500)

    return func.HttpResponse(
        body=json.dumps({
            'status': 'ok',
            'source': source,
            'target': target,
            'features_written': len(features),
            'rows_skipped_no_coords': skipped,
        }, indent=2),
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*'},
    )


def _error(message, status_code=400):
    return func.HttpResponse(
        body=json.dumps({'error': message}),
        status_code=status_code,
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*'},
    )
