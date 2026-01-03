import firebase_admin
from firebase_admin import credentials, db
import time
import os
import sys
import signal
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DEVICE_ID = os.getenv("DEVICE_ID")
TENANT_ID = os.getenv("TENANT_ID")
DATABASE_URL = os.getenv("DATABASE_URL", "https://gharswitch-default-rtdb.asia-southeast1.firebasedatabase.app")

if not DEVICE_ID or not TENANT_ID:
    print("ERROR: DEVICE_ID and TENANT_ID must be set in .env file")
    sys.exit(1)

cred_path = os.path.join(os.path.dirname(__file__), "service-account.json")
if not os.path.exists(cred_path):
    print(f"ERROR: service-account.json not found at {cred_path}")
    sys.exit(1)

cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})

# Local cache
device_state = {"s1": False, "s2": False, "s3": False, "s4": False}

def print_status():
    status_str = " | ".join([f"{k}: {'ON' if v else 'OFF'}" for k, v in device_state.items()])
    print(f"[STATUS] {status_str}")

def handle_state_update(new_state: dict):
    """Update local cache and print unified status"""
    global device_state
    for k, v in new_state.items():
        if k in device_state:
            device_state[k] = v
    print("\n[DEVICE] Switch state updated:")
    print_status()

def on_command(event):
    """Consume commands and update state"""
    if event.data is None:
        return

    if isinstance(event.data, dict) and "target" in event.data:
        cmd_id = event.path.strip("/")
        commands = {cmd_id: event.data}
    elif isinstance(event.data, dict):
        commands = event.data
    else:
        return

    for cmd_id, payload in commands.items():
        if not payload or not isinstance(payload, dict):
            continue
        target = payload.get("target")
        action = payload.get("action")
        if not target or target not in device_state:
            continue

        print(f"\n[DEVICE] Received Command {cmd_id}: {target} -> {'ON' if action else 'OFF'}")
        print(f"*CLICK* Relay {target}")

        # Update local + remote state
        handle_state_update({target: action})
        state_ref = db.reference(f"tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches")
        state_ref.update({target: action})

        # Acknowledge
        db.reference(f"tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending/{cmd_id}").delete()
        print(f"[DEVICE] Command acknowledged.")

def on_state_change(event):
    """Listen for external state changes (e.g. super_admin override)"""
    if event.data is None:
        return
    if isinstance(event.data, dict):
        handle_state_update(event.data)
    else:
        key = event.path.strip("/")
        if key in device_state:
            handle_state_update({key: event.data})

def set_offline(signum=None, frame=None):
    print("\n[DEVICE] Shutting down... marking offline.")
    try:
        presence_ref = db.reference(f"tenants/{TENANT_ID}/presence/{DEVICE_ID}")
        presence_ref.set({"online": False, "lastSeen": {".sv": "timestamp"}})
    except Exception as e:
        print(f"Error marking offline: {e}")
    sys.exit(0)

def main():
    print("========================================")
    print("   GharSwitch IoT Simulator (Python)    ")
    print("========================================")
    print(f"Device ID: {DEVICE_ID}")
    print(f"Tenant ID: {TENANT_ID}")

    signal.signal(signal.SIGINT, set_offline)
    signal.signal(signal.SIGTERM, set_offline)

    # Presence
    presence_ref = db.reference(f"tenants/{TENANT_ID}/presence/{DEVICE_ID}")
    presence_ref.set({"online": True, "lastSeen": {".sv": "timestamp"}})

    # Initialize state
    state_ref = db.reference(f"tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches")
    current_db_state = state_ref.get()
    if not isinstance(current_db_state, dict):
        print("[DEVICE] Initializing default switch states (All OFF)...")
        state_ref.set(device_state)
    else:
        handle_state_update(current_db_state)

    # Listeners
    print("[DEVICE] Listening for commands and state changes...")
    db.reference(f"tenants/{TENANT_ID}/device_commands/{DEVICE_ID}/pending").listen(on_command)
    db.reference(f"tenants/{TENANT_ID}/device_states/{DEVICE_ID}/switches").listen(on_state_change)

    # Heartbeat
    try:
        while True:
            presence_ref.update({"lastSeen": {".sv": "timestamp"}})
            time.sleep(30)
    except Exception as e:
        print(f"Heartbeat Error: {e}")
        set_offline()

if __name__ == "__main__":
    main()
