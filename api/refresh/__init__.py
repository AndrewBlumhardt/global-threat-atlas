"""
Data refresh pipeline for Sentinel Activity Maps.

Three independent pipelines — each with its own frequency, lookback, and output files:

  MDE Devices  : KQL → mde-devices.tsv → MaxMind → mde-devices.geojson
  Sign-in      : KQL → signin-activity.tsv → MaxMind → signin-activity.geojson
  Threat Intel : KQL → threat-intel-indicators.tsv → MaxMind → threat-intel-indicators.geojson

Each pipeline checks its own freshness; stale pipelines run, fresh ones are skipped.

Required app settings:
  STORAGE_ACCOUNT_URL         — https://<account>.blob.core.windows.net
  STORAGE_CONTAINER_DATASETS  — blob container name (default: datasets)
  SENTINEL_WORKSPACE_ID       — Log Analytics workspace GUID
  MAXMIND_ACCOUNT_ID          — MaxMind GeoIP account ID
  MAXMIND_LICENSE_KEY         — MaxMind GeoIP license key

Optional app settings:
  REFRESH_DEVICE_FREQUENCY_MINUTES    — how often to refresh MDE devices (default: 15)
  REFRESH_DEVICE_LOOKBACK_HOURS       — how far back to query MDE data (default: 168)
  REFRESH_SIGNIN_FREQUENCY_MINUTES    — how often to refresh sign-in activity (default: 15)
  REFRESH_SIGNIN_LOOKBACK_HOURS       — how far back to query sign-in data (default: 168)
  REFRESH_THREATINTEL_FREQUENCY_HOURS — how often to refresh threat intel (default: 24)
  SENTINEL_DEVICES_KQL                — override default MDE KQL query
  SENTINEL_SIGNIN_KQL                 — override default sign-in KQL query
  SENTINEL_THREATINTEL_KQL            — override default threat intel KQL query
"""
import azure.functions as func
import base64
import geoip2.database
import io
import json
import logging
import os
import tarfile
from datetime import datetime, timedelta, timezone
from urllib import error as urllib_error
from urllib import request as urllib_request

logger = logging.getLogger(__name__)

_THREATINTEL_LOOKBACK_HOURS = 360  # 15 days — static, not configurable
_GEOIP_DB_PATH              = '/tmp/GeoLite2-City.mmdb'
_GEOIP_DB_MAX_AGE_DAYS      = 7


# ── Managed Identity helpers ──────────────────────────────────────────────────

_BLOB_RESOURCE   = 'https://storage.azure.com/'
_LA_RESOURCE     = 'https://api.loganalytics.io/'
_BLOB_API_VER    = '2020-04-08'


def _get_mi_token(resource):
    """Acquire a bearer token via the App Service MSI endpoint (IMDS fallback for local)."""
    identity_endpoint = os.environ.get('IDENTITY_ENDPOINT')
    identity_header   = os.environ.get('IDENTITY_HEADER')
    if identity_endpoint and identity_header:
        url = f'{identity_endpoint}?resource={resource}&api-version=2019-08-01'
        req = urllib_request.Request(url)
        req.add_header('X-IDENTITY-HEADER', identity_header)
    else:
        url = ('http://169.254.169.254/metadata/identity/oauth2/token'
               f'?api-version=2018-02-01&resource={resource}')
        req = urllib_request.Request(url, headers={'Metadata': 'true'})
    with urllib_request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())['access_token']


# ── Blob helpers ──────────────────────────────────────────────────────────────

def _blob_url(container, blob_name):
    url = os.environ.get('STORAGE_ACCOUNT_URL', '').rstrip('/')
    if not url:
        raise EnvironmentError('STORAGE_ACCOUNT_URL not configured')
    return f'{url}/{container}/{blob_name}'


def _blob_age_hours(container, blob_name):
    """Return hours since last modification, or None if the blob does not exist."""
    from email.utils import parsedate_to_datetime
    try:
        token = _get_mi_token(_BLOB_RESOURCE)
        req = urllib_request.Request(_blob_url(container, blob_name), method='HEAD')
        req.add_header('Authorization', f'Bearer {token}')
        req.add_header('x-ms-version', _BLOB_API_VER)
        with urllib_request.urlopen(req, timeout=10) as resp:
            last_mod = resp.headers.get('Last-Modified')
            if not last_mod:
                return None
            return (datetime.now(timezone.utc) - parsedate_to_datetime(last_mod)).total_seconds() / 3600
    except urllib_error.HTTPError as e:
        if e.code == 404:
            return None
        logger.warning(f'Blob HEAD {blob_name}: HTTP {e.code}')
        return None
    except Exception as e:
        logger.warning(f'Blob HEAD {blob_name}: {e}')
        return None


def _is_locked(container):
    """True if another refresh is in progress (lock blob written within last 30 min)."""
    age = _blob_age_hours(container, 'refresh.lock')
    return age is not None and age < 0.5


def _set_lock(container, locked):
    try:
        token = _get_mi_token(_BLOB_RESOURCE)
        url = _blob_url(container, 'refresh.lock')
        if locked:
            data = datetime.now(timezone.utc).isoformat().encode()
            req = urllib_request.Request(url, data=data, method='PUT')
            req.add_header('Authorization', f'Bearer {token}')
            req.add_header('x-ms-version', _BLOB_API_VER)
            req.add_header('x-ms-blob-type', 'BlockBlob')
            req.add_header('Content-Type', 'text/plain')
            req.add_header('Content-Length', str(len(data)))
            urllib_request.urlopen(req, timeout=10).close()
        else:
            req = urllib_request.Request(url, method='DELETE')
            req.add_header('Authorization', f'Bearer {token}')
            req.add_header('x-ms-version', _BLOB_API_VER)
            try:
                urllib_request.urlopen(req, timeout=10).close()
            except urllib_error.HTTPError as e:
                if e.code != 404:
                    raise
    except Exception as e:
        logger.warning(f'Lock update failed: {e}')


def _upload(container, blob_name, data_bytes, content_type='application/json'):
    token = _get_mi_token(_BLOB_RESOURCE)
    url = _blob_url(container, blob_name)
    req = urllib_request.Request(url, data=data_bytes, method='PUT')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('x-ms-version', _BLOB_API_VER)
    req.add_header('x-ms-blob-type', 'BlockBlob')
    req.add_header('Content-Type', content_type)
    req.add_header('Content-Length', str(len(data_bytes)))
    urllib_request.urlopen(req, timeout=60).close()


# ── GeoIP database (MaxMind GeoLite2) ────────────────────────────────────────

def _get_geoip_reader():
    """
    Return a geoip2.database.Reader backed by a locally cached GeoLite2-City.mmdb.
    Downloads the database from MaxMind on first call or when older than 7 days.
    Returns None if credentials are missing or download fails.
    """
    needs_download = True
    if os.path.exists(_GEOIP_DB_PATH):
        age = datetime.now(timezone.utc) - datetime.fromtimestamp(
            os.path.getmtime(_GEOIP_DB_PATH), tz=timezone.utc
        )
        if age < timedelta(days=_GEOIP_DB_MAX_AGE_DAYS):
            needs_download = False

    if needs_download:
        account_id  = os.environ.get('MAXMIND_ACCOUNT_ID', '').strip()
        license_key = os.environ.get('MAXMIND_LICENSE_KEY', '').strip()
        if not account_id or not license_key:
            logger.warning('MaxMind credentials not configured — geo enrichment unavailable')
            return None
        auth = base64.b64encode(f'{account_id}:{license_key}'.encode()).decode()
        url  = 'https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz'
        req  = urllib_request.Request(url, headers={'Authorization': f'Basic {auth}'})
        try:
            logger.info('Downloading GeoLite2-City database from MaxMind…')
            with urllib_request.urlopen(req, timeout=180) as resp:
                data = resp.read()
        except Exception as e:
            logger.error(f'GeoLite2-City download failed: {e}')
            return None
        try:
            with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
                for member in tar.getmembers():
                    if member.name.endswith('.mmdb'):
                        f = tar.extractfile(member)
                        with open(_GEOIP_DB_PATH, 'wb') as out:
                            out.write(f.read())
                        break
            logger.info(f'GeoLite2-City.mmdb cached at {_GEOIP_DB_PATH}')
        except Exception as e:
            logger.error(f'GeoLite2-City extraction failed: {e}')
            return None

    try:
        return geoip2.database.Reader(_GEOIP_DB_PATH)
    except Exception as e:
        logger.error(f'Failed to open GeoLite2-City.mmdb: {e}')
        return None


# ── MaxMind geo enrichment ────────────────────────────────────────────────────

def _enrich_ips(ips, cache, reader=None):
    """
    Enrich unique IPs with MaxMind geolocation, storing results in cache.
    Uses local GeoLite2-City database when reader is provided (handles 100k+ IPs).
    Falls back to web API when reader is None.
    """
    new_ips = [ip for ip in ips if ip and ip not in cache]
    if not new_ips:
        return
    logger.info(f'MaxMind: enriching {len(new_ips)} new IPs')
    if reader is not None:
        _enrich_ips_db(new_ips, cache, reader)
    else:
        _enrich_ips_api(new_ips, cache)


def _enrich_ips_db(ips, cache, reader):
    """Enrich IPs using local GeoLite2-City database — handles any volume instantly."""
    for ip in ips:
        try:
            r = reader.city(ip)
            cache[ip] = {
                'latitude':  r.location.latitude,
                'longitude': r.location.longitude,
                'country':   r.country.iso_code or '',
                'city':      r.city.name or '',
            }
        except Exception:
            cache[ip] = {'latitude': None, 'longitude': None, 'country': '', 'city': ''}


def _enrich_ips_api(ips, cache):
    """Enrich IPs via MaxMind web API. Suitable for small datasets only (<1k IPs)."""
    account_id  = os.environ.get('MAXMIND_ACCOUNT_ID', '').strip()
    license_key = os.environ.get('MAXMIND_LICENSE_KEY', '').strip()
    if not account_id or not license_key:
        logger.warning('MaxMind credentials not configured — geo enrichment skipped')
        return
    auth    = base64.b64encode(f'{account_id}:{license_key}'.encode()).decode()
    headers = {'Authorization': f'Basic {auth}', 'Accept': 'application/json'}
    for ip in ips:
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
                    continue  # tier not available, try next
                logger.warning(f'MaxMind {tier} lookup for {ip}: HTTP {e.code}')
                break
            except Exception as e:
                logger.warning(f'MaxMind {tier} lookup for {ip}: {e}')
                break

def _rows_to_tsv(rows):
    """Serialize a list of dicts to TSV bytes (UTF-8), safe for blob upload."""
    if not rows:
        return b''
    headers = list(rows[0].keys())
    lines = ['\t'.join(headers)]
    for row in rows:
        lines.append('\t'.join(
            str(row.get(h, '') or '').replace('\t', ' ').replace('\r', '').replace('\n', ' ')
            for h in headers
        ))
    return '\n'.join(lines).encode('utf-8')


# ── Sentinel ──────────────────────────────────────────────────────────────────

def _query_sentinel(workspace_id, kql, lookback_hours):
    """Run a KQL query against a Sentinel Log Analytics workspace via REST API."""
    token = _get_mi_token(_LA_RESOURCE)
    url = f'https://api.loganalytics.io/v1/workspaces/{workspace_id}/query'
    body = json.dumps({'query': kql, 'timespan': f'PT{lookback_hours}H'}).encode()
    req = urllib_request.Request(url, data=body, method='POST')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib_request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read())
    except urllib_error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'Log Analytics query HTTP {e.code}: {body}') from e
    tables = result.get('tables', [])
    if not tables:
        return []
    t = tables[0]
    cols = [c['name'] for c in t['columns']]
    return [dict(zip(cols, row)) for row in t['rows']]


def _devices_lookback():
    return int(os.environ.get('REFRESH_DEVICE_LOOKBACK_HOURS', '168'))


def _signin_lookback():
    return int(os.environ.get('REFRESH_SIGNIN_LOOKBACK_HOURS', '168'))


def _default_devices_kql():
    hours = _devices_lookback()
    return (
        'DeviceInfo\n'
        f'| where TimeGenerated > ago({hours}h)\n'
        '| summarize arg_max(TimeGenerated, *) by DeviceId\n'
        '| where isnotempty(PublicIP)\n'
        '| project TimeGenerated, DeviceName, DeviceId, OSPlatform, DeviceType,\n'
        '          CloudPlatforms, OnboardingStatus, PublicIP, SensorHealthState, ExposureLevel\n'
    )


def _default_signin_kql():
    hours = _signin_lookback()
    return (
        'SigninLogs\n'
        f'| where TimeGenerated > ago({hours}h)\n'
        '| where isnotempty(IPAddress)\n'
        '| summarize arg_max(TimeGenerated, *) by IPAddress, UserPrincipalName\n'
        '| project TimeGenerated, UserPrincipalName, IPAddress, Location,\n'
        '          AppDisplayName, ClientAppUsed, ConditionalAccessStatus\n'
    )


def _default_threatintel_kql():
    return (
        'ThreatIntelligenceIndicator\n'
        f'| where TimeGenerated > ago({_THREATINTEL_LOOKBACK_HOURS}h)\n'
        '| where ObservableType == "ip"\n'
        '| where isnotempty(ObservableValue)\n'
        '| summarize arg_max(TimeGenerated, *) by ObservableValue\n'
        '| project TimeGenerated, ObservableValue, ThreatType, ConfidenceScore,\n'
        '          Description, SourceSystem, Active\n'
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

def _parse_signin_location(location_val):
    """
    Extract country/city strings from the SigninLogs Location field.
    Azure AD populates countryOrRegion/city but geoCoordinates is often empty,
    so we only use this for metadata — coordinates come from MaxMind.
    """
    try:
        if isinstance(location_val, str):
            loc = json.loads(location_val)
        elif isinstance(location_val, dict):
            loc = location_val
        else:
            return {}
        return {
            'countryOrRegion': loc.get('countryOrRegion', ''),
            'city':            loc.get('city', ''),
            'state':           loc.get('state', ''),
        }
    except Exception:
        return {}


def _device_geojson(rows, geo_cache):
    features = []
    for row in rows:
        ip  = (row.get('PublicIP') or '').strip()
        geo = geo_cache.get(ip, {})
        lat, lon = geo.get('latitude'), geo.get('longitude')
        if lat is None or lon is None:
            continue
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
            'properties': {
                'TimeGenerated':     str(row.get('TimeGenerated', '')),
                'DeviceName':        row.get('DeviceName', ''),
                'DeviceId':          row.get('DeviceId', ''),
                'OSPlatform':        row.get('OSPlatform', ''),
                'DeviceType':        row.get('DeviceType', ''),
                'CloudPlatform':     row.get('CloudPlatforms', ''),
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
    """Build GeoJSON from sign-in rows. Coordinates from MaxMind, metadata from Location field."""
    features = []
    for row in rows:
        ip  = (row.get('IPAddress') or '').strip()
        geo = geo_cache.get(ip, {})
        lat, lon = geo.get('latitude'), geo.get('longitude')
        if lat is None or lon is None:
            continue
        # Azure Location field has reliable country/city strings even when geoCoordinates is empty
        loc = _parse_signin_location(row.get('Location'))
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
                'Country':                 loc.get('countryOrRegion') or geo.get('country', ''),
                'City':                    loc.get('city')            or geo.get('city', ''),
            },
        })
    return {'type': 'FeatureCollection', 'features': features}


def _threatintel_geojson(rows, geo_cache):
    features = []
    for row in rows:
        ip  = (row.get('ObservableValue') or '').strip()
        geo = geo_cache.get(ip, {})
        lat, lon = geo.get('latitude'), geo.get('longitude')
        if lat is None or lon is None:
            continue
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
            'properties': {
                'TimeGenerated':   str(row.get('TimeGenerated', '')),
                'ObservableValue': ip,
                'ThreatType':      row.get('ThreatType', ''),
                'Confidence':      row.get('ConfidenceScore', ''),
                'Description':     row.get('Description', ''),
                'SourceSystem':    row.get('SourceSystem', ''),
                'Active':          row.get('Active', ''),
                'Country':         geo.get('country', ''),
                'City':            geo.get('city', ''),
            },
        })
    return {'type': 'FeatureCollection', 'features': features}


# ── Per-pipeline frequency helpers ───────────────────────────────────────────

def _device_frequency_hours():
    return float(os.environ.get('REFRESH_DEVICE_FREQUENCY_MINUTES', '15')) / 60.0


def _signin_frequency_hours():
    return float(os.environ.get('REFRESH_SIGNIN_FREQUENCY_MINUTES', '15')) / 60.0


def _threatintel_frequency_hours():
    return float(os.environ.get('REFRESH_THREATINTEL_FREQUENCY_HOURS', '24'))


# ── Individual pipeline runners ───────────────────────────────────────────────

def _run_devices(workspace_id, container, reader=None):
    """KQL → TSV → MaxMind → GeoJSON → blob."""
    kql      = os.environ.get('SENTINEL_DEVICES_KQL') or _default_devices_kql()
    lookback = _devices_lookback()
    rows     = _query_sentinel(workspace_id, kql, lookback)
    _upload(container, 'mde-devices.tsv', _rows_to_tsv(rows), 'text/tab-separated-values')
    geo_cache = {}
    ips = list({r.get('PublicIP', '').strip() for r in rows if r.get('PublicIP', '').strip()})
    _enrich_ips(ips, geo_cache, reader)
    gj = _device_geojson(rows, geo_cache)
    _upload(container, 'mde-devices.geojson', json.dumps(gj).encode())
    logger.info(f"mde-devices — {len(rows)} rows, {len(gj['features'])} features, {len(ips)} IPs enriched")
    return {'rows': len(rows), 'features': len(gj['features']), 'ips_enriched': len(ips)}


def _run_signin(workspace_id, container, reader=None):
    """KQL → TSV → MaxMind → GeoJSON → blob."""
    kql      = os.environ.get('SENTINEL_SIGNIN_KQL') or _default_signin_kql()
    lookback = _signin_lookback()
    rows     = _query_sentinel(workspace_id, kql, lookback)
    _upload(container, 'signin-activity.tsv', _rows_to_tsv(rows), 'text/tab-separated-values')
    geo_cache = {}
    ips = list({r.get('IPAddress', '').strip() for r in rows if r.get('IPAddress', '').strip()})
    _enrich_ips(ips, geo_cache, reader)
    gj = _signin_geojson(rows, geo_cache)
    _upload(container, 'signin-activity.geojson', json.dumps(gj).encode())
    logger.info(f"signin-activity — {len(rows)} rows, {len(gj['features'])} features, {len(ips)} IPs enriched")
    return {'rows': len(rows), 'features': len(gj['features']), 'ips_enriched': len(ips)}


def _run_threatintel(workspace_id, container, reader=None):
    """KQL → TSV → MaxMind → GeoJSON → blob."""
    kql  = os.environ.get('SENTINEL_THREATINTEL_KQL') or _default_threatintel_kql()
    rows = _query_sentinel(workspace_id, kql, _THREATINTEL_LOOKBACK_HOURS)
    _upload(container, 'threat-intel-indicators.tsv', _rows_to_tsv(rows), 'text/tab-separated-values')
    geo_cache = {}
    ips = list({r.get('ObservableValue', '').strip() for r in rows if r.get('ObservableValue', '').strip()})
    _enrich_ips(ips, geo_cache, reader)
    gj = _threatintel_geojson(rows, geo_cache)
    _upload(container, 'threat-intel-indicators.geojson', json.dumps(gj).encode())
    logger.info(f"threat-intel-indicators — {len(rows)} rows, {len(gj['features'])} features, {len(ips)} IPs enriched")
    return {'rows': len(rows), 'features': len(gj['features']), 'ips_enriched': len(ips)}


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
    Refresh pipeline entry point. Each pipeline checks its own freshness threshold
    independently — a single request may refresh some datasets and skip others.

    Query params:
      check=true                          — report freshness only, run nothing
      force=true                          — bypass all freshness checks, run all pipelines
      pipeline=devices|signin|threatintel — run only the named pipeline
    """
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        })

    container    = os.environ.get('STORAGE_CONTAINER_DATASETS', 'datasets')
    check_only   = req.params.get('check', '').lower() == 'true'
    force        = req.params.get('force', '').lower() == 'true'
    only         = req.params.get('pipeline', '').lower()
    workspace_id = os.environ.get('SENTINEL_WORKSPACE_ID', '')

    # Per-pipeline freshness — keyed by TSV blob (written first, most accurate timestamp)
    pipelines = {
        'devices':     ('mde-devices.tsv',             _device_frequency_hours()),
        'signin':      ('signin-activity.tsv',          _signin_frequency_hours()),
        'threatintel': ('threat-intel-indicators.tsv',  _threatintel_frequency_hours()),
    }

    freshness = {}
    for name, (tsv_blob, freq_h) in pipelines.items():
        age_h = _blob_age_hours(container, tsv_blob)
        freshness[name] = {
            'tsv_blob':        tsv_blob,
            'age_hours':       round(age_h, 3) if age_h is not None else None,
            'frequency_hours': round(freq_h, 4),
            'fresh':           age_h is not None and age_h < freq_h,
        }

    if check_only:
        overall = 'fresh' if all(v['fresh'] for v in freshness.values()) else 'stale'
        return _ok({'status': overall, 'pipelines': freshness})

    if not workspace_id:
        return _ok({'status': 'skipped', 'message': 'SENTINEL_WORKSPACE_ID is not configured.'})

    if _is_locked(container) and not force and not only:
        return _ok({'status': 'running', 'message': 'A refresh is already in progress.'})

    # Decide which pipelines to run
    if only:
        to_run = [only] if only in pipelines else []
    elif force:
        to_run = list(pipelines.keys())
    else:
        to_run = [name for name, info in freshness.items() if not info['fresh']]

    if not to_run:
        return _ok({'status': 'fresh', 'message': 'All datasets are current.', 'pipelines': freshness})

    runners = {
        'devices':     _run_devices,
        'signin':      _run_signin,
        'threatintel': _run_threatintel,
    }

    _set_lock(container, True)
    reader = _get_geoip_reader()
    try:
        started = datetime.now(timezone.utc)
        results = {}
        for name in to_run:
            try:
                results[name] = runners[name](workspace_id, container, reader)
            except Exception as e:
                logger.error(f'{name} pipeline failed: {e}', exc_info=True)
                results[name] = {'error': str(e)}
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        return _ok({
            'status':          'updated',
            'elapsed_seconds': round(elapsed, 1),
            'ran':             to_run,
            'skipped':         [n for n in pipelines if n not in to_run],
            'results':         results,
        })
    except Exception as e:
        logger.error(f'Pipeline error: {e}', exc_info=True)
        return _ok({'status': 'error', 'error': str(e)}, status_code=500)
    finally:
        if reader:
            reader.close()
        _set_lock(container, False)
