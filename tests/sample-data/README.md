# Sample Data Files

This folder contains generated sample data used by development utilities in `tests/`.

These files are for testing and demos only. They are not required for production runtime.

## Files

- `mde-devices-test.tsv`
  - Input test dataset for geo-enrichment scripts.
  - Used by:
    - `tests/manual-geo-enrich.py`
    - `tests/manual-geo-enrich-free.py`

- `mde-devices-enriched.tsv`
  - Output from geo-enrichment scripts with latitude/longitude and location fields.
  - Input for GeoJSON conversion.
  - Used by:
    - `tests/generate-mde-geojson.py`

- `mde-devices.geojson`
  - Converted GeoJSON output from enriched TSV data.
  - Suitable for map-layer testing and uploads.

## Regeneration Flow

From repository root:

```powershell
python tests/manual-geo-enrich.py
# or
python tests/manual-geo-enrich-free.py

python tests/generate-mde-geojson.py
```

## Notes

- Scripts in `tests/` now read/write these files directly in `tests/sample-data/`.
- Avoid committing large generated files unless they are needed for demos or reproducible tests.
