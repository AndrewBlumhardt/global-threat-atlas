#!/usr/bin/env python3
"""Generate GeoJSON from enriched MDE devices TSV."""
import csv
import json

def tsv_to_geojson():
    """Convert TSV to GeoJSON format."""
    tsv_file = r"c:\repos\sentinel-activity-maps\mde-devices-enriched.tsv"
    geojson_file = r"c:\repos\sentinel-activity-maps\mde-devices.geojson"
    
    features = []
    
    with open(tsv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        
        for row in reader:
            lat = row.get('Latitude', '').strip()
            lon = row.get('Longitude', '').strip()
            
            if not lat or not lon:
                print(f"Skipping device {row.get('DeviceName', 'unknown')} - no coordinates")
                continue
            
            try:
                lat_float = float(lat)
                lon_float = float(lon)
            except ValueError:
                print(f"Skipping device {row.get('DeviceName', 'unknown')} - invalid coordinates")
                continue
            
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon_float, lat_float]
                },
                "properties": {
                    "TimeGenerated": row.get('TimeGenerated', ''),
                    "DeviceName": row.get('DeviceName', ''),
                    "DeviceId": row.get('DeviceId', ''),
                    "OSPlatform": row.get('OSPlatform', ''),
                    "DeviceType": row.get('DeviceType', ''),
                    "CloudPlatform": row.get('CloudPlatform', ''),
                    "OnboardingStatus": row.get('OnboardingStatus', ''),
                    "PublicIP": row.get('PublicIP', ''),
                    "SensorHealthState": row.get('SensorHealthState', ''),
                    "ExposureLevel": row.get('ExposureLevel', ''),
                    "Country": row.get('Country', ''),
                    "City": row.get('City', '')
                }
            }
            
            features.append(feature)
            print(f"✓ Added {row.get('DeviceName', 'unknown')}: {row.get('City', '')}, {row.get('Country', '')}")
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(geojson_file, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"\n✓ Generated GeoJSON with {len(features)} features")
    print(f"✓ Saved to: {geojson_file}")
    print(f"\nUpload with:")
    print(f'  az storage blob upload --account-name sentinelmapsstore --container-name datasets --name mde-devices.geojson --file "{geojson_file}" --overwrite')

if __name__ == "__main__":
    tsv_to_geojson()
