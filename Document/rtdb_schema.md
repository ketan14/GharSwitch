# Deliverable 4: Realtime Database (RTDB) Schema

## Addressing the "Multiple Switches" Question
> *User Question: "As devices have multiple switches (4, 8)... How to manage Realtime DB with reference of this?"*

**Answer**: RTDB is valid "dumb storage". It does not enforce the channel count (4 vs 8).
*   **Firestore (`DeviceType`)** says: "This device has 4 channels."
*   **RTDB** simply has slots: `[false, true, false, false]`.
*   **The Bridge**: When a command comes in, the **Cloud Function** checks Firestore: *"Is Switch #5 valid for this device?"*
    *   If **No** (Device is 4ch), the function **REJECTS** the command. The RTDB never sees "Switch 5".
    *   If **Yes**, the function writes to RTDB.

---

## RTDB Root Structure
The database is flat and separated by responsibility.

```json
{
  "device_states": { ... },   // READ ONLY for Frontend
  "device_commands": { ... }, // WRITE ONLY for Backend
  "device_status": { ... }    // PRESENCE (Online/Offline)
}
```

### 1. `device_states/{deviceId}`
**Role**: The current physical state of the relays.
**Write Access**: **DEVICE ONLY** (and Cloud Admin for sync).
**Read Access**: Frontend (visualize state).

We use a **Map** (Dictionary) keyed by index string for safety, rather than an array (arrays in Firebase are tricky with sparse updates).

```json
{
  "device_states": {
    "dev_ESP32_A1B2": {
      // Keys are the Switch Index (from Firestore Switch ID)
      "0": { "on": true, "updatedAt": 1698765432100 },
      "1": { "on": false, "updatedAt": 1698765432100 },
      "2": { "on": false, "updatedAt": 1698765432100 },
      "3": { "on": true, "updatedAt": 1698765432100 }
    }
  }
}
```

### 2. `device_commands/{deviceId}`
**Role**: The queue of actions the device needs to take.
**Write Access**: **CLOUD FUNCTION ONLY**. (Frontend calls API -> Function -> writes here).
**Read Access**: Device (listens for work).

**Command Flow**:
1. Function generates a unique `cmdId`.
2. Device executes.
3. Device deletes the command (ACK).

```json
{
  "device_commands": {
    "dev_ESP32_A1B2": {
      "cmd_889900": {
        "switchIndex": 0,
        "action": "ON",      // "ON" | "OFF" | "TOGGLE"
        "issuedBy": "user_123",
        "timestamp": 1698765435000
      }
    }
  }
}
```

### 3. `device_status/{deviceId}`
**Role**: Presence system.
**Write Access**: Device (via `onDisconnect` handler).

```json
{
  "device_status": {
    "dev_ESP32_A1B2": {
      "state": "online",     // "online" | "offline"
      "lastSeen": 1698765440000,
      "ip": "192.168.1.105"
    }
  }
}
```

## How It Fits Together (The "4 vs 8" Logic)

1.  **Frontend**: User toggles Switch #5.
2.  **API**: Sends `{ deviceId: "...", switchIndex: 5, state: true }`.
3.  **Cloud Function**:
    *   Reads Firestore `devices/dev_...`.
    *   Reads `deviceTypes/standard_8ch`.
    *   **Check**: Is `5 < 8`? **YES**.
    *   **Check**: Does `deviceUsers` allow User to touch #5? **YES**.
4.  **Action**: Function writes to `device_commands/dev.../cmd_... { switchIndex: 5, action: "ON" }`.
5.  **RTDB**: Successfully receives write.
6.  **Device**: Receives event `switchIndex: 5`. Toggles GPIO. Writes `device_states/dev.../5 { on: true }`.

If this was a **4-channel device**:
*   **Cloud Function Step 3**: Is `5 < 4`? **NO**.
*   **Result**: Function throws `400 Bad Request`. **RTDB never gets touched.**

This ensures the "dumb" RTDB never holds invalid state.
