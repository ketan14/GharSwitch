import firebase_admin
from firebase_admin import credentials, db
import time
import os
import sys
import signal
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ========================================
# DEVICE CONFIGURATION
# ========================================
DEVICE_ID = os.getenv("DEVICE_ID")
TENANT_ID = os.getenv("TENANT_ID")
DATABASE_URL = os.getenv("DATABASE_URL")

if not DEVICE_ID or not TENANT_ID or not DATABASE_URL:
    print("ERROR: DEVICE_ID, TENANT_ID, and DATABASE_URL must be set in .env file")
    sys.exit(1)

# ========================================
# INITIALIZATION
# ========================================
# Path to service account key
cred_path = os.path.join(os.path.dirname(__file__), "service-account.json")

if not os.path.exists(cred_path):
    print(f"ERROR: service-account.json not found at {cred_path}")
    print("Please place your Firebase service-account.json in the same directory as this script.")
    sys.exit(1)

cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred, {
    "databaseURL": DATABASE_URL
})

# ========================================
# DEVICE STATE (Local Cache)
# ========================================
device_state = {
    "s1": False,
    "s2": False,
    "s3": False,
    "s4": False
}

def print_status():
    """
    Prints the current status of all switches in a pretty format
    """
    status_str = " | ".join([f"{k}: {'ON' if v else 'OFF'}" for k, v in device_state.items()])
    print(f"[STATUS] {status_str}")

def on_command(event):
    """
    Listens for NEW commands in tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending
    """
    global device_state
    if event.data is None:
        return

    # Handle both full object (first load) and individual children (updates)
    if isinstance(event.data, dict) and 'target' in event.data:
        # Single event update on the 'pending' node for a specific command ID
        cmd_id = event.path.strip('/')
        commands = {cmd_id: event.data}
    elif isinstance(event.data, dict):
        # Initial full list of commands
        commands = event.data
    else:
        return

    for cmd_id, payload in commands.items():
        if not payload or not isinstance(payload, dict): continue
        
        target = payload.get('target')
        action = payload.get('action')
        
        if not target or target not in device_state: continue
        
        print(f"\n[DEVICE] Received Command {cmd_id}: {target} -> {'ON' if action else 'OFF'}")
        
        # 1. SIMULATE HARDWARE ACTION
        print(f"*CLICK* Relay {target}")
        
        # 2. UPDATE LOCAL AND REMOTE STATE
        device_state[target] = action
        state_ref = db.reference(f"tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches")
        state_ref.update({target: action})
        
        # 3. PRINT UPDATED STATUS
        print_status()

        # 4. ACKNOWLEDGEMENT (Cleanup)
        # Delete from pending queue
        db.reference(f"tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending/{cmd_id}").delete()
        print(f"[DEVICE] Command acknowledged.")

def set_offline(signum=None, frame=None):
    """
    Called on exit to mark device as offline
    """
    print(f"\n[DEVICE] Shutting down... marking offline.")
    try:
        presence_ref = db.reference(f"tenants/{TENANT_ID}/presence/{DEVICE_ID}")
        presence_ref.set({
            "online": False,
            "lastSeen": {".sv": "timestamp"}
        })
    except Exception as e:
        print(f"Error marking offline: {e}")
    sys.exit(0)

def main():
    print(f"========================================")
    print(f"   GharSwitch IoT Simulator (Python)    ")
    print(f"========================================")
    print(f"Device ID: {DEVICE_ID}")
    print(f"Tenant ID: {TENANT_ID}")
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, set_offline)
    signal.signal(signal.SIGTERM, set_offline)

    # 1. Initial Presence
    presence_ref = db.reference(f"tenants/{TENANT_ID}/presence/{DEVICE_ID}")
    print(f"[DEVICE] Setting presence for {DEVICE_ID}...")
    presence_ref.set({
        "online": True,
        "lastSeen": {".sv": "timestamp"}
    })

    # 2. Initialize Switch States
    # This ensures s1-s4 appear in the database immediately
    global device_state
    state_ref = db.reference(f"tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches")
    current_db_state = state_ref.get()
    
    if current_db_state is None or not isinstance(current_db_state, dict):
        print(f"[DEVICE] Initializing default switch states (All OFF)...")
        state_ref.set(device_state)
    else:
        print(f"[DEVICE] Device state loaded from cloud.")
        # sync local cache with cloud
        for k, v in current_db_state.items():
            if k in device_state:
                device_state[k] = v
    
    # Print the starting status
    print_status()
    
    # 3. Listen for commands
    print(f"[DEVICE] Listening for commands...")
    db.reference(f"tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending").listen(on_command)
    
    # 4. Heartbeat loop
    print(f"[DEVICE] Simulator running. Press Ctrl+C to stop.")
    try:
        while True:
            # Refresh presence every 30 seconds to stay ONLINE
            # Note: In production, syncPresence Cloud Function might rely on this
            presence_ref.update({
                "lastSeen": {".sv": "timestamp"}
            })
            time.sleep(30)
    except Exception as e:
        print(f"Heartbeat Error: {e}")
        set_offline()

if __name__ == "__main__":
    main()
