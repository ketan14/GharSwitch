# Check Device Status Script

This script (`tools/check-device-status.ts`) allows developers to quickly inspect the connection status of all devices registered in the Firebase Realtime Database.

## Prerequisites

1.  **Node.js**: Ensure Node.js is installed.
2.  **Service Account**: You must have `service-account.json` in the `tools/` directory.
    - If missing, download it from verify project settings -> Service Accounts in Firebase Console.
3.  **Environment Variables**: The script reads `.env` from the project root. Ensure `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is set.

## Usage

Run the script from the `tools` directory:

```bash
cd tools
npx ts-node check-device-status.ts
```

Or from the root directory:

```bash
npx ts-node tools/check-device-status.ts
```

## Output Explanation

The script connects to the Realtime Database and scans the `tenants/{TENANT_ID}/presence` path.

- **Status**: `ONLINE` (true) or `OFFLINE` (false).
- **Last Seen**: The timestamp when the device last updated its presence.

Example Output:
```
------ Device Status Report ------

Tenant: tenant-123
  - Device: pico_w_001
    Status: ONLINE
    Last Seen: 2/13/2026, 7:00:00 PM (1770989400000)

----------------------------------
```

## Manual Verification (Firebase Console)

If you prefer to check manually:

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your project.
3.  Navigate to **Build** > **Realtime Database**.
4.  Expand the data tree: `tenants` > `{YOUR_TENANT_ID}` > `presence`.
5.  Each child node represents a Device ID. Expand it to see:
    - `online`: `true` means the device is currently connected.
    - `lastSeen`: A timestamp (updates frequently).
