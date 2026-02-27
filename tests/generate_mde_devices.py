import csv
import random
from datetime import datetime, timedelta
import hashlib
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DATA_DIR = REPO_ROOT / "tests" / "sample-data"

# Device naming patterns
device_prefixes = [
    "win11-ws", "win10-ws", "ws", "workstation", "pc", "laptop", "desktop",
    "srv", "server", "dc", "sql", "web", "app", "db", "file", "mail", "proxy",
    "linux-srv", "ubuntu-srv", "centos-srv", "azure-vm", "vm", "cloud-vm"
]

os_platforms = ["Windows11", "Windows10", "WindowsServer2022", "WindowsServer2019", "WindowsServer2016", "Linux"]
device_types = ["Workstation", "Server"]
cloud_platforms = ["Azure", "AWS", "GCP", ""]
onboarding_statuses = ["Onboarded", "Can be onboarded", "Insufficient info"]
sensor_health_states = ["Active", "Inactive", ""]
exposure_levels = ["Low", "Medium", "High", "None"]

# IP address pools (expanded for variety)
ip_prefixes = [
    # Microsoft ranges
    (13, 20), (20, 20), (40, 30), (52, 40), (104, 10),
    # Common public ranges
    (4, 10), (8, 5), (23, 10), (58, 5), (73, 5), (76, 5),
    (137, 5), (150, 5), (154, 5), (167, 5), (172, 15), (196, 5)
]

def generate_ip():
    """Generate a random public IP address"""
    prefix_range = random.choice(ip_prefixes)
    prefix = random.randint(prefix_range[0], prefix_range[0] + prefix_range[1])
    return f"{prefix}.{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}"

def generate_device_id():
    """Generate a unique device ID (sanitized hash)"""
    unique_string = f"{random.random()}{datetime.now().isoformat()}"
    return hashlib.sha1(unique_string.encode()).hexdigest()

def generate_device_name(device_type, index):
    """Generate a sanitized device name"""
    if device_type == "Server":
        prefix = random.choice([p for p in device_prefixes if "srv" in p or "server" in p or "dc" in p or "sql" in p or "web" in p or "app" in p or "linux" in p])
    else:
        prefix = random.choice([p for p in device_prefixes if "ws" in p or "pc" in p or "laptop" in p or "desktop" in p or "workstation" in p])
    
    return f"{prefix}-{random.randint(100, 999)}"

def select_os_for_type(device_type):
    """Select appropriate OS for device type"""
    if device_type == "Server":
        return random.choice(["WindowsServer2022", "WindowsServer2019", "WindowsServer2016", "Linux"])
    else:
        return random.choice(["Windows11", "Windows10"])

# Generate 500 unique devices
devices = []
start_time = datetime.now() - timedelta(hours=12)

print("Generating 500 MDE device records...")

for i in range(500):
    # Select device type and characteristics
    device_type = random.choice(device_types) if random.random() < 0.7 else "Server"  # 70% workstations
    os_platform = select_os_for_type(device_type)
    
    # Cloud platform (70% Azure, 20% other, 10% none)
    rand_cloud = random.random()
    if rand_cloud < 0.70:
        cloud_platform = "Azure"
    elif rand_cloud < 0.90:
        cloud_platform = random.choice(["AWS", "GCP"])
    else:
        cloud_platform = ""
    
    # Onboarding status (80% onboarded)
    if random.random() < 0.80:
        onboarding_status = "Onboarded"
        sensor_health = random.choice(["Active", "Inactive"])
        public_ip = generate_ip()
    else:
        onboarding_status = random.choice(["Can be onboarded", "Insufficient info"])
        sensor_health = ""
        public_ip = ""
    
    # Exposure level
    if device_type == "Server":
        exposure = random.choice(["Medium", "High", "Low"])
    else:
        exposure = random.choice(["High", "Medium", "Low", "None"])
    
    # Generate timestamp within last 12 hours
    time_offset = timedelta(
        hours=random.randint(0, 11),
        minutes=random.randint(0, 59),
        seconds=random.randint(0, 59),
        milliseconds=random.randint(0, 999)
    )
    timestamp = (start_time + time_offset).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    
    device = {
        "TimeGenerated": timestamp,
        "DeviceName": generate_device_name(device_type, i),
        "DeviceId": generate_device_id(),
        "OSPlatform": os_platform,
        "DeviceType": device_type,
        "CloudPlatform": cloud_platform,
        "OnboardingStatus": onboarding_status,
        "PublicIP": public_ip,
        "SensorHealthState": sensor_health,
        "ExposureLevel": exposure
    }
    
    devices.append(device)

# Write to TSV
output_file = SAMPLE_DATA_DIR / "mde-devices.tsv"
headers = [
    "TimeGenerated",
    "DeviceName", 
    "DeviceId",
    "OSPlatform",
    "DeviceType",
    "CloudPlatform",
    "OnboardingStatus",
    "PublicIP",
    "SensorHealthState",
    "ExposureLevel"
]

with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=headers, delimiter='\t')
    writer.writeheader()
    writer.writerows(devices)

print(f"Generated {len(devices)} MDE device records")
print(f"File: {output_file}")

# Print stats
onboarded_count = sum(1 for d in devices if d["OnboardingStatus"] == "Onboarded")
workstation_count = sum(1 for d in devices if d["DeviceType"] == "Workstation")
server_count = sum(1 for d in devices if d["DeviceType"] == "Server")
azure_count = sum(1 for d in devices if d["CloudPlatform"] == "Azure")
has_ip_count = sum(1 for d in devices if d["PublicIP"])

print(f"\nStats:")
print(f"  Onboarded: {onboarded_count} ({onboarded_count/len(devices)*100:.1f}%)")
print(f"  Workstations: {workstation_count} ({workstation_count/len(devices)*100:.1f}%)")
print(f"  Servers: {server_count} ({server_count/len(devices)*100:.1f}%)")
print(f"  Azure: {azure_count} ({azure_count/len(devices)*100:.1f}%)")
print(f"  With Public IP: {has_ip_count} ({has_ip_count/len(devices)*100:.1f}%)")
