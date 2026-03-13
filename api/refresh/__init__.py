"""
Data refresh pipeline for Sentinel Activity Maps.

Queries Microsoft Sentinel (Log Analytics) for MDE device data and sign-in
activity, enriches public IPs with MaxMind, and writes GeoJSON to blob storage
for the SWA to consume.

The SWA calls this on page load as a fire-and-forget request. Returns immediately
if data is already fresh or another refresh is already running — no wasted spend.

Required app settings:
  STORAGE_ACCOUNT_URL         — https://<account>.blob.core.windows.net
  STORAGE_CONTAINER_DATASETS  — blob container name (default: datasets)
  SENTINEL_WORKSPACE_ID       — Log Analytics workspace GUID
  MAXMIND_ACCOUNT_ID          — shared with the lookup-ip function
  MAXMIND_LICENSE_KEY         — shared with the lookup-ip function

Optional app settings:
  REFRESH_INTERVAL_HOURS        — minimum hours between refreshes (default: 4)
  REFRESH_DEVICE_LOOKBACK_HOURS — how far back to query MDE data (default: 24)
  REFRESH_SIGNIN_LOOKBACK_HOURS — how far back to query sign-in data (default: 24)
  SENTINEL_DEVICES_KQL          — override the default MDE KQL query
  SENTINEL_SIGNIN_KQL           — override the default sign-in activity KQL query
"""
import azure.functions as func
import base64
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from urllib import error as urllib_error
from urllib import request as urllib_request

logger = logging.getLogger(__name__)

REFRESH_INTERVAL_HOURS = float(os.environ.get('REFRESH_INTERVAL_HOURS', '4'))


# ── Blob helpers ──────────────────────────────────────────────────────────────

def _blob_client(container, blob_name):
    from azure.identity import DefaultAzureCredential
    from azure.storage.blob import BlobServiceClient
    url = os.environ.get('STORAGE_ACCOUNT_URL', '')
    if not url:
        raise EnvironmentError('STORAGE_ACCOUNT_URL not configured')
    return BlobServiceClient(account_url=url, credential=DefaultAzureCredential()).get_blob_client(
        container=container, blob=blob_name
    )


def _blob_age_hours(container, blob_name):
    """Return hours since last modification, or None if the blob does not exist."""
    try:
        props = _blob_client(container, blob_name).get_blob_properties()
        return (datetime.now(timezone.utc) - props['last_modified']).total_seconds() / 3600
    except Exception:
        return None


def _is_locked(container):
    """True if another refresh is in progress (lock blob written within last 30 min)."""
    age = _blob_age_hours(container, 'refresh.lock')
    return age is not None and age < 0.5


def _set_lock(container, locked):
    try:
        client = _blob_client(container, 'refresh.lock')
        if locked:
            client.upload_blob(datetime.now(timezone.utc).isoformat().encode(), overwrite=True)
        else:
            try:
                client.delete_blob()
            except Exception:
                pass
    except Exception as e:
        logger.warning(f'Lock update failed: {e}')


def _upload(container, blob_name, data_bytes, content_type='application/json'):
    from azure.storage.blob import ContentSettings
    _blob_client(container, blob_name).upload_blob(
        data=data_bytes,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )


# ── Sentinel ──────────────────────────────────────────────────────────────────

def _query_sentinel(workspace_id, kql, lookback_hours=24):
    """Run a KQL query against a Sentinel Log Analytics workspace."""
    from azure.identity import DefaultAzureCredential
    from azure.monitor.query import LogsQueryClient, LogsQueryStatus
    client = LogsQueryClient(DefaultAzureCredential())
    result = client.query_workspace(workspace_id, kql, timespan=timedelta(hours=lookback_hours))
    if result.status != LogsQueryStatus.SUCCESS:
        raise RuntimeError(f'KQL query failed: {result.partial_error}')
    if not result.tables:
        return []
    t = result.tables[0]
    return [dict(zip(t.columns, row)) for row in t.rows]


def _default_devices_kql():
    hours = int(os.environ.get('REFRESH_DEVICE_LOOKBACK_HOURS', '24'))
    return (
        f'DeviceInfo\n'
        f'| where Timestamp > ago({hours}h)\n'
        f'| summarize arg_max(Timestamp, *) by DeviceId\n'
        f'| where isnotempty(PublicIP)\n'
        f'| project Timestamp, DeviceName, DeviceId, OSPlatform, DeviceType,\n'
        f'          CloudProvider, OnboardingStatus, PublicIP, SensorHealthState, ExposureLevel\n'
    )


def _default_signin_kql():
    hours = int(os.environ.get('REFRESH_SIGNIN_LOOKBACK_HOURS', '24'))
    return (
        f'SigninLogs\n'
        f'| where TimeGenerated > ago({hours}h)\n'
        f'| where ResultType == 0\n'
        f'| where isnotempty(IPAddress)\n'
        f'| summarize arg_max(TimeGenerated, *) by IPAddress, UserPrincipalName\n'
        f'| project TimeGenerated, UserPrincipalName, IPAddress, Location,\n'
        f'          AppDisplayName, ClientAppUsed, ConditionalAccessStatus\n'
    )


# ── MaxMind geo enrichment ────────────────────────────────────────────────────

def _enrich_ips(ips, cache):
    """
    Enrich unique IPs with MaxMind geolocation, storing results in cache.
    Skips IPs already in cache. Falls through city → country tiers to handle
    accounts where only the lower tier is available.
    """
    account_id = os.environ.get('MAXMIND_ACCOUNT_ID', '').strip()
    license_key = os.environ.get('MAXMIND_LICENSE_KEY', '').strip()
    if not account_id or not license_key:
        logger.warning('MaxMind credentials not configured — geo enrichment skipped')
        return

    auth = base64.b64encode(f'{account_id}:{license_key}'.encode()).decode()
    headers = {'Authorization': f'Basic {auth}', 'Accept': 'application/json'}

    new_ips = [ip for ip in ips if ip and ip not in cache]
    logger.info(f'MaxMind: enriching {len(new_ips)} new IPs ({len(ips) - len(new_ips)} already cached)')

    for ip in new_ips:
        for tier in ('city', 'country'):
            try:
                req = urllib_request.Request(
                    f'https://geoip.maxmind.com/geoip/v2.1/{tier}/{ip}', headers=headers
                )
                with urllib_request.urlopen(req, timeout=5) as resp:
                    d = json.loads(resp.read().decode())
                cache[ip] = {
                    'latitude':  d.get('location', {}).get('latitude'),
                    'longitude': d.get('location', {}).get('longitude'),
                    'country':   d.get('country', {}).get('iso_code', ''),
                    'city':      (d.get('city', {}).get('names') or {}).get('en', ''),
                }
                break
            except urllib_error.HTTPError as e:
                if e.code == 403:
                    continue  # tier not available on this plan, try next
                logger.warning(f'MaxMind {tier} lookup for {ip}: HTTP {e.code}')
                break
            except Exception as e:
                logger.warning(f'MaxMind {tier} lookup for {ip}: {e}')
                break


# ── GeoJSON builders ──────────────────────────────────────────────────────────

def _device_geojson(rows, geo_cache):
    """Build a GeoJSON FeatureCollection from MDE device rows and a geo cache."""
    features = []
    for row in rows:
        ip = (row.get('PublicIP') or '').strip()
        geo = geo_cache.get(ip, {})
        lat, lon = geo.get('latitude'), geo.get('longitude')
        if lat is None or lon is None:
            continue
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
            'properties': {
                'TimeGenerated':     str(row.get('Timestamp', '')),
                'DeviceName':        row.get('DeviceName', ''),
                'DeviceId':          row.get('DeviceId', ''),
                'OSPlatform':        row.get('OSPlatform', ''),
                'DeviceType':        row.get('DeviceType', ''),
                'CloudPlatform':     row.get('CloudProvider', ''),
                'OnboardingStatus':  row.get('OnboardingStatus', ''),
                'PublicIP':          ip,
                'SensorHealthState': row.get('SensorHealthState', ''),
                'ExposureLevel':     row.get('ExposureLevel', ''),
                'Country':           geo.get('country', ''),
                'City':              geo.get('city', ''),
            },
        })
    return {'type': 'FeatureCollection', 'features': features}


def _signin_geojson(rows, geo_cache):
    """Build a GeoJSON FeatureCollection from Sentinel sign-in rows and a geo cache."""
    features = []
    for row in rows:
        ip = (row.get('IPAddress') or '').strip()
        geo = geo_cache.get(ip, {})
        lat, lon = geo.get('latitude'), geo.get('longitude')
        if lat is None or lon is None:
            continue
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
            'properties': {
                'TimeGenerated':           str(row.get('TimeGenerated', '')),
                'UserPrincipalName':       row.get('UserPrincipalName', ''),
                'IPAddress':               ip,
                'Location':                str(row.get('Location', '')),
                'AppDisplayName':          row.get('AppDisplayName', ''),
                'ClientAppUsed':           row.get('ClientAppUsed', ''),
                'ConditionalAccessStatus': row.get('ConditionalAccessStatus', ''),
                'Country':                 geo.get('country', ''),
                'City':                    geo.get('city', ''),
            },
        })
    return {'type': 'FeatureCollection', 'features': features}


# ── Pipeline orchestrator ─────────────────────────────────────────────────────

def _run_pipeline(workspace_id, container):
    """
    Full pipeline: Sentinel KQL → deduplicate IPs → MaxMind enrich → GeoJSON → blob.
    A single geo_cache is shared across both datasets so IPs appearing in both
    device and sign-in data are only looked up once.
    """
    geo_cache = {}
    results = {}

    # MDE device locations
    kql = os.environ.get('SENTINEL_DEVICES_KQL') or _default_devices_kql()
    try:
        rows = _query_sentinel(workspace_id, kql)
        ips = list({r.get('PublicIP', '').strip() for r in rows if r.get('PublicIP', '').strip()})
        _enrich_ips(ips, geo_cache)
        gj = _device_geojson(rows, geo_cache)
        _upload(container, 'mde-devices.geojson', json.dumps(gj).encode())
        results['mde_devices'] = {'features': len(gj['features']), 'ips_enriched': len(ips)}
        logger.info(f"mde-devices.geojson — {len(gj['features'])} features from {len(rows)} rows")
    except Exception as e:
        logger.error(f'MDE pipeline step failed: {e}', exc_info=True)
        results['mde_devices'] = {'error': str(e)}

    # Sign-in activity (reuses geo_cache — avoids duplicate MaxMind calls)
    kql = os.environ.get('SENTINEL_SIGNIN_KQL') or _default_signin_kql()
    try:
        rows = _query_sentinel(workspace_id, kql)
        ips = list({r.get('IPAddress', '').strip() for r in rows if r.get('IPAddress', '').strip()})
        _enrich_ips(ips, geo_cache)
        gj = _signin_geojson(rows, geo_cache)
        _upload(container, 'signin-activity.geojson', json.dumps(gj).encode())
        results['signin_activity'] = {'features': len(gj['features']), 'ips_enriched': len(ips)}
        logger.info(f"signin-activity.geojson — {len(gj['features'])} features from {len(rows)} rows")
    except Exception as e:
        logger.error(f'Sign-in pipeline step failed: {e}', exc_info=True)
        results['signin_activity'] = {'error': str(e)}

    return results


# ── Entry point ───────────────────────────────────────────────────────────────

def _ok(data, status_code=200):
    return func.HttpResponse(
        body=json.dumps(data, indent=2),
        status_code=status_code,
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'},
    )


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Refresh pipeline entry point. Called by the SWA on page load (fire-and-forget)
    and can also be triggered manually for testing or forced refreshes.

    Query params:
      check=true  — report data freshness only, do not run the pipeline
      force=true  — bypass the freshness check and always run the pipeline
    """
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        })

    container = os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')
    check_only = req.params.get('check', '').lower() == 'true'
    force = req.params.get('force', '').lower() == 'true'

    # Staleness check uses only blob metadata — no Sentinel queries or data transfer
    tracked = ['mde-devices.geojson', 'signin-activity.geojson']
    ages = {b: _blob_age_hours(container, b) for b in tracked}
    known_ages = [h for h in ages.values() if h is not None]
    oldest = max(known_ages, default=None)
    is_fresh = oldest is not None and oldest < REFRESH_INTERVAL_HOURS

    if check_only:
        return _ok({
            'status': 'fresh' if is_fresh else 'stale',
            'blob_ages_hours': {k: round(v, 2) if v is not None else None for k, v in ages.items()},
            'refresh_interval_hours': REFRESH_INTERVAL_HOURS,
        })

    if is_fresh and not force:
        return _ok({
            'status': 'fresh',
            'message': f'Data is current — oldest blob is {oldest:.1f}h old. No refresh needed.',
            'blob_ages_hours': {k: round(v, 2) if v is not None else None for k, v in ages.items()},
        })

    if _is_locked(container) and not force:
        return _ok({'status': 'running', 'message': 'A refresh is already in progress.'})

    workspace_id = os.environ.get('SENTINEL_WORKSPACE_ID', '')
    if not workspace_id:
        return _ok({
            'status': 'skipped',
            'message': (
                'SENTINEL_WORKSPACE_ID is not configured. '
                'Set this app setting to enable automatic data refresh.'
            ),
        })

    _set_lock(container, True)
    try:
        started = datetime.now(timezone.utc)
        datasets = _run_pipeline(workspace_id, container)
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        return _ok({
            'status': 'updated',
            'elapsed_seconds': round(elapsed, 1),
            'datasets': datasets,
        })
    except Exception as e:
        logger.error(f'Pipeline error: {e}', exc_info=True)
        return _ok({'status': 'error', 'error': str(e)}, status_code=500)
    finally:
        _set_lock(container, False)
