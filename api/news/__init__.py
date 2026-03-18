"""
/api/news  — Returns cybersecurity headlines from RSS feeds.

Fetches feeds in parallel, picks the most recent items, and returns them
as JSON.  Results are cached in a module-level variable for 5 minutes so
repeated calls don't hammer upstream feeds.

Environment variables (set in Function App → Configuration):
  TICKER_MAX_ITEMS  Max headlines to return (default: 10)
  TICKER_SPEED_S    Scroll animation duration in seconds (default: 70)
"""
import azure.functions as func
import json
import logging
import os
import threading
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
MAX_ITEMS     = int(os.getenv("TICKER_MAX_ITEMS", "10"))
SPEED_S       = int(os.getenv("TICKER_SPEED_S",   "70"))
CACHE_TTL_S   = 300   # 5 minutes
FETCH_TIMEOUT = 4     # seconds per feed — kept short so background threads don't linger

# ---------------------------------------------------------------------------
# Module-level cache  (stale-while-revalidate)
# _cache["items"] / _cache["ts"] hold the last good result.
# _refresh_lock ensures only one background refresh runs at a time.
# ---------------------------------------------------------------------------
_cache: dict = {}
_refresh_lock = threading.Lock()


def main(req: func.HttpRequest) -> func.HttpResponse:
    items = _get_items()
    body  = json.dumps({"items": items, "speed_s": SPEED_S}, ensure_ascii=False)
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
    """Return cached items immediately.

    - Fresh cache  → return instantly.
    - Stale cache  → return stale data NOW, kick off a background refresh.
    - Empty cache  → block once to do the first fetch (cold start only).
    """
    now = time.time()
    fresh = _cache.get("ts", 0) + CACHE_TTL_S > now
    has_items = bool(_cache.get("items"))

    if fresh and has_items:
        return _cache["items"]

    if has_items:
        # Stale but we have data — return immediately and refresh in background
        _trigger_background_refresh()
        return _cache["items"]

    # Truly empty (first ever call) — must block
    return _do_refresh()


def _trigger_background_refresh() -> None:
    """Start a background refresh if one isn't already running."""
    if _refresh_lock.locked():
        return  # already in progress
    t = threading.Thread(target=_do_refresh, daemon=True)
    t.start()


def _do_refresh() -> list:
    """Fetch all feeds, update the cache, and return the new item list."""
    with _refresh_lock:
        # Re-check inside the lock — another thread may have refreshed already
        if _cache.get("ts", 0) + CACHE_TTL_S > time.time() and _cache.get("items"):
            return _cache["items"]
        items = _fetch_all()
        _cache["ts"]    = time.time()
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
