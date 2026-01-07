import gc
import ujson
import urequests
import time
from machine import Pin
import config
import machine

# Overclock to 240MHz for faster SSL/JSON processing
machine.freq(240000000)

# ====== Firebase RTDB Setup ======
DATABASE_URL = config.DB_URL
TENANT_ID = config.TENANT_ID
DEVICE_ID = config.DEVICE_ID

# ====== Auth Globals ======
ID_TOKEN = None

def get_id_token():
    """Exchanges Device Secret for ID Token via Cloud Function + Identity Toolkit"""
    print("[AUTH] Authenticating...")
    try:
        # Step 1: Get Custom Token from your Cloud Function
        # Note: You must add AUTH_URL, DEVICE_SECRET, API_KEY to config.py
        payload = ujson.dumps({"deviceId": DEVICE_ID, "deviceSecret": config.DEVICE_SECRET})
        r = urequests.post(config.AUTH_URL, data=payload, headers={'Content-Type': 'application/json'})
        
        if r.status_code != 200:
            print(f"[AUTH] Failed to get custom token: {r.status_code} {r.text}")
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
    if not ID_TOKEN: return
    url = f"{DATABASE_URL}/tenants/{TENANT_ID}/presence/{DEVICE_ID}.json?auth={ID_TOKEN}"
    payload = {"online": True, "lastSeen": int(time.time() * 1000)}
    try:
        r = urequests.put(url, data=ujson.dumps(payload))
        r.close()
        print("[HEARTBEAT] Presence updated.")
    except Exception as e:
        print("[HEARTBEAT] Error:", e)

# ====== The Listener Logic ======

def listen_for_commands():
    """Persistent stream to replace the 5-second polling"""
    global ID_TOKEN
    base_url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending.json"
    headers = {"Accept": "text/event-stream"}
    
    last_heartbeat_time = time.ticks_ms()
    # Update presence every 10 minutes (600000 ms) to save bandwidth
    HEARTBEAT_INTERVAL = 600000 

    while True:
        try:
            print("[STREAM] Opening connection to Firebase...")
            # Append Auth Token
            url = f"{base_url}?auth={ID_TOKEN}"
            
            # Use stream=True to handle the infinite data flow
            resp = urequests.get(url, headers=headers, stream=True)
            
            if resp.status_code == 401:
                print("[STREAM] Token expired. Refreshing...")
                resp.close()
                ID_TOKEN = get_id_token()
                continue
            
            if resp.status_code == 200:
                print("[STREAM] Ready. Listening for switch changes...")
                
                stream_counter = 0
                while True:
                    # Read one line at a time from the stream
                    line = resp.raw.readline()
                    if not line:
                        break # Connection dropped, will jump to except block
                    
                    decoded = line.decode('utf-8').strip()
                    
                    # Firebase sends updates in 'data: {...}' format
                    if decoded.startswith("data:"):
                        json_str = decoded[5:].strip()
                        if json_str == "null": continue
                        
                        event_data = ujson.loads(json_str)
                        path = event_data.get("path", "/")
                        data = event_data.get("data")
                        
                        if data:
                            # Case 1: Path is root "/", data is dictionary of commands
                            if path == "/":
                                if isinstance(data, dict):
                                    for key, body in data.items():
                                        if isinstance(body, dict) and "target" in body:
                                            execute_single_command(key, body)
                            
                            # Case 2: Path is specific "/<cmd_id>"
                            else:
                                cmd_id = path.strip("/")
                                if isinstance(data, dict) and "target" in data:
                                    execute_single_command(cmd_id, data)

                    # Periodically send heartbeat without closing the stream
                    if time.ticks_diff(time.ticks_ms(), last_heartbeat_time) > HEARTBEAT_INTERVAL:
                        heartbeat()
                        last_heartbeat_time = time.ticks_ms()

                    
                    # Periodic GC (every 50 loops) to prevent OOM without killing performance
                    stream_counter += 1
                    if stream_counter % 50 == 0:
                        gc.collect()
            resp.close()
        except Exception as e:
            print(f"[STREAM] Disconnected ({e}). Retrying in 10s...")
            time.sleep(10)

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
        except:
            print("[ERR] Failed to acknowledge command.")

# ====== Main Execution ======

def main():
    print("========================================")
    print("   GharSwitch IoT - Listening Mode      ")
    print("========================================")
    
    # Authenticate (Blocking)
    global ID_TOKEN
    ID_TOKEN = get_id_token()
    
    # 1. Initial Sync
    fetch_state()
    
    # 2. Initial Heartbeat
    heartbeat()
    
    # 3. Enter infinite listen loop
    listen_for_commands()

if __name__ == "__main__":
    main()
