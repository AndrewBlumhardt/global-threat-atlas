"""
/api/news  — Returns the top 5 headlines from cybersecurity RSS feeds.

Fetches feeds in parallel, picks the 5 most recent items, and returns them
as JSON.  Results are cached in a module-level variable for 5 minutes so
repeated calls don't hammer upstream feeds.
"""
import azure.functions as func
import json
import logging
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import urlopen, Request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

FEEDS = [
    ("Krebs on Security",  "https://krebsonsecurity.com/feed/"),
    ("Threatpost",         "https://threatpost.com/feed/"),
    ("Dark Reading",       "https://www.darkreading.com/rss.xml"),
    ("Bleeping Computer",  "https://www.bleepingcomputer.com/feed/"),
    ("CISA Advisories",    "https://www.cisa.gov/news.xml"),
]
MAX_ITEMS     = 5
CACHE_TTL_S   = 300   # 5 minutes
FETCH_TIMEOUT = 8     # seconds per feed

# ---------------------------------------------------------------------------
# Module-level cache
# ---------------------------------------------------------------------------
_cache: dict = {}


def main(req: func.HttpRequest) -> func.HttpResponse:
    items = _get_items()
    body  = json.dumps(items, ensure_ascii=False)
    return func.HttpResponse(
        body,
        status_code=200,
        mimetype="application/json",
        headers={
            "Cache-Control": f"public, max-age={CACHE_TTL_S}",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_items() -> list:
    now = time.time()
    if _cache.get("ts", 0) + CACHE_TTL_S > now and _cache.get("items"):
        return _cache["items"]
    items = _fetch_all()
    _cache["ts"]    = now
    _cache["items"] = items
    return items


def _fetch_all() -> list:
    results = []
    with ThreadPoolExecutor(max_workers=len(FEEDS)) as pool:
        futures = {pool.submit(_fetch_feed, name, url): name for name, url in FEEDS}
        for future in as_completed(futures):
            try:
                results.extend(future.result())
            except Exception as exc:
                logging.warning("Feed %s failed: %s", futures[future], exc)
    results.sort(key=lambda x: x.get("published", ""), reverse=True)
    return results[:MAX_ITEMS]


def _fetch_feed(source: str, url: str) -> list:
    req = Request(url, headers={"User-Agent": "sentinel-activity-maps/1.0"})
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        raw = resp.read()

    root = ET.fromstring(raw)
    ns   = {"atom": "http://www.w3.org/2005/Atom"}
    items = []

    # RSS 2.0
    for item in root.findall(".//item"):
        title = _text(item, "title")
        link  = _text(item, "link")
        pub   = _text(item, "pubDate") or ""
        if title and link:
            items.append({"source": source, "title": title, "url": link, "published": pub})

    # Atom fallback
    if not items:
        for entry in root.findall(".//atom:entry", ns):
            title = _text(entry, "atom:title", ns)
            link  = entry.find("atom:link", ns)
            href  = link.get("href") if link is not None else ""
            pub   = _text(entry, "atom:published", ns) or _text(entry, "atom:updated", ns) or ""
            if title and href:
                items.append({"source": source, "title": title, "url": href, "published": pub})

    return items


def _text(el, tag: str, ns: dict = None) -> str:
    child = el.find(tag, ns) if ns else el.find(tag)
    return (child.text or "").strip() if child is not None else ""
