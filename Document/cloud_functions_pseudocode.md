# Deliverable 5: Cloud Function Pseudocode

## 1. `createTenant`
**Trigger**: HTTP Request (Super Admin Only)
**Purpose**: Onboard a new customer and set up strict isolation boundaries.

```typescript
async function createTenant(data: CreateTenantRequest, context: AuthContext) {
  // 1. Security: Only Super Admin can create tenants
  if (!context.auth.token.super_admin) throw new HttpsError('permission-denied');

  const { tenantName, adminEmail, planId, password } = data;
  const planDetails = PLAN_LIMITS[planId]; // e.g. { maxDevices: 10, maxSwitches: 4 }

  const db = admin.firestore();

  // 2. Transaction: Atomic creation of Tenant + Admin User
  await db.runTransaction(async (t) => {
    // A. Create Tenant Doc
    const tenantRef = db.collection('tenants').doc();
    t.set(tenantRef, {
      name: tenantName,
      planId: planId,
      maxDevices: planDetails.maxDevices,
      subscriptionStatus: 'active',
      createdAt: FieldValue.serverTimestamp()
    });

    // B. Create Admin User in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: adminEmail,
      password: password,
      displayName: "Tenant Admin"
    });

    // C. Set Custom Claims (THE KEY TO SECURITY)
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      tenantId: tenantRef.id  // <--- This stamps every future request
    });

    // D. Create User Profile Metadata in Firestore
    const userProfileRef = db.collection('users').doc(userRecord.uid);
    t.set(userProfileRef, {
      email: adminEmail,
      role: 'admin',
      tenantId: tenantRef.id,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { success: true, tenantId: tenantRef.id };
}
```

## 2. `addSwitchToDevice` (Provisioning)
**Trigger**: Firestore `onCreate` trigger on `devices/{deviceId}` OR Admin API
**Purpose**: Enforce hardware capabilities in the database. If a "4-channel" device is created, we MUST generate 4 logical switch records.

```typescript
async function onDeviceCreated(snap: DocumentSnapshot, context: EventContext) {
  const deviceData = snap.data();
  const db = admin.firestore();

  // 1. Fetch Capability Definition
  // We trust the 'typeId' because only Admins can write to 'devices'
  const deviceTypeSnap = await db.collection('deviceTypes').doc(deviceData.typeId).get();
  const deviceType = deviceTypeSnap.data(); // e.g. { channelCount: 4, ... }

  const batch = db.batch();

  // 2. Generate Logical Switches
  for (let i = 0; i < deviceType.channelCount; i++) {
    const switchRef = snap.ref.collection('switches').doc(String(i)); // ID "0", "1"...
    batch.set(switchRef, {
      index: i,
      deviceId: snap.id,
      tenantId: deviceData.tenantId, // Inherit Tenant ID for queries
      displayName: `Switch ${i + 1}`,
      type: 'toggle', // Default
      createdAt: FieldValue.serverTimestamp()
    });
  }

  // 3. Commit
  await batch.commit();
}
```

## 3. `executeSwitchCommand` (The Guard Dog)
**Trigger**: HTTP Callable
**Purpose**: The single entry point for controlling hardware.

```typescript
async function executeSwitchCommand(data: CommandRequest, context: AuthContext) {
  // 1. AUTHENTICATION
  if (!context.auth) throw new HttpsError('unauthenticated');
  const { uid, token } = context.auth;
  const { deviceId, switchIndex, action } = data; // action: "ON" | "OFF"

  const db = admin.firestore();
  const rtdb = admin.database();

  // 2. LOAD DATA (Parallel for speed)
  const [deviceSnap, userDeviceSnap, usageSnap] = await Promise.all([
    db.collection('devices').doc(deviceId).get(),
    db.collection('deviceUsers').doc(`${deviceId}_${uid}`).get(),
    getCurrentDailyUsage(token.tenantId) // Helper to get or create usage doc
  ]);

  if (!deviceSnap.exists) throw new HttpsError('not-found', 'Device invalid');
  const device = deviceSnap.data();

  // 3. TENANT ISOLATION (The Ironclad Rule)
  // Even if user knows the DeviceID, if tenants don't match, DENY.
  if (device.tenantId !== token.tenantId) {
    // Log security incident
    console.error(`Security Alert: User ${uid} tried to access cross-tenant device ${deviceId}`);
    throw new HttpsError('permission-denied'); // Generic error to prevent enumeration
  }

  // 4. RBAC: Does this specific user have rights?
  if (token.role !== 'admin' && !userDeviceSnap.exists) {
     throw new HttpsError('permission-denied', 'Not assigned to this device');
  }

  // 5. QUOTA ENFORCEMENT
  if (usageSnap.data().requestCount >= usageSnap.data().limit) {
    throw new HttpsError('resource-exhausted', 'Daily limit reached. Upgrade plan.');
  }

  // 6. CAPABILITY CHECK
  // (Assuming we cached deviceType or store channelCount on device for perf)
  // If switchIndex is 5 but device is 4-channel...
  if (switchIndex >= device.channelCount) {
     throw new HttpsError('out-of-range', 'Switch index invalid for this hardware');
  }

  // 7. EXECUTION (The only write to RTDB)
  await Promise.all([
    // A. Send Command
    rtdb.ref(`device_commands/${deviceId}/${uniqueId()}`).set({
      switchIndex,
      action,
      issuedBy: uid,
      timestamp: Date.now()
    }),
    // B. Increment Usage (Optimistic or Atomic)
    usageSnap.ref.update({ requestCount: FieldValue.increment(1) })
  ]);

  return { success: true };
}
```

## Summary of enforcement
*   **Isolation**: Step 3 checks `token.tenantId === device.tenantId`.
*   **Quotas**: Step 5 checks Firestore counter.
*   **Device Limits**: Step 6 checks hardware reality.
*   **Hostility**: RTDB is only touched in Step 7, *after* all security checks pass.
