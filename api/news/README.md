# news

Fetches headlines from public security RSS feeds and returns a unified JSON array.

## Endpoint

`GET /api/news`

## Response

JSON array of up to 5 items sorted newest-first:

```json
[
  {
    "title": "CISA Adds Five Known Exploited Vulnerabilities to Catalog",
    "source": "CISA Alerts",
    "url": "https://www.cisa.gov/news/2024/01/...",
    "published": "2024-01-17T14:30:00Z"
  }
]
```

Response carries `Cache-Control: public, max-age=900` (15-minute CDN cache).

## Sources

| Source | Feed URL |
|---|---|
| CISA Alerts | https://www.cisa.gov/news.xml |
| SANS ISC | https://isc.sans.edu/rssfeed.xml |
| Bleeping Computer | https://www.bleepingcomputer.com/feed/ |
| The Hacker News | https://feeds.feedburner.com/TheHackersNews |
| MSRC | https://api.msrc.microsoft.com/update-guide/rss |

## Behaviour

Feeds are fetched in parallel with an 8-second per-feed timeout. Failed or unreachable feeds are skipped silently; a partial result is returned if at least one feed succeeds. If all feeds fail the endpoint returns an empty array with HTTP 200.

No API keys or app settings are required. The function parses RSS and Atom XML using the standard library only.

## Notes

- This endpoint is consumed by `web/src/ui/newsTicker.js`, which renders the headlines as a scrolling ticker bar fixed to the bottom of the viewport.
- The 15-minute CDN cache means headlines may lag real-time publication by up to 15 minutes, which is acceptable for a wallboard display.
