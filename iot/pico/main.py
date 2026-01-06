import urequests
import time
import json
import config
import utime
import ntptime
#import hmac
import hashlib
import binascii
from machine import Pin
import gc, ujson
import urequests
import time
import json
from machine import Pin

# ====== Firebase RTDB Setup ======
 
DATABASE_URL = config.DB_URL

# Configuration from config.py
DB_URL = config.DB_URL
TENANT_ID = config.TENANT_ID
DEVICE_ID = config.DEVICE_ID
SHARED_SECRET = config.SHARED_SECRET  # Ensure this is in your config.py
MINT_TOKEN_URL = configMINT_TOKEN_URL
# ====== Hardware Setup ======
pins = {
    "s1": Pin(15, Pin.OUT),
    "s2": Pin(14, Pin.OUT),
    "s3": Pin(13, Pin.OUT),
    "s4": Pin(12, Pin.OUT)
}

# Local cache
device_state = {k: False for k in pins.keys()}

# ====== Helpers ======
def print_status():
    status_str = " | ".join([f"{k}: {'ON' if v else 'OFF'}" for k, v in device_state.items()])
    print(f"[STATUS] {status_str}")

def handle_state_update(new_state: dict):
    global device_state
    for k, v in new_state.items():
        if k in device_state:
            device_state[k] = bool(v)
            pins[k].value(1 if v else 0)  # drive GPIO
    print("\n[DEVICE] Switch state updated:")
    print_status()

def fetch_commands():
    url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending.json"
    try:
        r = urequests.get(url)
        if r.status_code == 200 and r.text != "null":
            commands = ujson.loads(r.text)   # lighter than r.json()
            if isinstance(commands, dict):
                for cmd_id, payload in commands.items():
                    target = payload.get("target")
                    action = payload.get("action")
                    if target in pins:
                        handle_state_update({target: action})

                        # Update state remotely
                        state_url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches.json"
                        resp = urequests.patch(state_url, data=json.dumps({target: action}))
                        resp.close(); del resp

                        # Acknowledge
                        ack_url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending/{cmd_id}.json"
                        resp = urequests.delete(ack_url)
                        resp.close(); del resp

            del commands
        r.close(); del r
        gc.collect()
    except Exception as e:
        print("Error fetching commands:", e)

def fetch_state():
    url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches.json"
    try:
        r = urequests.get(url)
        if r.status_code == 200 and r.text != "null":
            state = r.json()
            if isinstance(state, dict):
                handle_state_update(state)
        else:
            # Initialize default state
            urequests.put(url, data=json.dumps(device_state))
            print("[DEVICE] Initialized default state (All OFF).")
        r.close()
    except Exception as e:
        print("Error fetching state:", e)

def heartbeat():
    url = f"{DATABASE_URL}/tenants/{TENANT_ID}/presence/{DEVICE_ID}.json"
    print(f"{DATABASE_URL}/tenants/{TENANT_ID}/presence/{DEVICE_ID}.json")
    payload = {"online": True, "lastSeen": int(time.time() * 1000)}
    try:
        urequests.put(url, data=json.dumps(payload))
    except Exception as e:
        print("Heartbeat error:", e)

# ====== Main Loop ======
def main():
    print("========================================")
    print("   GharSwitch IoT - Pico W (MicroPy)    ")
    print("========================================")
    print(f"Device ID: {DEVICE_ID}")
    print(f"Tenant ID: {TENANT_ID}")

    # Initialize state
    fetch_state()

    while True:
        fetch_commands()
        heartbeat()
        time.sleep(5)  # poll every 5s

main()

