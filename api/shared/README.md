# Shared Utility Modules

Reusable Python modules for Azure services integration, data processing, and geolocation enrichment.

## 📦 Modules

### `blob_storage.py`
**Azure Blob Storage Operations**

Classes:
- `BlobStorageClient` - Read/write TSV and GeoJSON files to blob storage

Key Methods:
- `read_tsv(filename)` - Download TSV content from blob
- `write_tsv(filename, content)` - Upload TSV with atomic replace (.tmp pattern)
- `write_geojson(filename, geojson_data)` - Upload GeoJSON
- `get_file_stats(filename)` - Get blob metadata (size, age, last modified)
- `file_exists(filename)` - Check if blob exists

Uses connection string authentication (more reliable than managed identity for Python SDK).

---

### `config_loader.py`
**Configuration Management**

Classes:
- `ConfigLoader` - Load settings from environment variables
- `DataSource` - Data source configuration from sources.yaml

Features:
- Parses `sources.yaml` for KQL queries and refresh policies
- Validates environment variables
- Provides geo provider settings (MaxMind/Azure Maps)
- KQL query templating with time window substitution

Key Properties:
- `workspace_id` - Log Analytics workspace ID
- `subscription_id` - Azure subscription ID
- `storage_account_name` - Blob storage account
- `geo_provider` - Geolocation provider ("maxmind" or "azure_maps")

---

### `file_age_checker.py`
**File Freshness Utilities**

Functions:
- `get_file_age_hours(last_modified)` - Calculate hours since last modification
- `is_file_stale(last_modified, threshold_hours)` - Check if file needs refresh
- `parse_iso_timestamp(timestamp_str)` - Parse ISO 8601 timestamps

Used for cache validation and refresh policies.

---

### `geo_enrichment.py`
**IP Geolocation Services**

Classes:
- `GeoEnrichmentClient` - Lookup IP addresses using MaxMind or Azure Maps

Features:
- **MaxMind GeoLite2**: Full coordinates (latitude/longitude, city, country)
- **Azure Maps**: Country-only geolocation (fallback option)
- Batch lookup with parallel processing (ThreadPoolExecutor)
- Automatic database download for MaxMind

Key Methods:
- `lookup_ip_location(ip)` - Single IP lookup
- `batch_lookup(ip_list, max_workers)` - Parallel batch lookup
- `parse_tsv_with_geo(tsv_content)` - Parse TSV and identify geo fields
- `needs_geo_lookup(row)` - Check if row needs coordinate enrichment

Supports multiple IP field names: `ObservableValue`, `PublicIP`, `IPAddress`

---

### `key_vault_client.py`
**Azure Key Vault Integration**

Classes:
- `KeyVaultClient` - Retrieve secrets from Azure Key Vault

Features:
- Managed identity authentication
- Secret name normalization (Azure format compliance)
- Fallback to environment variables if Key Vault unavailable
- Caching for performance

Key Methods:
- `get_secret(secret_name, env_var_name)` - Get secret with fallback

Used for:
- MaxMind license keys
- Azure Maps subscription keys
- Storage connection strings

---

### `log_analytics_client.py`
**Azure Monitor Log Analytics Queries**

Classes:
- `LogAnalyticsClient` - Execute KQL queries against Sentinel workspace

Features:
- Managed identity authentication with Azure Monitor REST API
- Large dataset handling (pagination support)
- Error handling and retry logic
- Query result parsing to dictionaries

Key Methods:
- `execute_query(kql_query, timespan)` - Run KQL and return rows
- `_get_access_token()` - Acquire Azure AD token for API authentication

Authentication:
- Uses `DefaultAzureCredential` (managed identity in Azure, Azure CLI locally)
- Requires **Log Analytics Reader** role on workspace

---

### `refresh_policy.py`
**Data Refresh State Management**

Classes:
- `RefreshPolicy` - Track query watermarks and determine refresh actions

Features:
- Incremental refresh support (query only new data since last run)
- Watermark persistence in blob storage (`.watermark` files)
- Query hash tracking to detect configuration changes
- Overlap handling for incremental queries

Key Methods:
- `should_refresh(source_id, file_stats, refresh_threshold_hours)` - Determine if refresh needed
- `get_query_timespan(source_id, window_hours, overlap_minutes, incremental)` - Calculate query time range
- `update_watermark(source_id, timestamp, query_hash)` - Save last query timestamp
- `compute_query_hash(kql_query)` - Hash query for change detection

Refresh Triggers:
- File age exceeds threshold
- File doesn't exist (initial load)
- Query configuration changed
- Manual force refresh requested

---

### `tsv_writer.py`
**TSV File Generation**

Functions:
- `write_tsv(rows, columns)` - Convert query results to tab-separated format

Features:
- Column ordering enforcement
- Empty value handling (empty string for None/null)
- Type conversion (all values to strings)
- Header row generation
- UTF-8 encoding

Used after Log Analytics queries to create standardized TSV files for storage.

---

## 🔄 Module Dependencies

```
function_app.py
    ├── config_loader.py
    │   └── sources.yaml
    ├── log_analytics_client.py
    │   └── Azure Monitor API
    ├── blob_storage.py
    │   └── Azure Storage SDK
    ├── geo_enrichment.py
    │   ├── geoip2 (MaxMind)
    │   └── requests (Azure Maps)
    ├── key_vault_client.py
    │   └── Azure Key Vault SDK
    ├── refresh_policy.py
    │   └── blob_storage.py
    ├── tsv_writer.py
    └── file_age_checker.py
```

## 🧪 Testing

Each module can be imported and tested independently:

```python
from shared.geo_enrichment import GeoEnrichmentClient
from shared.log_analytics_client import LogAnalyticsClient
from shared.blob_storage import BlobStorageClient

# Test geo enrichment
geo_client = GeoEnrichmentClient(provider="maxmind")
result = geo_client.lookup_ip_location("8.8.8.8")

# Test Log Analytics query
la_client = LogAnalyticsClient()
rows = la_client.execute_query("SigninLogs | take 10", timespan=timedelta(days=1))
```

## 📝 Error Handling

All modules implement:
- Comprehensive logging via Python `logging` module
- Graceful fallbacks (e.g., geo enrichment failures don't block data refresh)
- Azure SDK exception handling
- Connection retry logic where applicable
