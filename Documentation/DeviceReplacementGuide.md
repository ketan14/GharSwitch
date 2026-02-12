# Admin Guide: Replacing a Damaged Device

## Overview
GharSwitch uses **Hardware Locking** (MAC Address Binding) to secure devices. This means a Device ID is permanently linked to the first physical hardware board that connects to it.

If a device is damaged and you replace the hardware (e.g., flash a new Pico with the *same* `config.py`), it will fail to connect because the Cloud expects the *old* hardware's MAC address.

## Symptoms of a Locked Device
- The new device blinks its error LED.
- Serial logs show: `401 Hardware Mismatch` or `Duplicate Device ID detected`.
- Connectivity Status in Dashboard remains `OFFLINE`.

## How to Replace a Device

### Step 1: Physical Replacement
1.  Flash the new hardware with the firmware.
2.  Ensure `config.py` has the **same** `DEVICE_ID` and `DEVICE_SECRET` as the broken unit.
3.  Power on the new device. **It will fail to connect** (this is normal security behavior).

### Step 2: Reset the Hardware Lock
As an Admin, you must clear the old MAC address from the system to allow the new board to take over.

**Method A: Using Firebase Console (Cloud Functions)**
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Navigate to **Functions**.
3.  Find the `resetDeviceHardware` function.
4.  Navigate to the **Testing** or **Usage** tab (depending on interface version) or use a custom admin tool.
    *   *Note: If no UI exists yet, developers can invoke this via the Firebase CLI or Postman.*

**Method B: Using Admin Shell / CLI**
Run the reset command (if configured in your admin tools):
```bash
# Example call via Firebase CLI (Developer)
firebase functions:call resetDeviceHardware --data '{"deviceId": "YOUR_DEVICE_ID"}'
```

### Step 3: Auto-Binding
1.  Once the reset is successful, restart the new device (unplug/replug).
2.  The device will connect to the cloud.
3.  The Cloud will see there is no MAC address stored (because you just reset it).
4.  The Cloud will **automatically lock** to the NEW device's MAC address.
5.  Device is now Online and Secure.
