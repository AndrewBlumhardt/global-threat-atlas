"""
IP Lookup API endpoint.
Accepts ?ip=x.x.x.x and returns geo-enrichment data via MaxMind GeoIP2.
Requires MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY app settings on the Function App.
"""
import azure.functions as func
import json
import os
import logging
import re
import ipaddress
from urllib import request as urllib_request
from urllib import error as urllib_error
from urllib.request import Request
import base64

logger = logging.getLogger(__name__)

# MaxMind GeoIP2 Precision Insights endpoint
# Falls back to City endpoint if Insights not available (same URL structure)
MAXMIND_BASE_URL = "https://geoip.maxmind.com/geoip/v2.1/insights/{ip}"


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Look up geographic and network details for an IP address using MaxMind GeoIP2.
    Returns enrichment data including city, country, lat/lon, ISP, and risk indicators.
    """

    # Handle CORS preflight
    if req.method == 'OPTIONS':
        return func.HttpResponse(
            status_code=200,
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        )

    ip = req.params.get('ip', '').strip()
    logger.info(f'IP lookup requested for: {ip}')

    # Validate IP address format
    if not ip:
        return _error_response('No IP address provided', 400)

    if not _is_valid_public_ip(ip):
        return _error_response(
            f'"{ip}" is not a valid public IP address. Private, reserved, and loopback addresses cannot be geolocated.',
            400,
            no_match=True
        )

    # Read MaxMind credentials from app settings — strip any accidental whitespace
    account_id = os.environ.get('MAXMIND_ACCOUNT_ID', '').strip()
    license_key = os.environ.get('MAXMIND_LICENSE_KEY', '').strip()

    if not account_id or not license_key:
        logger.error('MaxMind credentials not configured (MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY)')
        return _error_response('MaxMind credentials not configured on server', 503)

    credentials = base64.b64encode(f"{account_id}:{license_key}".encode()).decode()
    headers = {'Authorization': f'Basic {credentials}', 'Accept': 'application/json'}

    # Try Insights endpoint first; fall back to City if account lacks Insights tier
    endpoints = [
        f"https://geoip.maxmind.com/geoip/v2.1/insights/{ip}",
        f"https://geoip.maxmind.com/geoip/v2.1/city/{ip}",
    ]
    data = None
    last_error = None
    for url in endpoints:
        try:
            req_obj = Request(url, headers=headers)
            with urllib_request.urlopen(req_obj, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            logger.info(f'MaxMind lookup succeeded via {url.split("/")[-2]}')
            break  # success
        except urllib_error.HTTPError as e:
            status = e.code
            body = e.read().decode('utf-8')
            logger.warning(f'MaxMind HTTP {status} at {url.split("/")[-2]} for {ip}: {body[:200]}')
            if status == 404:
                return _error_response(
                    f'No geolocation data found for {ip}. The IP may be unregistered or newly allocated.',
                    404, no_match=True
                )
            if status == 400:
                return _error_response(f'Invalid IP address format: {ip}', 400, no_match=True)
            if status in (401, 402, 403):
                last_error = f'MaxMind auth failed (HTTP {status}) for endpoint {url.split("/")[-2]} — account_id={account_id}'
                logger.error(last_error)
                # Try next endpoint (e.g. City may work if Insights is not subscribed)
                continue
            return _error_response(f'MaxMind returned error {status}', 502)

    if data is None:
        return _error_response(
            'MaxMind authentication failed on all endpoints. Verify MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY.',
            503
        )

    try:
        result = _parse_maxmind_response(ip, data)
        return func.HttpResponse(
            body=json.dumps(result),
            mimetype='application/json',
            headers={'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache'}
        )

    except Exception as e:
        logger.error(f'IP lookup failed for {ip}: {e}')
        return _error_response(f'Lookup failed: {str(e)}', 500)


def _is_valid_public_ip(ip_str):
    """Return True only for valid, public (non-private/reserved) IPv4 or IPv6 addresses."""
    try:
        addr = ipaddress.ip_address(ip_str)
        return not (addr.is_private or addr.is_loopback or addr.is_reserved
                    or addr.is_multicast or addr.is_unspecified or addr.is_link_local)
    except ValueError:
        return False


def _parse_maxmind_response(ip, data):
    """Extract the most useful fields from a MaxMind GeoIP2 response."""
    location = data.get('location', {})
    city = data.get('city', {})
    country = data.get('country', {})
    continent = data.get('continent', {})
    postal = data.get('postal', {})
    subdivisions = data.get('subdivisions', [])
    traits = data.get('traits', {})
    registered_country = data.get('registered_country', {})

    state = subdivisions[0].get('names', {}).get('en', '') if subdivisions else ''

    return {
        'ip': ip,
        'latitude': location.get('latitude'),
        'longitude': location.get('longitude'),
        'accuracy_radius': location.get('accuracy_radius'),
        'time_zone': location.get('time_zone', ''),
        'city': city.get('names', {}).get('en', ''),
        'state': state,
        'postal_code': postal.get('code', ''),
        'country': country.get('names', {}).get('en', ''),
        'country_code': country.get('iso_code', ''),
        'continent': continent.get('names', {}).get('en', ''),
        'registered_country': registered_country.get('names', {}).get('en', ''),
        'isp': traits.get('isp', ''),
        'organization': traits.get('organization', ''),
        'domain': traits.get('domain', ''),
        'connection_type': traits.get('connection_type', ''),
        'user_type': traits.get('user_type', ''),
        'autonomous_system_number': traits.get('autonomous_system_number'),
        'autonomous_system_organization': traits.get('autonomous_system_organization', ''),
        'is_anonymous': traits.get('is_anonymous', False),
        'is_anonymous_proxy': traits.get('is_anonymous_proxy', False),
        'is_anonymous_vpn': traits.get('is_anonymous_vpn', False),
        'is_hosting_provider': traits.get('is_hosting_provider', False),
        'is_legitimate_proxy': traits.get('is_legitimate_proxy', False),
        'is_public_proxy': traits.get('is_public_proxy', False),
        'is_residential_proxy': traits.get('is_residential_proxy', False),
        'is_satellite_provider': traits.get('is_satellite_provider', False),
        'is_tor_exit_node': traits.get('is_tor_exit_node', False),
    }


def _error_response(message, status_code=400, no_match=False):
    """Return a structured error response."""
    return func.HttpResponse(
        body=json.dumps({'error': message, 'no_match': no_match}),
        status_code=status_code,
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*'}
    )
