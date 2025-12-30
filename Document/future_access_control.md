# Deliverable 8: Future Access Control Strategy (Switch-Level)

## Current MVP State
*   **Granularity**: Device Level.
*   **Rule**: If a user is in `deviceUsers` for `dev_123`, they can control **ALL** switches on that device.
*   **Schema Support**: The schema `deviceUsers` ALREADY has the field `allowedSwitches: number[]`, but it is currently ignored (or treated as "allow all").

## Future Implementation Plan

To enable granular control (e.g., "User A can only control Light 1, not the Fan"), we will update the system in three layers.

### 1. Database Layer (Already Ready)
The schema is already present.
```typescript
// deviceUsers/dev_123_user_456
{
  deviceId: "dev_123",
  userId: "user_456",
  allowedSwitches: [0, 2] // Only Switch 1 and 3
}
```

### 2. Cloud Function Layer (The Enforcement Update)
We will modify `executeSwitchCommand`.

**Current Logic:**
```typescript
if (!userDeviceSnap.exists) throw Error('Access Denied');
```

**Future Logic:**
```typescript
if (!userDeviceSnap.exists) throw Error('Access Denied');
const permissions = userDeviceSnap.data();

// NEW CHECK
if (permissions.allowedSwitches && permissions.allowedSwitches.length > 0) {
   if (!permissions.allowedSwitches.includes(command.switchIndex)) {
       throw new HttpsError('permission-denied', 'You do not have access to this specific switch');
   }
}
```

### 3. Frontend Layer (UI Update)
The Frontend needs to respect these permissions visually.

*   **Fetch**: When loading the Device Dashboard, fetch `deviceUsers` for the current user.
*   **Render**:
    *   If `allowedSwitches` is empty/null -> Render ALL switches enabled.
    *   If `allowedSwitches` has values -> Render `0` and `2` enabled; Render `1` and `3` as disabled/locked or hidden.
*   **Security**: Remember, even if the Frontend attempts to "hack" the UI to enable the button, the **Cloud Function (Layer 2)** will reject the API call.

## Why this is Safe
This approach follows the **Zero-Trust** model. We do not rely on the frontend to hide the buttons. We rely on the Cloud Function to check the `allowedSwitches` array before writing to RTDB.

## Migration Path
1.  **Phase 1 (MVP)**: `allowedSwitches` is optional/null. Logic assumes "Access to Device = Access to All".
2.  **Phase 2 (Hybrid)**: Admins can update `allowedSwitches`. Cloud Function logic is updated to check it *if present*.
3.  **Phase 3 (Strict)**: UI updated to reflect partial access.
