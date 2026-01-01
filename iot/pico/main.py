import urequests
import time
import json
import config
from machine import Pin

# Configuration
DB_URL = config.DB_URL
TENANT_ID = config.TENANT_ID
DEVICE_ID = config.DEVICE_ID
#DEVICE_TOKEN = getattr(config, 'DEVICE_TOKEN', None)

# Hardware - 4 Channel Relay Pins (Pico W specific)
pins = {
    "s1": Pin(15, Pin.OUT), # GP15
    "s2": Pin(14, Pin.OUT), # GP14
    "s3": Pin(13, Pin.OUT), # GP13
    "s4": Pin(12, Pin.OUT)  # GP12
}

# Local State
state = {"s1": False, "s2": False, "s3": False, "s4": False}

def update_hardware():
    for key, val in state.items():
        pins[key].value(1 if val else 0)

def report_status():
    url = f"{DB_URL}/tenants/{TENANT_ID}/device_states/{DEVICE_ID}.json"
    try:
        payload = {k: ("ON" if v else "OFF") for k, v in state.items()}
        payload["lastSeen"] = {".sv": "timestamp"}
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
                target = cmd.get("target")
                action = cmd.get("action")
                
                if target in state:
                    print(f"[HARDWARE] Executing Command: {target} -> {action}")
                    state[target] = action
                    update_hardware()
                    
                    del_url = f"{DB_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending/{cmd_id}.json"
                    urequests.delete(del_url).close()
            
            report_status()
            
    except Exception as e:
        pass

def mark_presence():
    url = f"{DB_URL}/tenants/{TENANT_ID}/presence/{DEVICE_ID}.json"
    try:
        urequests.put(url, json={"online": True, "lastSeen": {".sv": "timestamp"}}).close()
    except:
        pass

# Main Loop
print(f"Starting GharSwitch Pico W: {DEVICE_ID}...")
report_status()
mark_presence()

while True:
    check_commands()
    if time.time() % 60 == 0:
        mark_presence()
    
    time.sleep(1)
