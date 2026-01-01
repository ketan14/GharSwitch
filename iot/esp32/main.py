import urequests
import time
import json
import config
from machine import Pin

# Configuration
DB_URL = config.DB_URL
TENANT_ID = config.TENANT_ID
DEVICE_ID = config.DEVICE_ID
DEVICE_TOKEN = getattr(config, 'DEVICE_TOKEN', None)

# Hardware - 4 Channel Relay Pins (Example pins for ESP32)
pins = {
    "s1": Pin(2, Pin.OUT), # D2
    "s2": Pin(4, Pin.OUT), # D4
    "s3": Pin(5, Pin.OUT), # D5
    "s4": Pin(18, Pin.OUT) # D18
}

# Local State
state = {"s1": False, "s2": False, "s3": False, "s4": False}

def update_hardware():
    for key, val in state.items():
        # High level usually means OFF for some relay modules, adjust accordingly
        pins[key].value(1 if val else 0)

def report_status():
    url = f"{DB_URL}/tenants/{TENANT_ID}/device_states/{DEVICE_ID}.json"
    try:
        payload = {k: ("ON" if v else "OFF") for k, v in state.items()}
        payload["lastSeen"] = {".sv": "timestamp"} # Server timestamp
        response = urequests.put(url, json=payload)
        response.close()
        print("[HARDWARE] Status reported to RTDB")
    except Exception as e:
        print("[ERROR] Failed to report status:", e)

def check_commands():
    url = f"{DB_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending.json"
    try:
        response = urequests.get(url)
        commands = response.json()
        response.close()
        
        if commands:
            for cmd_id, cmd in commands.items():
                target = cmd.get("target") # e.g., "s1"
                action = cmd.get("action") # e.g., True/False
                
                if target in state:
                    print(f"[HARDWARE] Executing Command: {target} -> {action}")
                    state[target] = action
                    update_hardware()
                    
                    # Delete command from pending after execution
                    del_url = f"{DB_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending/{cmd_id}.json"
                    urequests.delete(del_url).close()
            
            # Report status after taking action
            report_status()
            
    except Exception as e:
        # print("[DEBUG] No commands or check failed:", e)
        pass

def mark_presence():
    # Update presence node for automatic online/offline detection
    url = f"{DB_URL}/tenants/{TENANT_ID}/presence/{DEVICE_ID}.json"
    try:
        urequests.put(url, json={"online": True, "lastSeen": {".sv": "timestamp"}}).close()
    except:
        pass

# Main Loop
print(f"Starting GharSwitch Hardware: {DEVICE_ID}...")
report_status()
mark_presence()

while True:
    check_commands()
    # Simple heartbeat/presence update every minute
    if time.time() % 60 == 0:
        mark_presence()
    
    time.sleep(1) # Poll every second for commands
