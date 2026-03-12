"""
IP Lookup API endpoint.
Accepts ?ip=x.x.x.x and returns geo-enrichment data via MaxMind GeoIP2.
Requires MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY app settings on the Function App.
"""
import azure.functions as func
import json
import os
import logging
import ipaddress
from urllib import request as urllib_request
from urllib import error as urllib_error
from urllib.request import Request
import base64

logger = logging.getLogger(__name__)


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
    account_id  = os.environ.get('MAXMIND_ACCOUNT_ID',  '').strip()
    license_key = os.environ.get('MAXMIND_LICENSE_KEY', '').strip()

    if not account_id or not license_key:
        logger.error('MaxMind credentials not configured (MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY)')
        return _error_response('MaxMind credentials not configured on server', 503)

    # Verify account_id is purely numeric (MaxMind account IDs are integers)
    if not account_id.isdigit():
        logger.error('MAXMIND_ACCOUNT_ID does not look like a numeric ID — expected digits only. Check the app setting value.')
        return _error_response(
            'MAXMIND_ACCOUNT_ID appears invalid — expected a numeric account ID. '
            'Check the app setting value.',
            503
        )

    credentials = base64.b64encode(f"{account_id}:{license_key}".encode()).decode()
    headers = {'Authorization': f'Basic {credentials}', 'Accept': 'application/json'}

    # Try MaxMind endpoints in order: Insights → City → Country
    # 403 PERMISSION_REQUIRED means the account plan doesn't include that web service tier —
    # collect these and fall through to the free ipinfo.io fallback.
    mm_endpoints = [
        ("insights", f"https://geoip.maxmind.com/geoip/v2.1/insights/{ip}"),
        ("city",     f"https://geoip.maxmind.com/geoip/v2.1/city/{ip}"),
        ("country",  f"https://geoip.maxmind.com/geoip/v2.1/country/{ip}"),
    ]
    data = None
    data_source = None
    all_permission_denied = True   # flip to False if we get any non-403 auth error
    auth_errors = []

    for endpoint_name, url in mm_endpoints:
        try:
            logger.info(f'Trying MaxMind {endpoint_name} endpoint for {ip}')
            req_obj = Request(url, headers=headers)
            with urllib_request.urlopen(req_obj, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            data_source = f'maxmind/{endpoint_name}'
            logger.info(f'MaxMind lookup succeeded via {endpoint_name}')
            break  # success
        except urllib_error.HTTPError as e:
            status = e.code
            body = e.read().decode('utf-8')
            mm_code = ''
            mm_msg  = body
            try:
                mm_json = json.loads(body)
                mm_code = mm_json.get('code', '')
                mm_msg  = mm_json.get('error', body)
            except Exception:
                pass
            logger.warning(f'MaxMind HTTP {status} [{mm_code}] at {endpoint_name} for {ip}: {mm_msg}')

            if status == 404:
                return _error_response(
                    f'No geolocation data found for {ip}. The IP may be unregistered or newly allocated.',
                    404, no_match=True
                )
            if status == 400:
                return _error_response(f'MaxMind rejected IP format: {mm_msg}', 400, no_match=True)
            if status in (401, 402, 403):
                auth_errors.append(f'{endpoint_name}: HTTP {status} [{mm_code}] — {mm_msg}')
                if mm_code != 'PERMISSION_REQUIRED':
                    all_permission_denied = False  # actual auth failure, not a plan limitation
                continue
            return _error_response(f'MaxMind error {status}: {mm_msg}', 502)

    # If MaxMind succeeded, parse and return
    if data is not None:
        pass  # handled below

    # All MaxMind endpoints returned PERMISSION_REQUIRED — the account doesn't have web
    # service access (common with free GeoLite2 accounts). Fall back to ipinfo.io (free).
    elif all_permission_denied and auth_errors:
        logger.warning(
            f'MaxMind PERMISSION_REQUIRED on all endpoints for {ip} — '
            'account does not have GeoIP2 web service access (free GeoLite2 plan). '
            'Falling back to ipinfo.io.'
        )
        fallback_result = _lookup_ipinfo(ip)
        if fallback_result is not None:
            return func.HttpResponse(
                body=json.dumps(fallback_result),
                mimetype='application/json',
                headers={'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache'}
            )
        return _error_response(
            'MaxMind account does not have GeoIP2 web service access '
            '(PERMISSION_REQUIRED — upgrade to a paid GeoIP2 plan). '
            'ipinfo.io fallback also failed.',
            503
        )

    else:
        combined = ' | '.join(auth_errors) if auth_errors else 'unknown'
        logger.error(f'MaxMind auth failed on all endpoints for {ip}: {combined}')
        return _error_response(
            f'MaxMind authentication failed. Details: {combined}. '
            'Verify MAXMIND_ACCOUNT_ID (numeric) and MAXMIND_LICENSE_KEY in Function App settings.',
            503
        )

    try:
        result = _parse_maxmind_response(ip, data)
        result['source'] = data_source or 'maxmind'
        return func.HttpResponse(
            body=json.dumps(result),
            mimetype='application/json',
            headers={'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache'}
        )

    except Exception as e:
        logger.error(f'IP lookup failed for {ip}: {e}')
        return _error_response(f'Lookup failed: {str(e)}', 500)


def _lookup_ipinfo(ip):
    """
    Free fallback geo-lookup via ipinfo.io (no key required, 50k req/month).
    Returns a dict in the same shape as _parse_maxmind_response, or None on failure.
    """
    try:
        url = f"https://ipinfo.io/{ip}/json"
        req_obj = Request(url, headers={'Accept': 'application/json', 'User-Agent': 'sentinel-activity-maps/1.0'})
        with urllib_request.urlopen(req_obj, timeout=10) as resp:
            d = json.loads(resp.read().decode('utf-8'))

        if d.get('bogon'):
            logger.warning(f'ipinfo.io returned bogon for {ip}')
            return None

        # loc is "lat,lon"
        lat, lon = None, None
        loc = d.get('loc', '')
        if loc and ',' in loc:
            try:
                lat, lon = float(loc.split(',')[0]), float(loc.split(',')[1])
            except ValueError:
                pass

        # org field is usually "AS701 Verizon Business" — split ASN from name
        org_raw = d.get('org', '')
        asn_num = None
        org_name = org_raw
        if org_raw.upper().startswith('AS'):
            parts = org_raw.split(' ', 1)
            try:
                asn_num = int(parts[0][2:])
                org_name = parts[1] if len(parts) > 1 else ''
            except (ValueError, IndexError):
                pass

        logger.info(f'ipinfo.io lookup succeeded for {ip}: city={d.get("city")}, country={d.get("country")}')
        return {
            'ip': ip,
            'latitude': lat,
            'longitude': lon,
            'accuracy_radius': None,
            'time_zone': d.get('timezone', ''),
            'city': d.get('city', ''),
            'state': d.get('region', ''),
            'postal_code': d.get('postal', ''),
            'country': d.get('country', ''),   # ISO code e.g. "US" (ipinfo free tier)
            'country_code': d.get('country', ''),
            'continent': '',
            'registered_country': '',
            'isp': org_name,
            'organization': org_name,
            'domain': d.get('hostname', ''),
            'connection_type': '',
            'user_type': '',
            'autonomous_system_number': asn_num,
            'autonomous_system_organization': org_name,
            'is_anonymous': False,
            'is_anonymous_proxy': False,
            'is_anonymous_vpn': False,
            'is_hosting_provider': False,
            'is_legitimate_proxy': False,
            'is_public_proxy': False,
            'is_residential_proxy': False,
            'is_satellite_provider': False,
            'is_tor_exit_node': False,
            'source': 'ipinfo.io',
        }
    except Exception as exc:
        logger.error(f'ipinfo.io fallback failed for {ip}: {exc}')
        return None


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
