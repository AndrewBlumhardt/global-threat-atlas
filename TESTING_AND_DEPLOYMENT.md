# Testing and Deployment Guide - Large Dataset Support (50K+ IPs)

## Overview
This function now supports querying and processing 50K+ IPs from Log Analytics with full geo-enrichment and GeoJSON generation. All components are optimized for large-scale data processing.

## What's Been Enhanced

### ✅ Log Analytics Query Execution
- Server timeout: 10 minutes (handles large queries)
- Supports up to 500K records per query
- Progress logging with elapsed time and record counts
- Warnings for result sets approaching API limits

### ✅ Geo-Enrichment Batching
- **Standard batch mode**: Up to 10K IPs, 20 concurrent workers
- **Chunked batch mode**: 10K+ IPs, processes in 5K chunks with progress tracking
- MaxMind GeoLite2: Local database (no API rate limits)
- Progress logging every 5% completion
- Detailed statistics: success rates, IPs/second, coordinates vs country-only

### ✅ GeoJSON Generation
- Progress tracking for large datasets (logs every 10K records)
- Efficient feature creation from enriched data
- Automatic file upload to Azure Blob Storage

---

## Testing Locally

### Prerequisites
1. **Environment Variables** (set in PowerShell):
```powershell
$env:LOG_ANALYTICS_WORKSPACE_ID = "your-workspace-id"
$env:MAXMIND_LICENSE_KEY = "your-maxmind-key"  # Optional if database exists
```

2. **Azure Authentication**:
```powershell
az login
```

### Run Verification Tests

```powershell
cd c:\repos\sentinel-activity-maps\api
python test_large_dataset.py
```

**This will test:**
- ✅ Log Analytics connection and query execution
- ✅ Query performance and result count
- ✅ Geo-enrichment batching (chunked for 10K+)
- ✅ GeoJSON generation and file output

**Expected Output:**
```
===============================================================================
TEST 1: Log Analytics Query Execution
===============================================================================
✓ Connection successful
✓ Query completed in 45.32 seconds
✓ Records returned: 52,341
✓ Unique IPs: 52,341

===============================================================================
TEST 2: Geo-Enrichment Batching
===============================================================================
Using chunked batch processing for large dataset (chunk_size=5000)
Processing chunk 1/11 (5,000 IPs)...
Progress: 2,500/5,000 (50.0%) - 2,450 successful (98.0%)
...
✓ Batch enrichment completed in 124.56 seconds
✓ Successfully enriched: 51,234/52,341 (97.9%)
✓ Average rate: 411.2 IPs/second
✓ Full coordinates: 48,932 (95.5%)
✓ Country-only: 2,302 (4.5%)

===============================================================================
TEST 3: GeoJSON Generation
===============================================================================
✓ Created 48,932 GeoJSON features
✓ Saved to test_output.geojson (47.2 MB)
```

---

## Deployment via Azure CLI

### Method 1: PowerShell Script (Recommended)

```powershell
.\deploy-function-cli.ps1 `
    -FunctionAppName "your-function-app-name" `
    -ResourceGroup "your-resource-group"
```

**What it does:**
1. Checks Azure CLI and login status
2. Verifies Function App exists
3. Packages function code (excludes `__pycache__`, test files)
4. Deploys via `az functionapp deployment source config-zip`
5. Provides function URL and verification steps

### Method 2: Manual Azure CLI

```powershell
# Build package
cd api
Compress-Archive -Path function_app.py,host.json,requirements.txt,sources.yaml,shared -DestinationPath ../function.zip -Force

# Deploy
az functionapp deployment source config-zip `
    --resource-group "your-rg" `
    --name "your-function-app" `
    --src "../function.zip" `
    --build-remote true
```

### Post-Deployment Verification

```powershell
# Test function endpoint
$functionUrl = "https://your-function-app.azurewebsites.net/api/refresh"
Invoke-WebRequest -Uri $functionUrl -Method GET

# Monitor logs in real-time
az functionapp log tail `
    --name "your-function-app" `
    --resource-group "your-rg"
```

---

## Expected Function Behavior (50K+ IPs)

### Timeline for 50K IPs:
1. **Query Execution**: ~30-60 seconds (depends on Log Analytics load)
2. **Geo-Enrichment**: ~2-5 minutes (MaxMind local lookups)
3. **GeoJSON Generation**: ~10-30 seconds
4. **Total**: ~3-7 minutes for full pipeline

### Log Output:
```
[correlation-123] Processing source: threat_intel_indicators
[correlation-123] Executing Log Analytics query for threat_intel_indicators (refresh)
[correlation-123] Query timespan: 360:00:00
[correlation-123] Query completed in 42.34s - fetched 52,341 records
[correlation-123] Found 52,341 IPs requiring geo-enrichment
[correlation-123] Using chunked batch processing for large dataset
Processing chunk 1/11 (5,000 IPs)...
Progress: 2,500/5,000 (50.0%) - 2,450 successful (98.0%)
Chunk 1/11 complete: 4,892/5,000 successful (97.8%) in 11.2s (445.5 IPs/sec)
Overall progress: 4,892/52,341 (9.3%)
...
Chunked batch lookup complete: 51,234/52,341 successful (97.9%)
[correlation-123] Geo enrichment: 51,234 total (48,932 with coordinates, 2,302 country-only)
[correlation-123] Creating GeoJSON features from 52,341 records...
[correlation-123] GeoJSON progress: 10,000/52,341 rows processed, 9,543 features created
...
[correlation-123] GeoJSON features created in 15.43s: 48,932 features, 2,302 skipped
```

---

## Configuration Options

### Adjust Batching Performance (sources.yaml)

Current settings in [api/sources.yaml](api/sources.yaml):
```yaml
sources:
  - id: threat_intel_indicators
    enabled: true
    refresh_threshold_hours: 24
    query_time_window_hours: 360  # 15 days
    auto_enrich_geo: true
    auto_generate_geojson: true
```

### Adjust Concurrency (function_app.py)

For even faster processing, increase max_workers:
```python
# Line ~268 in function_app.py
# Current: max_workers=20
geo_results = geo_client.batch_lookup_chunked(
    ips_to_lookup, 
    chunk_size=5000, 
    max_workers=30  # Increase for more concurrency
)
```

⚠️ **Note**: Higher concurrency uses more memory. Monitor Function App memory usage.

---

## Troubleshooting

### Issue: Query returns fewer than expected IPs

**Solution**: Check your KQL query in [api/sources.yaml](api/sources.yaml). Ensure:
- Timespan is sufficient (currently 15 days)
- Filters aren't too restrictive
- Pattern matching is correct

### Issue: Geo-enrichment fails

**Solution**:
1. Verify MaxMind license key: `echo $env:MAXMIND_LICENSE_KEY`
2. Check database exists: Test locally first
3. For Azure Maps: Set `AZURE_MAPS_SUBSCRIPTION_KEY`

### Issue: Function timeout (consumption plan)

**Problem**: Consumption plan has 10-minute timeout

**Solution**: Upgrade to Premium or Dedicated plan for unlimited execution time

### Issue: Memory errors with large datasets

**Solution**:
1. Scale up Function App (add more memory)
2. Reduce chunk_size from 5000 to 2500
3. Reduce max_workers from 20 to 10

---

## API Limits Reference

| Component | Limit | Notes |
|-----------|-------|-------|
| Log Analytics API | 500K records/query | Query returns truncated if exceeded |
| Log Analytics Timeout | 10 minutes/query | Configured in client |
| MaxMind GeoLite2 | Unlimited (local) | Database downloaded once |
| Azure Maps | Rate limited | Not recommended for 50K+ IPs |
| Azure Function (Consumption) | 10 min execution | Upgrade plan if needed |
| Azure Blob Storage | No practical limit | For GeoJSON output |

---

## Success Criteria

✅ **Test Passed If:**
- Log Analytics returns 50K+ records
- Geo-enrichment success rate > 95%
- GeoJSON contains 45K+ features
- Total execution time < 10 minutes
- No timeout errors
- test_output.geojson file created successfully

✅ **Deployment Successful If:**
- Function endpoint responds (200 OK)
- Logs show query execution
- TSV and GeoJSON files uploaded to blob storage
- No errors in Application Insights

---

## Next Steps After Deployment

1. **Monitor First Run**: Watch logs during initial execution
2. **Verify Blob Storage**: Check datasets container for output files
3. **Test SWA Integration**: Verify frontend can load the GeoJSON
4. **Set Up Monitoring**: Configure Application Insights alerts
5. **Schedule Refresh**: Set up Timer trigger or Logic App

---

## Quick Command Reference

```powershell
# Test locally
cd api && python test_large_dataset.py

# Deploy function
.\deploy-function-cli.ps1 -FunctionAppName "func-name" -ResourceGroup "rg-name"

# Test endpoint
Invoke-WebRequest -Uri "https://your-func.azurewebsites.net/api/refresh" -Method GET

# Stream logs
az functionapp log tail --name "func-name" --resource-group "rg-name"

# Check application settings
az functionapp config appsettings list --name "func-name" --resource-group "rg-name"

# View files in storage
az storage blob list --account-name "storage-name" --container-name "datasets" --output table
```
