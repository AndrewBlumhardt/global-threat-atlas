# Test Scripts

This directory contains debugging and development scripts for testing geo-enrichment functionality.

## Files

### test_direct_api.py
**Azure Maps API Direct Testing**
- Tests Azure Maps Geolocation API with various IP addresses
- Validates API connectivity and response format
- Useful for troubleshooting geo-enrichment issues

**Usage:**
```bash
export AZURE_MAPS_SUBSCRIPTION_KEY="your-key-here"
python test_direct_api.py
```

**Test IPs:**
- `8.8.8.8` - Google DNS (public IP)
- `162.216.150.156` - Sample threat intel IP
- `24.48.0.1` - Residential IP range
- `40.76.4.15` - Microsoft IP range

### test_geo_debug.py
**Geo-Enrichment Debugging**
- Similar to `test_direct_api.py` with additional test cases
- Validates Azure Maps responses for different IP types
- Checks position data, country codes, and city information

**Usage:**
```bash
export AZURE_MAPS_SUBSCRIPTION_KEY="your-key-here"
python test_geo_debug.py
```

### sample.tsv
**Sample Data File**
- TSV (Tab-Separated Values) test data
- Used for testing data parsing and processing
- Reference format for expected input data

## Purpose

These scripts are **development/debugging tools**, not part of an automated test suite. They were created to:

1. Validate Azure Maps API integration
2. Debug geo-enrichment issues during development
3. Test different IP address types and ranges
4. Verify API response formats

## Migration to Proper Testing

To integrate these into a proper test framework:

1. **Move to api/tests/**
   ```bash
   mkdir -p api/tests
   mv tests/*.py api/tests/
   ```

2. **Convert to pytest format:**
   - Add `test_` prefix to functions
   - Use pytest fixtures for API credentials
   - Add assertions and expected outcomes
   - Mock external API calls

3. **Update lint-test.yml workflow:**
   - Enable pytest execution
   - Add coverage reporting

## Recommendations

### Option 1: Keep as Debugging Scripts
If these are still useful for manual debugging:
- Rename directory to `debugging/` or `dev-tools/`
- Document that they are not automated tests
- Keep them for developer reference

### Option 2: Convert to Proper Tests
If you want automated testing:
- Refactor into pytest test cases
- Move to `api/tests/` directory
- Add to CI/CD pipeline via `lint-test.yml`
- Mock Azure Maps API to avoid requiring real API keys

### Option 3: Remove if Obsolete
If no longer needed:
- Delete if functionality is covered elsewhere
- Geo-enrichment is already tested in production use

## Related

- **Main Test Framework Reference:** See `api/tests/` (to be created)
- **CI/CD Testing:** See `.github/workflows/lint-test.yml`
- **Geo-Enrichment Module:** See `api/shared/geo_enrichment.py`
