#!/usr/bin/env python3
"""
Manual geo enrichment script for MDE devices TSV file.
Downloads the file from blob, enriches IPs with MaxMind, and uploads back.
"""
import os
import sys
import csv
from io import StringIO

def enrich_device_csv():
    """Manually enrich device TSV with geolocation."""
    
    # Read the TSV file
    tsv_file = "c:\\repos\\sentinel-activity-maps\\mde-devices-test.tsv"
    
    with open(tsv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        rows = list(reader)
    
    print(f"Read {len(rows)} devices from {tsv_file}")
    
    # Try to import geoip2 for MaxMind lookups
    try:
        import geoip2.database
        import geoip2.errors
        
        # Try to find MaxMind database
        db_paths = [
            r"C:\ProgramData\MaxMind\GeoLite2-City.mmdb",
            r"C:\Program Files\MaxMind\GeoLite2-City.mmdb",
            os.path.expanduser("~/.maxmind/GeoLite2-City.mmdb"),
            r"C:\repos\sentinel-activity-maps\GeoLite2-City.mmdb"
        ]
        
        reader_obj = None
        for db_path in db_paths:
            if os.path.exists(db_path):
                print(f"Found MaxMind database: {db_path}")
                reader_obj = geoip2.database.Reader(db_path)
                break
        
        if not reader_obj:
            print("ERROR: MaxMind GeoLite2-City database not found!")
            print(f"Tried paths: {db_paths}")
            print("\nDownload from: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data")
            return False
        
        # Enrich each device
        enriched = 0
        for row in rows:
            ip = row.get('PublicIP', '').strip()
            if not ip:
                continue
            
            try:
                response = reader_obj.city(ip)
                row['Latitude'] = str(response.location.latitude) if response.location.latitude else ''
                row['Longitude'] = str(response.location.longitude) if response.location.longitude else ''
                row['Country'] = response.country.iso_code or ''
                row['City'] = response.city.name or ''
                
                print(f"✓ {ip}: {row['City']}, {row['Country']} ({row['Latitude']}, {row['Longitude']})")
                enriched += 1
            except geoip2.errors.AddressNotFoundError:
                print(f"✗ {ip}: Not found in database")
            except Exception as e:
                print(f"✗ {ip}: Error - {e}")
        
        reader_obj.close()
        
        # Write back to file
        output_file = "c:\\repos\\sentinel-activity-maps\\mde-devices-enriched.tsv"
        fieldnames = list(rows[0].keys())
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t')
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"\n✓ Enriched {enriched}/{len(rows)} devices")
        print(f"✓ Saved to: {output_file}")
        print(f"\nUpload with: az storage blob upload --account-name sentinelmapsstore --container-name datasets --name mde-devices.tsv --file \"{output_file}\" --overwrite")
        
        return True
        
    except ImportError:
        print("ERROR: geoip2 library not installed")
        print("Install with: pip install geoip2")
        return False

if __name__ == "__main__":
    success = enrich_device_csv()
    sys.exit(0 if success else 1)
