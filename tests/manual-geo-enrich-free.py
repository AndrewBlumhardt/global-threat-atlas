#!/usr/bin/env python3
"""
Manual geo enrichment using free IP geolocation API (no MaxMind needed for testing).
"""
import csv
import requests
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DATA_DIR = REPO_ROOT / "tests" / "sample-data"

def enrich_with_free_api():
    """Enrich device TSV using ip-api.com (free, no key needed)."""
    
    tsv_file = SAMPLE_DATA_DIR / "mde-devices-test.tsv"
    
    with open(tsv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        rows = list(reader)
    
    print(f"Read {len(rows)} devices")
    
    # Enrich each device
    enriched = 0
    for row in rows:
        ip = row.get('PublicIP', '').strip()
        if not ip:
            print(f"Skipping row - no IP")
            continue
        
        try:
            # Use free ip-api.com service (45 requests/minute limit)
            print(f"Looking up {ip}...")
            response = requests.get(f"http://ip-api.com/json/{ip}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    row['Latitude'] = str(data.get('lat', ''))
                    row['Longitude'] = str(data.get('lon', ''))
                    row['Country'] = data.get('countryCode', '')
                    row['City'] = data.get('city', '')
                    
                    print(f"✓ {ip}: {row['City']}, {row['Country']} ({row['Latitude']}, {row['Longitude']})")
                    enriched += 1
                else:
                    print(f"✗ {ip}: {data.get('message', 'Unknown error')}")
            else:
                print(f"✗ {ip}: HTTP {response.status_code}")
            
            time.sleep(1.5)  # Rate limit: 45 req/min = 1.33s between requests
            
        except Exception as e:
            print(f"✗ {ip}: Error - {e}")
    
    # Write enriched file
    output_file = SAMPLE_DATA_DIR / "mde-devices-enriched.tsv"
    fieldnames = list(rows[0].keys())
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t')
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"\n✓ Enriched {enriched}/{len(rows)} devices")
    print(f"✓ Saved to: {output_file}")
    
    # Show upload command
    print(f"\nUpload with:")
    print(f'  az storage blob upload --account-name sentinelmapsstore --container-name datasets --name mde-devices.tsv --file "{output_file}" --overwrite')
    
    return True

if __name__ == "__main__":
    enrich_with_free_api()
