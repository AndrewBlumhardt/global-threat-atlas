# shared

Utilities shared across overlay and UI modules.

## Files

| File | Description |
|---|---|
| `demoMode.js` | Tracks the demo mode toggle state and resolves data URLs. On first call it probes the storage container for anonymous access — if available, blobs are fetched directly; otherwise requests are routed through `/api/data/{filename}`. When demo mode is active, all paths are prefixed with `demo_data/`. |
| `markerConfig.js` | Centralised constants for HTML marker size used by all data overlays. |
