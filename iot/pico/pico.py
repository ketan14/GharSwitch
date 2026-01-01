import urequests
import time
import json
import config
import network # Added for WiFi
from machine import Pin

# Configuration
DB_URL = config.DB_URL
TENANT_ID = config.TENANT_ID
DEVICE_ID = config.DEVICE_ID

# WiFi Credentials (Add these to your config.py)
#WIFI_SSID = getattr(config, 'WIFI_SSID', 'Your_SSID')
#WIFI_PASS = getattr(config, 'WIFI_PASS', 'Your_Password')

WIFI_SSID = config.WIFI_SSID
WIFI_PASS = config.WIFI_PASS

# Hardware
pins = {
    "s1": Pin(15, Pin.OUT),
    "s2": Pin(14, Pin.OUT),
    "s3": Pin(13, Pin.OUT),
    "s4": Pin(12, Pin.OUT)
}

state = {"s1": False, "s2": False, "s3": False, "s4": False}

# ========================================
# WIFI CONNECTION HANDLER
# ========================================
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    if not wlan.isconnected():
        print(f"Connecting to WiFi: {WIFI_SSID}...")
        wlan.connect(WIFI_SSID, WIFI_PASS)
        
        # Wait for connection with a timeout (15 seconds)
        max_wait = 15
        while max_wait > 0:
            if wlan.isconnected():
                break
            max_wait -= 1
            print('Waiting for connection...')
            time.sleep(1)

    if wlan.isconnected():
        status = wlan.ifconfig()
        print(f"Connected! IP Address: {status[0]}")
        return True
    else:
        print("Failed to connect to WiFi. Check credentials.")
        return False

# ========================================
# FIREBASE FUNCTIONS
# ========================================
def update_hardware():
    for key, val in state.items():
        pins[key].value(1 if val else 0)

def report_status():
    url = f"{DB_URL}/tenants/{TENANT_ID}/device_states/{DEVICE_ID}.json"
    try:
        # Note: Using .patch instead of .put preserves other data in that node
        payload = {k: ("ON" if v else "OFF") for k, v in state.items()}
        response = urequests.patch(url, json=payload)
        response.close()
        print("[HARDWARE] Status reported")
    except Exception as e:
        print("[ERROR] Failed to report status:", e)

def check_commands():
    url = f"{DB_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending.json"
    try:
        response = urequests.get(url)
        commands = response.json()
        response.close()
        
        if commands and isinstance(commands, dict):
            for cmd_id, cmd in commands.items():
                target = cmd.get("target")
                action = cmd.get("action")
                
                if target in state:
                    print(f"[HARDWARE] Command: {target} -> {action}")
                    state[target] = action
                    update_hardware()
                    
                    del_url = f"{DB_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending/{cmd_id}.json"
                    urequests.delete(del_url).close()
            
            report_status()
    except Exception as e:
        # Silently fail if network blips
        pass

def mark_presence():
    url = f"{DB_URL}/tenants/{TENANT_ID}/presence/{DEVICE_ID}.json"
    try:
        # Using patch for online status
        urequests.patch(url, json={"online": True}).close()
    except:
        pass

# ========================================
# MAIN PROCESS
# ========================================
print(f"Starting GharSwitch Pico W: {DEVICE_ID}...")

# 1. STOP if WiFi fails
if not connect_wifi():
    print("CRITICAL: No Internet. System Halted.")
    # You could add a machine.reset() here if you want it to retry forever
else:
    # 2. Initial Sync
    report_status()
    mark_presence()

    # 3. Main Loop
    while True:
        check_commands()
        
        # Mark presence every 60 seconds
        if time.time() % 60 == 0:
            mark_presence()
        
        time.sleep(1)
