"""
Cyber news RSS proxy.

Fetches several public security RSS feeds in parallel, parses them, and
returns a unified JSON array sorted newest-first.  Results are cached for
15 minutes via the Cache-Control response header; the Azure Static Web App
CDN will respect that header and avoid hammering the upstream feeds.

No API keys or external services required — all feeds are free public XML.
"""
import azure.functions as func
import json
import logging
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib import request as _req, error as _err

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Feed definitions
# ---------------------------------------------------------------------------
FEEDS = [
    {"name": "CISA Alerts",       "url": "https://www.cisa.gov/news.xml"},
    {"name": "SANS ISC",          "url": "https://isc.sans.edu/rssfeed.xml"},
    {"name": "Bleeping Computer", "url": "https://www.bleepingcomputer.com/feed/"},
    {"name": "The Hacker News",   "url": "https://feeds.feedburner.com/TheHackersNews"},
    {"name": "MSRC",              "url": "https://api.msrc.microsoft.com/update-guide/rss"},
]

# Maximum items returned in total
MAX_ITEMS = 5

# Per-feed fetch timeout (seconds)
FETCH_TIMEOUT = 8

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fetch_feed(feed: dict) -> list[dict]:
    """Fetch and parse a single RSS feed.  Returns a (possibly empty) list of items."""
    items = []
    try:
        req = _req.Request(
            feed["url"],
            headers={"User-Agent": "SentinelActivityMaps/1.0 (RSS reader)"},
        )
        with _req.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            raw = resp.read()

        root = ET.fromstring(raw)
        # Handle both RSS 2.0 (<rss><channel><item>) and Atom (<feed><entry>) formats
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        channel = root.find("channel")

        if channel is not None:
            # RSS 2.0
            for item in channel.findall("item"):
                title   = (item.findtext("title") or "").strip()
                link    = (item.findtext("link")  or "").strip()
                pub_str = (item.findtext("pubDate") or "").strip()
                published = _parse_rss_date(pub_str)
                if title and link:
                    items.append({
                        "title":     title,
                        "source":    feed["name"],
                        "url":       link,
                        "published": published,
                    })
        else:
            # Atom
            for entry in root.findall("atom:entry", ns):
                title   = (entry.findtext("atom:title", namespaces=ns) or "").strip()
                pub_str = (entry.findtext("atom:updated", namespaces=ns)
                           or entry.findtext("atom:published", namespaces=ns) or "").strip()
                link_el = entry.find("atom:link", ns)
                link    = (link_el.get("href", "") if link_el is not None else "").strip()
                published = _parse_iso_date(pub_str)
                if title and link:
                    items.append({
                        "title":     title,
                        "source":    feed["name"],
                        "url":       link,
                        "published": published,
                    })

    except _err.URLError as exc:
        logger.warning("Feed fetch failed [%s]: %s", feed["name"], exc)
    except ET.ParseError as exc:
        logger.warning("Feed parse error [%s]: %s", feed["name"], exc)
    except Exception as exc:
        logger.warning("Unexpected error [%s]: %s", feed["name"], exc)

    return items


def _parse_rss_date(s: str) -> str:
    """Parse an RFC 2822 date (RSS pubDate) to ISO-8601 string, or return '' on failure."""
    if not s:
        return ""
    try:
        dt = parsedate_to_datetime(s)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return ""


def _parse_iso_date(s: str) -> str:
    """Normalise an ISO-8601 string; return '' on failure."""
    if not s:
        return ""
    try:
        # datetime.fromisoformat handles most variants in Python 3.11+; use replace for Z
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return s


# ---------------------------------------------------------------------------
# Azure Function entry point
# ---------------------------------------------------------------------------

def main(req: func.HttpRequest) -> func.HttpResponse:
    all_items: list[dict] = []

    with ThreadPoolExecutor(max_workers=len(FEEDS)) as pool:
        futures = {pool.submit(_fetch_feed, feed): feed["name"] for feed in FEEDS}
        for future in as_completed(futures):
            try:
                all_items.extend(future.result())
            except Exception as exc:
                logger.error("Unexpected future error: %s", exc)

    # Sort newest-first (empty published strings sort to the end)
    all_items.sort(key=lambda x: x["published"] or "", reverse=True)

    payload = json.dumps(all_items[:MAX_ITEMS], ensure_ascii=False)

    return func.HttpResponse(
        body=payload,
        status_code=200,
        mimetype="application/json",
        headers={
            "Cache-Control": "public, max-age=900",   # 15-minute CDN cache
            "Access-Control-Allow-Origin": "*",
        },
    )
