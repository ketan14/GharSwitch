import firebase_admin
from firebase_admin import credentials, db
import time
import os
import json

# MOCK DEVICE CONFIG
DEVICE_ID = "dev_ESP32_MOCK_1"
TENANT_ID = "tnt_MOCK_A"

# 1. AUTH
# In prod, device uses C++ SDK with Custom Auth token.
# Here we simulate with Admin SDK but restrict ourselves logically.
cred = credentials.Certificate("service-account.json") 
app = firebase_admin.initialize_app(cred, {
    "databaseURL": "https://ghar-switch-pro-dev.firebaseio.com"
})

def on_command(event):
    """
    Listens for NEW commands in device_commands/{DEVICE_ID}
    """
    if event.event_type == 'put' and event.data:
        cmd_id = os.path.basename(event.path)
        payload = event.data
        
        print(f"[DEVICE] Received Command: {payload}")
        
        # 2. EXECUTE HARDWARE LOGIC
        # (Click relay...)
        switch_index = payload.get('switchIndex')
        action = payload.get('action')
        
        simulate_hardware_toggle(switch_index, action)
        
        # 3. ACK TO STATE
        # Device writes to device_states/{DEVICE_ID}/{switch_index}
        # Note: We include tenantId to satisfy Security Rules (Validation)
        new_state = {
            "on": action == "ON" or (action == "TOGGLE"), # Simplification
            "updatedAt": int(time.time() * 1000),
            "tenantId": TENANT_ID
        }
        
        print(f"[DEVICE] Updating State: {new_state}")
        db.reference(f"device_states/{DEVICE_ID}/{switch_index}").set(new_state)
        
        # 4. CLEANUP
        # Delete the command processed? Or let TTL handle it?
        # Typically device deletes command to ACK.
        db.reference(f"device_commands/{DEVICE_ID}/{cmd_id}").delete()

def simulate_hardware_toggle(index, action):
    print(f"*CLICK* Relay {index} -> {action}")

def main():
    print(f"Starting Simulator for {DEVICE_ID}...")
    
    # Listen
    command_ref = db.reference(f"device_commands/{DEVICE_ID}")
    command_ref.listen(on_command)
    
    # Heartbeat
    while True:
        try:
            db.reference(f"device_status/{DEVICE_ID}").set({
                "state": "online",
                "last_seen": int(time.time() * 1000),
                "tenantId": TENANT_ID
            })
            time.sleep(60)
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    main()
