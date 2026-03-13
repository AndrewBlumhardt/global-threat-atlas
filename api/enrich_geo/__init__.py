"""
Batch IP geo-enrichment endpoint.

Accepts a JSON array of IP addresses and returns MaxMind geolocation data
for each. Useful for testing MaxMind credentials and for manual partial-pipeline
runs when you have raw IP data that needs enriching outside the full refresh cycle.

POST /api/enrich_geo
Body: ["1.2.3.4", "5.6.7.8", ...]

Returns:
  {
    "1.2.3.4": {"latitude": 37.77, "longitude": -122.41, "country": "US", "city": "San Francisco"},
    "5.6.7.8": { ... },
    "bad.ip":  null   // not found or lookup failed
  }

Required app settings: MAXMIND_ACCOUNT_ID, MAXMIND_LICENSE_KEY
"""
import azure.functions as func
import base64
import json
import logging
import os
from urllib import error as urllib_error
from urllib import request as urllib_request

logger = logging.getLogger(__name__)


def main(req: func.HttpRequest) -> func.HttpResponse:
    """Enrich a JSON array of IPs with MaxMind geolocation and return the results."""
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        })

    if req.method != 'POST':
        return _error('POST a JSON array of IP address strings to this endpoint.', 405)

    try:
        ips = req.get_json()
    except ValueError:
        return _error('Request body must be a JSON array of IP strings.', 400)

    if not isinstance(ips, list):
        return _error('Request body must be a JSON array of IP strings.', 400)

    account_id = os.environ.get('MAXMIND_ACCOUNT_ID', '').strip()
    license_key = os.environ.get('MAXMIND_LICENSE_KEY', '').strip()
    if not account_id or not license_key:
        return _error('MaxMind credentials not configured (MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY).', 503)

    auth = base64.b64encode(f'{account_id}:{license_key}'.encode()).decode()
    headers = {'Authorization': f'Basic {auth}', 'Accept': 'application/json'}

    results = {}
    for ip in ips:
        ip = str(ip).strip()
        if not ip or ip in results:
            continue
        results[ip] = _lookup(ip, headers)

    return func.HttpResponse(
        body=json.dumps(results, indent=2),
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*'},
    )


def _lookup(ip, headers):
    """Try MaxMind city then country tiers. Returns a geo dict or None on failure."""
    for tier in ('city', 'country'):
        try:
            req = urllib_request.Request(
                f'https://geoip.maxmind.com/geoip/v2.1/{tier}/{ip}', headers=headers
            )
            with urllib_request.urlopen(req, timeout=5) as resp:
                d = json.loads(resp.read().decode())
            return {
                'latitude':  d.get('location', {}).get('latitude'),
                'longitude': d.get('location', {}).get('longitude'),
                'country':   d.get('country', {}).get('iso_code', ''),
                'city':      (d.get('city', {}).get('names') or {}).get('en', ''),
            }
        except urllib_error.HTTPError as e:
            if e.code == 403:
                continue  # tier not available on this plan, try next
            logger.warning(f'MaxMind {tier}/{ip}: HTTP {e.code}')
            return None
        except Exception as e:
            logger.warning(f'MaxMind {tier}/{ip}: {e}')
            return None
    return None


def _error(message, status_code=400):
    return func.HttpResponse(
        body=json.dumps({'error': message}),
        status_code=status_code,
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*'},
    )
