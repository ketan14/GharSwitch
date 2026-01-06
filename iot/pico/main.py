import gc
import ujson
import urequests
import time
from machine import Pin
import config

# ====== Firebase RTDB Setup ======
DATABASE_URL = config.DB_URL
TENANT_ID = config.TENANT_ID
DEVICE_ID = config.DEVICE_ID

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
    url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches.json"
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
    url = f"{DATABASE_URL}/tenants/{TENANT_ID}/presence/{DEVICE_ID}.json"
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
    url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending.json"
    headers = {"Accept": "text/event-stream"}
    
    last_heartbeat_time = time.ticks_ms()
    # Update presence every 2 minutes (120000 ms) to save bandwidth
    HEARTBEAT_INTERVAL = 120000 

    while True:
        try:
            print("[STREAM] Opening connection to Firebase...")
            # Use stream=True to handle the infinite data flow
            resp = urequests.get(url, headers=headers, stream=True)
            
            if resp.status_code == 200:
                print("[STREAM] Ready. Listening for switch changes...")
                
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
                        # event_data contains 'path' and 'data'
                        cmds = event_data.get("data")
                        
                        if cmds:
                            # If it's a dictionary of commands, process them
                            if isinstance(cmds, dict):
                                if "target" in cmds: # Single command
                                    execute_single_command("stream_cmd", cmds)
                                else: # Multiple commands
                                    for c_id, c_body in cmds.items():
                                        execute_single_command(c_id, c_body)

                    # Periodically send heartbeat without closing the stream
                    if time.ticks_diff(time.ticks_ms(), last_heartbeat_time) > HEARTBEAT_INTERVAL:
                        heartbeat()
                        last_heartbeat_time = time.ticks_ms()

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
        state_url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches.json"
        try:
            urequests.patch(state_url, data=ujson.dumps({target: action})).close()
            
            # 2. Delete/Acknowledge the pending command
            ack_url = f"{DATABASE_URL}/tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending/{cmd_id}.json"
            urequests.delete(ack_url).close()
            print(f"[OK] Command {cmd_id} cleared.")
        except:
            print("[ERR] Failed to acknowledge command.")

# ====== Main Execution ======

def main():
    print("========================================")
    print("   GharSwitch IoT - Listening Mode      ")
    print("========================================")
    
    # 1. Initial Sync
    fetch_state()
    
    # 2. Initial Heartbeat
    heartbeat()
    
    # 3. Enter infinite listen loop
    listen_for_commands()

if __name__ == "__main__":
    main()
