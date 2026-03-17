# tests

Demo data generation scripts and sample data files. These scripts generate synthetic data for populating the `demo_data/` blob prefix used by Demo Mode.

These files are not required for production deployments and are not deployed as part of the application.

## Demo data generation scripts

| File | Description |
|---|---|
| `generate_device_locations.py` | Generates synthetic MDE device location data and uploads to `demo_data/` in blob storage |
| `generate_mde_devices.py` | Generates synthetic MDE device records |
| `generate_signin_data.py` | Generates synthetic Azure AD sign-in activity data |
| `generate-mde-geojson.py` | Converts synthetic MDE device records to GeoJSON format |

## Manual geo-enrichment scripts

| File | Description |
|---|---|
| `manual-geo-enrich.py` | Batch geo-enriches a TSV file of IPs using a paid MaxMind API call |
| `manual-geo-enrich-free.py` | Batch geo-enriches a TSV file using free public geo APIs |

## Debugging and integration scripts

| File | Description |
|---|---|
| `test_direct_api.py` | Tests Function App API endpoints directly |
| `test_geo_debug.py` | Debugging helper for geo-enrichment results |
| `test_large_dataset.py` | Tests pipeline behaviour with large TSV inputs |
| `test_local.py` | Local integration test for the full refresh pipeline |

## Sample data

The `sample-data/` folder contains small pre-generated files for offline testing:

| File | Description |
|---|---|
| `mde-devices-enriched.tsv` | Sample enriched MDE device data |
| `mde-devices-test.tsv` | Sample raw MDE device data |
| `mde-devices.geojson` | Sample MDE device GeoJSON |
| `threat-actors.tsv` | Static threat actor country attribution file (also used in production via blob storage) |
