import json
import random
from datetime import datetime, timedelta

# Same city data as signin generator for consistency
us_cities = [
    {"name": "New York", "state": "NY", "coords": [-74.006, 40.7128], "country": "United States"},
    {"name": "Los Angeles", "state": "CA", "coords": [-118.2437, 34.0522], "country": "United States"},
    {"name": "Chicago", "state": "IL", "coords": [-87.6298, 41.8781], "country": "United States"},
    {"name": "Houston", "state": "TX", "coords": [-95.3698, 29.7604], "country": "United States"},
    {"name": "Phoenix", "state": "AZ", "coords": [-112.074, 33.4484], "country": "United States"},
    {"name": "Philadelphia", "state": "PA", "coords": [-75.1652, 39.9526], "country": "United States"},
    {"name": "San Antonio", "state": "TX", "coords": [-98.4936, 29.4241], "country": "United States"},
    {"name": "San Diego", "state": "CA", "coords": [-117.1611, 32.7157], "country": "United States"},
    {"name": "Dallas", "state": "TX", "coords": [-96.797, 32.7767], "country": "United States"},
    {"name": "San Jose", "state": "CA", "coords": [-121.8863, 37.3382], "country": "United States"},
    {"name": "Austin", "state": "TX", "coords": [-97.7431, 30.2672], "country": "United States"},
    {"name": "Seattle", "state": "WA", "coords": [-122.3321, 47.6062], "country": "United States"},
    {"name": "Denver", "state": "CO", "coords": [-104.9903, 39.7392], "country": "United States"},
    {"name": "Boston", "state": "MA", "coords": [-71.0589, 42.3601], "country": "United States"},
    {"name": "Miami", "state": "FL", "coords": [-80.1918, 25.7617], "country": "United States"},
    {"name": "Atlanta", "state": "GA", "coords": [-84.388, 33.749], "country": "United States"},
]

europe_cities = [
    {"name": "London", "state": "England", "coords": [-0.1278, 51.5074], "country": "United Kingdom"},
    {"name": "Paris", "state": "Île-de-France", "coords": [2.3522, 48.8566], "country": "France"},
    {"name": "Berlin", "state": "Berlin", "coords": [13.405, 52.52], "country": "Germany"},
    {"name": "Madrid", "state": "Community of Madrid", "coords": [-3.7038, 40.4168], "country": "Spain"},
    {"name": "Rome", "state": "Lazio", "coords": [12.4964, 41.9028], "country": "Italy"},
    {"name": "Amsterdam", "state": "North Holland", "coords": [4.9041, 52.3676], "country": "Netherlands"},
    {"name": "Brussels", "state": "Brussels", "coords": [4.3517, 50.8503], "country": "Belgium"},
    {"name": "Vienna", "state": "Vienna", "coords": [16.3738, 48.2082], "country": "Austria"},
    {"name": "Stockholm", "state": "Stockholm", "coords": [18.0686, 59.3293], "country": "Sweden"},
    {"name": "Dublin", "state": "Leinster", "coords": [-6.2603, 53.3498], "country": "Ireland"},
]

other_cities = [
    {"name": "Toronto", "state": "Ontario", "coords": [-79.3832, 43.6532], "country": "Canada"},
    {"name": "Vancouver", "state": "British Columbia", "coords": [-123.1207, 49.2827], "country": "Canada"},
    {"name": "Sydney", "state": "New South Wales", "coords": [151.2093, -33.8688], "country": "Australia"},
    {"name": "Melbourne", "state": "Victoria", "coords": [144.9631, -37.8136], "country": "Australia"},
    {"name": "Tokyo", "state": "Tokyo", "coords": [139.6917, 35.6895], "country": "Japan"},
    {"name": "Singapore", "state": "Singapore", "coords": [103.8198, 1.3521], "country": "Singapore"},
    {"name": "Hong Kong", "state": "Hong Kong", "coords": [114.1694, 22.3193], "country": "Hong Kong"},
    {"name": "Shanghai", "state": "Shanghai", "coords": [121.4737, 31.2304], "country": "China"},
    {"name": "Mumbai", "state": "Maharashtra", "coords": [72.8777, 19.076], "country": "India"},
    {"name": "São Paulo", "state": "São Paulo", "coords": [-46.6333, -23.5505], "country": "Brazil"},
    {"name": "Mexico City", "state": "CDMX", "coords": [-99.1332, 19.4326], "country": "Mexico"},
    {"name": "Buenos Aires", "state": "Buenos Aires", "coords": [-58.3816, -34.6037], "country": "Argentina"},
    {"name": "Lagos", "state": "Lagos", "coords": [3.3792, 6.5244], "country": "Nigeria"},
    {"name": "Cairo", "state": "Cairo", "coords": [31.2357, 30.0444], "country": "Egypt"},
    {"name": "Dubai", "state": "Dubai", "coords": [55.2708, 25.2048], "country": "United Arab Emirates"},
    {"name": "Istanbul", "state": "Istanbul", "coords": [28.9784, 41.0082], "country": "Turkey"},
    {"name": "Moscow", "state": "Moscow", "coords": [37.6173, 55.7558], "country": "Russia"},
    {"name": "Seoul", "state": "Seoul", "coords": [126.978, 37.5665], "country": "South Korea"},
    {"name": "Bangkok", "state": "Bangkok", "coords": [100.5018, 13.7563], "country": "Thailand"},
    {"name": "Jakarta", "state": "Jakarta", "coords": [106.8456, -6.2088], "country": "Indonesia"},
]

first_names = ["John", "Jane", "Michael", "Sarah", "David", "Emily", "Robert", "Maria", "James", "Jennifer",
               "William", "Linda", "Richard", "Patricia", "Thomas", "Susan", "Daniel", "Jessica", "Matthew", "Karen"]

last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
              "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee"]

browsers = ["Chrome 120.0", "Edge 120.0", "Firefox 121.0", "Safari 17.2"]
operating_systems = ["Windows 11", "Windows 10", "macOS 14.2", "macOS 13.6", "iOS 17.2", "Android 14"]

# Microsoft IP ranges
ms_ip_ranges = ["20", "40", "52", "104", "13"]

def generate_ip(use_ms_range=False):
    if use_ms_range:
        prefix = random.choice(ms_ip_ranges)
        return f"{prefix}.{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}"
    else:
        prefixes = [8, 24, 31, 45, 64, 72, 84, 92, 100, 108, 172, 192]
        prefix = random.choice(prefixes)
        return f"{prefix}.{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}"

def generate_device_id():
    return f"{random.randint(10000000, 99999999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(100000000000, 999999999999)}"

device_types = ["Desktop", "Laptop", "Mobile", "Tablet"]
device_type_weights = [0.30, 0.40, 0.20, 0.10]  # 30% desktop, 40% laptop, 20% mobile, 10% tablet

# Generate 500 unique device locations (last known location per device)
features = []
start_time = datetime.now() - timedelta(days=2)

print("Generating 500 device location records...")

for i in range(500):
    # More global distribution: 45% US, 30% Europe, 25% other regions
    rand = random.random()
    if rand < 0.45:
        city = random.choice(us_cities)
    elif rand < 0.75:
        city = random.choice(europe_cities)
    else:
        city = random.choice(other_cities)
    
    # Add coordinate variance within city (±0.1 degrees ~11km)
    base_lng, base_lat = city["coords"]
    lng = base_lng + random.uniform(-0.1, 0.1)
    lat = base_lat + random.uniform(-0.1, 0.1)
    
    # 20% Microsoft IP ranges
    use_ms_ip = random.random() < 0.20
    ip_address = generate_ip(use_ms_ip)
    
    # Generate timestamp within last 48 hours
    time_offset = timedelta(
        hours=random.randint(0, 47),
        minutes=random.randint(0, 59),
        seconds=random.randint(0, 59)
    )
    timestamp = (start_time + time_offset).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    
    user_first = random.choice(first_names)
    user_last = random.choice(last_names)
    user = f"{user_first.lower()}.{user_last.lower()}@contoso.com"
    user_display = f"{user_first} {user_last}"
    
    # Most devices are managed and compliant
    is_managed = random.random() < 0.85
    is_compliant = is_managed and random.random() < 0.90
    
    # Randomly select device type based on weights
    device_type = random.choices(device_types, weights=device_type_weights)[0]
    
    # Generate device name based on type
    device_suffix = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6))
    if device_type == "Desktop":
        device_name = f"DESKTOP-{device_suffix}"
    elif device_type == "Laptop":
        device_name = f"LAPTOP-{device_suffix}"
    elif device_type == "Mobile":
        device_name = f"MOBILE-{device_suffix}"
    else:  # Tablet
        device_name = f"TABLET-{device_suffix}"
    
    feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lng, lat]
        },
        "properties": {
            "TimeGenerated": timestamp,
            "DeviceId": generate_device_id(),
            "DeviceName": device_name,
            "DeviceType": device_type,
            "UserDisplayName": user_display,
            "UserPrincipalName": user,
            "IPAddress": ip_address,
            "IsMicrosoftIP": use_ms_ip,
            "Browser": random.choice(browsers),
            "OperatingSystem": random.choice(operating_systems),
            "isCompliant": is_compliant,
            "isManaged": is_managed,
            "CountryOrRegion": city["country"],
            "State": city["state"],
            "City": city["name"],
            "Latitude": lat,
            "Longitude": lng
        }
    }
    
    features.append(feature)

# Create GeoJSON
geojson = {
    "type": "FeatureCollection",
    "features": features
}

# Write to file
with open("device-locations-demo.geojson", "w") as f:
    json.dump(geojson, f, indent=2)

print(f"Generated {len(features)} device location records")
print(f"File: device-locations-demo.geojson")

# Print some stats
us_count = sum(1 for f in features if f["properties"]["CountryOrRegion"] == "United States")
europe_count = sum(1 for f in features if f["properties"]["CountryOrRegion"] in ["United Kingdom", "France", "Germany", "Spain", "Italy", "Netherlands", "Belgium", "Austria", "Sweden", "Ireland"])
ms_ip_count = sum(1 for f in features if f["properties"]["IsMicrosoftIP"])
managed_count = sum(1 for f in features if f["properties"]["isManaged"])
desktop_count = sum(1 for f in features if f["properties"]["DeviceType"] == "Desktop")
laptop_count = sum(1 for f in features if f["properties"]["DeviceType"] == "Laptop")
mobile_count = sum(1 for f in features if f["properties"]["DeviceType"] == "Mobile")
tablet_count = sum(1 for f in features if f["properties"]["DeviceType"] == "Tablet")

print(f"\nStats:")
print(f"  US locations: {us_count} ({us_count/len(features)*100:.1f}%)")
print(f"  Europe locations: {europe_count} ({europe_count/len(features)*100:.1f}%)")
print(f"  Microsoft IP ranges: {ms_ip_count} ({ms_ip_count/len(features)*100:.1f}%)")
print(f"  Managed devices: {managed_count} ({managed_count/len(features)*100:.1f}%)")
print(f"\nDevice Types:")
print(f"  Desktops: {desktop_count} ({desktop_count/len(features)*100:.1f}%) - Blue computer icon")
print(f"  Laptops: {laptop_count} ({laptop_count/len(features)*100:.1f}%) - Blue computer icon")
print(f"  Mobiles: {mobile_count} ({mobile_count/len(features)*100:.1f}%) - Green phone icon")
print(f"  Tablets: {tablet_count} ({tablet_count/len(features)*100:.1f}%) - Green phone icon")
