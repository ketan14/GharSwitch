import gc
import ujson
import urequests
import time
import ntptime
from machine import Pin
import config
import machine
import network

# Overclock to 240MHz for faster SSL/JSON processing
machine.freq(240000000)

# ====== Firebase RTDB Setup ======
DATABASE_URL = config.DB_URL
TENANT_ID = config.TENANT_ID
DEVICE_ID = config.DEVICE_ID

# Global WLAN object
wlan = network.WLAN(network.STA_IF)

# ====== Auth Globals ======
ID_TOKEN = None

# Watchdog Timer Global
wdt = None

# Unix Epoch Delta (seconds between 1970-01-01 and 2000-01-01)
# MicroPython uses 2000 epoch, JS/Firebase uses 1970
UNIX_EPOCH_DELTA = 946684800

def error_blink(seconds=5):
    """Blinks onboard LED for a short duration and returns (non-halting)"""
    print(f"[SYSTEM] Indicating error via LED for {seconds}s...")
    led = machine.Pin("LED", machine.Pin.OUT)
    start = time.time()
    while time.time() - start < seconds:
        led.toggle()
        time.sleep(0.2)
        # Feed WDT if active so we don't reboot during the blink
        if wdt: wdt.feed()
    led.off()


def ensure_wifi():
    """Checks WiFi connection and reconnects if needed"""
    if not wlan.isconnected():
        print("[WIFI] Connection lost. Reconnecting...")
        wlan.active(True)
        wlan.connect(config.WIFI_SSID, config.WIFI_PASS)
        attempts = 0
        while not wlan.isconnected() and attempts < 10:
            time.sleep(1)
            attempts += 1
            # Feed WDT if active
            if wdt: wdt.feed()
        
        if wlan.isconnected():
            print("[WIFI] Reconnected. IP:", wlan.ifconfig()[0])
        else:
            print("[WIFI] Reconnect failed.")

def sync_time():
    """Syncs internal RTC via NTP"""
    ensure_wifi()
    print("[TIME] Syncing time via NTP...")
    try:
        ntptime.settime()
        print("[TIME] Time synced.")
    except Exception as e:
        print("[TIME] Failed to sync time:", e)

def get_current_unix_ms():
    """Returns current timestamp in ms (1970 Epoch) for Firebase"""
    return int((time.time() + UNIX_EPOCH_DELTA) * 1000)

def get_id_token():
    """Exchanges Device Secret for ID Token via Cloud Function + Identity Toolkit"""
    ensure_wifi()
    print("[AUTH] Authenticating...")
    try:
        # Step 1: Get Custom Token from your Cloud Function
        # Note: You must add AUTH_URL, DEVICE_SECRET, API_KEY to config.py
        payload = ujson.dumps({"deviceId": DEVICE_ID, "deviceSecret": config.DEVICE_SECRET})
        r = urequests.post(config.AUTH_URL, data=payload, headers={'Content-Type': 'application/json'})
        
        if r.status_code != 200:
            print(f"[AUTH] Failed to get custom token: {r.status_code} {r.text}")
            
            # Error Handling for 500 (Configuration or Transient Server Error)
            if r.status_code == 500:
                print("[AUTH] Server Error (500). Will retry later...")
                r.close()
                error_blink(3) # Indicate error but don't halt
                return None
                
            r.close()
            return None
            
        custom_token = r.json().get('token')
        r.close()
        
        # Step 2: Exchange Custom Token for ID Token
        identity_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={config.API_KEY}"
        r2 = urequests.post(identity_url, data=ujson.dumps({"token": custom_token, "returnSecureToken": True}))
        
        if r2.status_code != 200:
            print(f"[AUTH] Failed exchange: {r2.status_code} {r2.text}")
            r2.close()
            return None
            
        id_token = r2.json().get('idToken')
        r2.close()
        print("[AUTH] Success! Token acquired.")
        return id_token
    except Exception as e:
        print("[AUTH] Error:", e)
        return None

# ====== Hardware Setup ======
pins = {
    "s1": Pin(15, Pin.OUT),
    "s2": Pin(14, Pin.OUT),
    "s3": Pin(13, Pin.OUT),
    "s4": Pin(12, Pin.OUT)
}

device_state = {k: False for k in pins.keys()}

# ====== Original Helpers (Restored) ======

def print_status():
    status_str = " | ".join([f"{k}: {'ON' if v else 'OFF'}" for k, v in device_state.items()])
    print(f"[STATUS] {status_str}")

def handle_state_update(new_state: dict):
    global device_state
    for k, v in new_state.items():
        if k in device_state:
            device_state[k] = bool(v)
            pins[k].value(1 if v else 0)
    print("\n[DEVICE] State updated locally.")
    print_status()

def fetch_state():
    """Initial sync: sets relays to match the database current state"""
    if not ID_TOKEN: return
    url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches.json?auth={ID_TOKEN}"
    try:
        print("[INIT] Fetching current state...")
        r = urequests.get(url)
        if r.status_code == 200 and r.text != "null":
            state = r.json()
            if isinstance(state, dict):
                handle_state_update(state)
        else:
            # Initialize default state if DB is empty
            urequests.put(url, data=ujson.dumps(device_state)).close()
            print("[INIT] Created default state in DB.")
        r.close()
    except Exception as e:
        print("[INIT] Error fetching state:", e)

def heartbeat():
    """Updates the presence node so the app knows the Pico is online"""
    global ID_TOKEN
    
    if not ID_TOKEN:
        ID_TOKEN = get_id_token()
        if not ID_TOKEN: return

    url = f"{DATABASE_URL}/tenants/{TENANT_ID}/presence/{DEVICE_ID}.json?auth={ID_TOKEN}"
    payload = {"online": True, "lastSeen": get_current_unix_ms()}
    
    try:
        r = urequests.put(url, data=ujson.dumps(payload))
        
        # If Token Expired (401), Refresh and Retry
        if r.status_code == 401:
            print("[HEARTBEAT] Token expired in heartbeat. Refreshing...")
            r.close()
            ID_TOKEN = get_id_token() # Refresh global token
            if ID_TOKEN:
                url = f"{DATABASE_URL}/tenants/{TENANT_ID}/presence/{DEVICE_ID}.json?auth={ID_TOKEN}"
                r = urequests.put(url, data=ujson.dumps(payload))
        
        r.close()
        # print("[HEARTBEAT] Presence updated.") # Optional: Reduce spam
    except Exception as e:
        print("[HEARTBEAT] Error:", e)

def execute_single_command(cmd_id, body):
    """Executes, updates state, and clears the pending command"""
    target = body.get("target")
    action = body.get("action")
    
    if target in pins:
        handle_state_update({target: action})

        # 1. Update remote state node
        state_url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches.json?auth={ID_TOKEN}"
        try:
            urequests.patch(state_url, data=ujson.dumps({target: action})).close()
            
            # 2. Delete/Acknowledge the pending command
            ack_url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending/{cmd_id}.json?auth={ID_TOKEN}"
            urequests.delete(ack_url).close()
            print(f"[OK] Command {cmd_id} cleared.")
            
            # 3. Update Presence immediately
            heartbeat()
        except:
            print("[ERR] Failed to acknowledge command.")

# ====== The Listener Logic ======

# Update listen_for_commands to feed WDT and force reconnect
def listen_for_commands():
    """Persistent stream with non-blocking reads and heartbeat"""
    global ID_TOKEN
    base_url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending.json"
    headers = {"Accept": "text/event-stream"}
    
    last_heartbeat_time = time.ticks_ms()
    HEARTBEAT_INTERVAL = 300000 # 5 Minutes (Optimization)
    
    # Force Reconnect Logic (45 minutes) to avoid stale sockets/tokens
    last_reconnect_time = time.ticks_ms()
    RECONNECT_INTERVAL = 45 * 60 * 1000 

    while True:
        try:
            if wdt: wdt.feed()
            print("[STREAM] Opening connection to Firebase...")
            
            if not ID_TOKEN:
                 ID_TOKEN = get_id_token()
                 if not ID_TOKEN:
                     print("[STREAM] Auth failed. Waiting 30s before retry...")
                     # Feed watchdog during wait
                     for _ in range(30):
                         if wdt: wdt.feed()
                         time.sleep(1)
                     continue

            url = f"{base_url}?auth={ID_TOKEN}"
            
            # Feed watchdog BEFORE slow SSL/Network request
            if wdt: wdt.feed()
            
            # Use stream=True to keep connection open
            # This call can be slow due to SSL handshake
            resp = urequests.get(url, headers=headers, stream=True)
            
            # Feed watchdog immediately AFTER connection
            if wdt: wdt.feed()
            
            if resp.status_code == 401:
                print("[STREAM] Token expired on connect. Refreshing...")
                resp.close()
                if wdt: wdt.feed()
                ID_TOKEN = get_id_token()
                if wdt: wdt.feed()
                time.sleep(1)
                continue
            
            if resp.status_code == 200:
                print("[STREAM] Ready. Listening for switch changes...")
                
                if hasattr(resp.raw, 'settimeout'):
                    resp.raw.settimeout(2.0) # 2.0 seconds timeout
                
                stream_counter = 0
                while True:
                    # Feed Watchdog in the inner loop
                    if wdt: wdt.feed()

                    line = None
                    try:
                        line = resp.raw.readline()
                    except OSError:
                        # Timeout (normal behavior)
                        pass
                    except Exception as e:
                        print(f"[STREAM] Read Error: {e}")
                        break

                    current_time = time.ticks_ms()

                    # 1. Check Heartbeat
                    if time.ticks_diff(current_time, last_heartbeat_time) > HEARTBEAT_INTERVAL:
                        heartbeat()
                        last_heartbeat_time = time.ticks_ms()
                    
                    # 2. Check Forced Reconnect (Prevent stale connection)
                    if time.ticks_diff(current_time, last_reconnect_time) > RECONNECT_INTERVAL:
                        print("[STREAM] Scheduled reconnection (45m). Restarting stream...")
                        break # Breaks inner loop, triggers outer loop to reconnect

                    # If we got data
                    if line:
                        decoded = line.decode('utf-8').strip()
                        
                        if decoded.startswith("data:"):
                            json_str = decoded[5:].strip()
                            if json_str == "null": continue
                            
                            try:
                                event_data = ujson.loads(json_str)
                                path = event_data.get("path", "/")
                                data = event_data.get("data")
                                
                                if data:
                                    if path == "/":
                                        if isinstance(data, dict):
                                            for key, body in data.items():
                                                if isinstance(body, dict) and "target" in body:
                                                    execute_single_command(key, body)
                                    else:
                                        cmd_id = path.strip("/")
                                        if isinstance(data, dict) and "target" in data:
                                            execute_single_command(cmd_id, data)
                            except Exception as e:
                                print("[STREAM] Parse error:", e)
                    
                    elif line is not None and len(line) == 0:
                        print("[STREAM] Server closed connection.")
                        break

                    stream_counter += 1
                    if stream_counter % 50 == 0:
                        gc.collect()

            resp.close()
            # If we broke out normally (reconnect), update timestamp
            last_reconnect_time = time.ticks_ms()
            
        except Exception as e:
            print(f"[STREAM] Disconnected ({e}). Retrying in 10s...")
            # Sleep in small chunks to keep feeding watchdog
            for _ in range(10):
                if wdt: wdt.feed()
                time.sleep(1)

# ====== Main Execution ======

def main():
    global wdt
    print("========================================")
    print("   GharSwitch IoT - Listening Mode      ")
    print("========================================")
    
    # 0. Sync Time (Critical for 'lastSeen' timestamp)
    # Note: We do this BEFORE enabling WDT because NTP can timeout/block
    sync_time()

    # Authenticate (Blocking)
    global ID_TOKEN
    ID_TOKEN = get_id_token()
    
    # 1. Initial Sync
    fetch_state()
    
    # 2. Initial Heartbeat
    heartbeat()
    
    # Enable Watchdog Timer (30 seconds timeout)
    # 8s was too short for slow SSL handshakes on Pico 2
    try:
        wdt = machine.WDT(timeout=30000)
        print("[SYSTEM] Watchdog enabled (30s).")
    except Exception as e:
        print(f"[SYSTEM] Could not enable Watchdog: {e}")
    
    # 3. Enter infinite listen loop
    listen_for_commands()

if __name__ == "__main__":
    main()
