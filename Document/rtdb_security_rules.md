# Deliverable 7: Realtime Database Security Rules

## Core Logic

RTDB Rules must cover two main vectors:
1.  **Frontend Clients** (Users): Can READ `device_states` (if they belong to the tenant) but cannot WRITE anything.
2.  **IoT Devices**: Can READ `device_commands` (for themselves only) and WRITE `device_states` (their own only).
3.  **Cloud Functions**: Bypass these rules (Admin SDK), so no specific rules needed for them.

## The Rules (`rtdb.rules.json`)

```json
{
  "rules": {
    /* 
       HELPER: Check if user belongs to the tenant stamped on the data.
       Requirements:
       1. Data MUST have a 'tenantId' child.
       2. User MUST have a 'tenantId' Custom Claim.
    */
    ".read": false,
    ".write": false,

    "device_states": {
      "$deviceId": {
        // READ:
        // 1. Super Admin
        // 2. Tenant Member (User's tenantId == Device's tenantId)
        ".read": "auth.token.role === 'super_admin' || auth.token.tenantId === data.child('tenantId').val()",
        
        // WRITE:
        // 1. The Device itself (auth.uid matches deviceId)
        // NOTE: Cloud Functions don't need this, they are admin.
        ".write": "auth.uid === $deviceId",
        
        // Validation: Schema check for device updates
        // Device can only write if it preserves the tenantId (cannot hijack ownership)
        ".validate": "newData.child('tenantId').val() === data.child('tenantId').val()"
      }
    },

    "device_commands": {
      "$deviceId": {
        // READ:
        // Only the Device itself can read its commands.
        // Frontend does NOT need to read commands (it just sends them via API).
        ".read": "auth.uid === $deviceId",
        
        // WRITE:
        // NO ONE. 
        // Frontend calls Cloud Function -> Admin SDK writes.
        // Device doesn't write commands.
        ".write": false
      }
    },

    "device_status": {
      "$deviceId": {
        // READ:
        // Same as states: Tenant members need to know if device is online.
        ".read": "auth.token.role === 'super_admin' || auth.token.tenantId === data.child('tenantId').val()",
        
        // WRITE:
        // The Device itself can update its presence (lastSeen, ip).
        ".write": "auth.uid === $deviceId",
        
        // Validation: Must preserve tenantId
        ".validate": "newData.child('tenantId').val() === data.child('tenantId').val()"
      }
    }
  }
}
```

## Critical Implementation Note: `tenantId` in RTDB

For the `.read` rules to work, the **Data** in RTDB must actually contain the `tenantId`.

**Implication for Cloud Functions (`createTenant` / `addSwitchToDevice`):**
When a new Device is provisioned or when sync occurs, the Cloud Function **MUST** write the `tenantId` to the RTDB `device_states` and `device_status` nodes initially.

Example initial state:
```json
"device_states": {
  "dev_123": {
    "tenantId": "tnt_ABC",  // <--- REQUIRED FOR SECURITY RULES
    "0": { "on": false },
    "1": { "on": true }
  }
}
```

If `tenantId` is missing from RTDB, **NO USER** (except Super Admin) will be able to read the state. This is a secure "Fail Closed" design.
