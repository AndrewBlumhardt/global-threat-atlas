# src

Application JavaScript source. All files are ES modules loaded via `<script type="module">` in `index.html`.

## Entry point

`app.js` — initialises config, fires the refresh pipeline call, creates the map, wires up all overlays and UI controls.

## Subfolders

| Folder | Description |
|---|---|
| `data/` | Data loading and parsing utilities |
| `map/` | Azure Maps initialisation |
| `overlays/` | One module per data layer rendered on the map |
| `shared/` | Shared utilities used across overlays and UI |
| `ui/` | UI controls and panel management |
