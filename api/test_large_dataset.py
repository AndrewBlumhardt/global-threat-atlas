"""
Test script for verifying large dataset handling (50K+ IPs).
Tests Log Analytics query execution, geo-enrichment batching, and GeoJSON generation.
"""
import os
import sys
import logging
import json
from datetime import datetime, timedelta
from shared.log_analytics_client import LogAnalyticsClient
from shared.geo_enrichment import GeoEnrichmentClient
from shared.config_loader import ConfigLoader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_log_analytics_query(kql_query: str, timespan_hours: int = 360):
    """
    Test Log Analytics query execution and measure performance.
    
    Args:
        kql_query: KQL query to execute
        timespan_hours: Query timespan in hours (default: 15 days)
    """
    logger.info("=" * 80)
    logger.info("TEST 1: Log Analytics Query Execution")
    logger.info("=" * 80)
    
    try:
        # Initialize client
        workspace_id = os.getenv('LOG_ANALYTICS_WORKSPACE_ID')
        if not workspace_id:
            logger.error("LOG_ANALYTICS_WORKSPACE_ID not set")
            return None
        
        logger.info(f"Workspace ID: {workspace_id}")
        client = LogAnalyticsClient(workspace_id)
        
        # Test connection
        logger.info("Testing connection...")
        if not client.test_connection():
            logger.error("Connection test failed")
            return None
        logger.info("✓ Connection successful")
        
        # Execute query
        logger.info(f"Executing query with {timespan_hours}h timespan...")
        logger.info(f"Query: {kql_query[:200]}...")
        
        start_time = datetime.now()
        timespan = timedelta(hours=timespan_hours)
        results = client.execute_query(kql_query, timespan)
        elapsed = (datetime.now() - start_time).total_seconds()
        
        # Analyze results
        logger.info(f"✓ Query completed in {elapsed:.2f} seconds")
        logger.info(f"✓ Records returned: {len(results):,}")
        
        if results:
            # Sample first record
            logger.info(f"Sample record: {json.dumps(results[0], indent=2, default=str)}")
            
            # Count unique IPs
            ip_field = None
            for field in ['ObservableValue', 'IPAddress', 'ip_address', 'SourceIP']:
                if field in results[0]:
                    ip_field = field
                    break
            
            if ip_field:
                unique_ips = set(r.get(ip_field, '') for r in results if r.get(ip_field))
                logger.info(f"✓ Unique IPs: {len(unique_ips):,}")
            else:
                logger.warning("Could not identify IP field in results")
        
        logger.info(f"✓ TEST 1 PASSED: Query execution successful")
        return results
        
    except Exception as e:
        logger.error(f"✗ TEST 1 FAILED: {e}", exc_info=True)
        return None


def test_geo_enrichment_batching(ip_addresses: list, provider: str = "maxmind", batch_size: int = 1000):
    """
    Test geo-enrichment with large IP list.
    
    Args:
        ip_addresses: List of IP addresses to enrich
        provider: Geo provider ("maxmind" or "azure_maps")
        batch_size: Number of IPs to process in each batch for logging
    """
    logger.info("=" * 80)
    logger.info("TEST 2: Geo-Enrichment Batching")
    logger.info("=" * 80)
    
    try:
        # Initialize geo client
        logger.info(f"Initializing {provider} client...")
        geo_client = GeoEnrichmentClient(provider=provider)
        
        # Test single IP first
        unique_ips = list(set(ip_addresses))  # Deduplicate
        logger.info(f"Total IPs: {len(ip_addresses):,}, Unique IPs: {len(unique_ips):,}")
        
        if unique_ips:
            test_ip = unique_ips[0]
            logger.info(f"Testing single IP lookup: {test_ip}")
            result = geo_client.lookup_ip_location(test_ip)
            if result:
                logger.info(f"✓ Single lookup successful: {json.dumps(result, indent=2, default=str)}")
            else:
                logger.warning(f"Single lookup returned no data for {test_ip}")
        
        # Batch lookup - use chunked method for large datasets
        logger.info(f"Starting batch geo-enrichment for {len(unique_ips):,} unique IPs...")
        start_time = datetime.now()
        
        if len(unique_ips) > 10000:
            logger.info("Using chunked batch processing for large dataset (chunk_size=5000)")
            all_results = geo_client.batch_lookup_chunked(unique_ips, chunk_size=5000, max_workers=20)
        else:
            logger.info("Using standard batch processing")
            all_results = geo_client.batch_lookup(unique_ips, max_workers=20)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        
        # Statistics
        success_rate = (len(all_results) / len(unique_ips)) * 100 if unique_ips else 0
        logger.info(f"✓ Batch enrichment completed in {elapsed:.2f} seconds")
        logger.info(f"✓ Successfully enriched: {len(all_results):,}/{len(unique_ips):,} ({success_rate:.1f}%)")
        logger.info(f"✓ Average rate: {len(all_results) / elapsed:.2f} IPs/second")
        
        # Analyze geo data quality
        with_coords = sum(1 for r in all_results.values() if r.get('latitude') and r.get('longitude'))
        country_only = len(all_results) - with_coords
        
        logger.info(f"✓ Full coordinates: {with_coords:,} ({with_coords/len(all_results)*100:.1f}%)")
        logger.info(f"✓ Country-only: {country_only:,} ({country_only/len(all_results)*100:.1f}%)")
        
        logger.info(f"✓ TEST 2 PASSED: Geo-enrichment successful")
        return all_results
        
    except Exception as e:
        logger.error(f"✗ TEST 2 FAILED: {e}", exc_info=True)
        return None


def test_geojson_generation(records: list, geo_results: dict):
    """
    Test GeoJSON generation from enriched records.
    
    Args:
        records: Original query results
        geo_results: Geo-enrichment results
    """
    logger.info("=" * 80)
    logger.info("TEST 3: GeoJSON Generation")
    logger.info("=" * 80)
    
    try:
        geo_client = GeoEnrichmentClient()
        
        # Merge geo data into records
        ip_field = 'ObservableValue'  # Adjust based on your query
        enriched_records = []
        
        for record in records:
            ip = record.get(ip_field)
            if ip and ip in geo_results:
                geo_data = geo_results[ip]
                record['Latitude'] = geo_data.get('latitude')
                record['Longitude'] = geo_data.get('longitude')
                record['Country'] = geo_data.get('country', '')
                record['City'] = geo_data.get('city', '')
            enriched_records.append(record)
        
        # Create GeoJSON features
        logger.info("Creating GeoJSON features...")
        features = []
        for record in enriched_records:
            feature = geo_client.create_geojson_feature(record)
            if feature:
                features.append(feature)
        
        logger.info(f"✓ Created {len(features):,} GeoJSON features")
        
        # Create collection
        geojson = geo_client.create_geojson_collection(features)
        logger.info(f"✓ GeoJSON collection created")
        logger.info(f"  - Total features: {geojson['metadata']['count']:,}")
        logger.info(f"  - Generated: {geojson['metadata']['generated']}")
        
        # Save to file
        output_file = "test_output.geojson"
        with open(output_file, 'w') as f:
            json.dump(geojson, f, indent=2)
        
        file_size = os.path.getsize(output_file)
        logger.info(f"✓ Saved to {output_file} ({file_size:,} bytes, {file_size/1024/1024:.2f} MB)")
        
        logger.info(f"✓ TEST 3 PASSED: GeoJSON generation successful")
        return geojson
        
    except Exception as e:
        logger.error(f"✗ TEST 3 FAILED: {e}", exc_info=True)
        return None


def main():
    """Run all tests."""
    logger.info("Starting large dataset verification tests...")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    
    # Load configuration
    try:
        config = ConfigLoader()
        source = config.get_source_by_id('threat_intel_indicators')
        if not source:
            logger.error("threat_intel_indicators source not found in sources.yaml")
            return
        
        # Get KQL query
        kql_query = source.get_query(360)  # 15 days
        logger.info(f"Using KQL query from sources.yaml")
        
    except Exception as e:
        logger.error(f"Failed to load configuration: {e}")
        logger.info("Using fallback KQL query...")
        kql_query = """
        ThreatIntelIndicators
        | where TimeGenerated > ago(15d)
        | where Pattern contains "network"
        | extend Type = parse_json(tostring(Data.indicator_types))[0]
        | summarize arg_max(TimeGenerated, *) by ObservableValue
        | project TimeGenerated, ObservableValue, SourceSystem, Type, Confidence, IsActive
        | order by TimeGenerated desc
        """
    
    # TEST 1: Log Analytics Query
    results = test_log_analytics_query(kql_query)
    if not results:
        logger.error("Stopping tests - Log Analytics query failed")
        return
    
    # Extract IPs
    ip_field = 'ObservableValue'
    ip_addresses = [r.get(ip_field) for r in results if r.get(ip_field)]
    
    if len(ip_addresses) < 1000:
        logger.warning(f"Only {len(ip_addresses)} IPs returned. Expected 50K+")
        logger.warning("Consider adjusting your KQL query to return more results")
    
    # TEST 2: Geo-Enrichment
    geo_results = test_geo_enrichment_batching(ip_addresses)
    if not geo_results:
        logger.error("Stopping tests - Geo-enrichment failed")
        return
    
    # TEST 3: GeoJSON Generation
    geojson = test_geojson_generation(results, geo_results)
    if not geojson:
        logger.error("GeoJSON generation failed")
        return
    
    # Summary
    logger.info("=" * 80)
    logger.info("ALL TESTS COMPLETED")
    logger.info("=" * 80)
    logger.info(f"✓ Log Analytics: {len(results):,} records")
    logger.info(f"✓ Geo-Enrichment: {len(geo_results):,} IPs enriched")
    logger.info(f"✓ GeoJSON: {len(geojson['features']):,} features")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()
