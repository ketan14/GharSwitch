import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// ========================================
// TYPE DEFINITIONS (Inline)
// ========================================

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';
export type SwitchTarget = 's1' | 's2' | 's3' | 's4';

export interface SendCommandRequest {
    deviceId: string;
    action: boolean;
    target: SwitchTarget;
}

export interface SendCommandResponse {
    success: boolean;
    commandId: string;
}

export interface RegisterDeviceRequest {
    deviceId: string;
    claimCode: string;
}

export interface RegisterDeviceResponse {
    success: boolean;
    device: any;
}

export interface DeviceCommand {
    action: boolean;
    target: SwitchTarget;
    timestamp: number;
}

export interface GlobalDevice {
    serialNumber: string;
    model: string;
    secretHash: string;
    claimedBy: string | null;
}

export interface Tenant {
    name: string;
    tier: string;
    quota: {
        maxDevices: number;
        maxUsers: number;
    };
}

export interface Device {
    name: string;
    type: string;
    metadata: any;
    config: any;
    status?: string;
    registeredAt: Date;
}

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

// ========================================
// HELPER: Generate Unique ID
// ========================================
function generateUniqueId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ========================================
// 1. SEND COMMAND (Callable)
// ========================================
export const sendCommand = functions.https.onCall(
    async (data: SendCommandRequest, context): Promise<SendCommandResponse> => {
        // 1. Authenticate Caller
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Login required');
        }

        const caller = context.auth;
        const tenantId = caller.token.tenantId as string;

        if (!tenantId) {
            throw new functions.https.HttpsError('failed-precondition', 'User has no tenant assigned');
        }

        // 2. Validate Payload
        const { deviceId, action, target } = data;
        if (!deviceId || typeof action !== 'boolean' || !target) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid payload');
        }

        // 3. Authorization (Check Role)
        const memberDoc = await db
            .collection('tenants')
            .doc(tenantId)
            .collection('members')
            .doc(caller.uid)
            .get();

        if (!memberDoc.exists) {
            throw new functions.https.HttpsError('permission-denied', 'Not a member of this tenant');
        }

        const role = memberDoc.data()?.role;
        if (role === 'VIEWER') {
            throw new functions.https.HttpsError('permission-denied', 'Viewers cannot send commands');
        }

        // 4. Verification (Device Ownership)
        const deviceDoc = await db
            .collection('tenants')
            .doc(tenantId)
            .collection('devices')
            .doc(deviceId)
            .get();

        if (!deviceDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Device not registered to this tenant');
        }

        // 5. Execution (RTDB Write)
        const cmdId = generateUniqueId();
        const command: DeviceCommand = {
            action,
            target,
            timestamp: Date.now()
        };

        await rtdb
            .ref(`tenants/${tenantId}/device_commands/${deviceId}/pending/${cmdId}`)
            .set(command);

        return { success: true, commandId: cmdId };
    }
);

// ========================================
// 2. CREATE TENANT (Super Admin Only)
// ========================================
export const createTenant = functions.https.onCall(
    async (data: {
        tenantName: string;
        adminEmail: string;
        adminPassword: string;
        tier?: 'BASIC' | 'PRO';
    }, context) => {
        // Only super admins can create tenants
        if (!context.auth || context.auth.token.role !== 'super_admin') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Only super admins can create tenants'
            );
        }

        const { tenantName, adminEmail, adminPassword, tier = 'BASIC' } = data;

        if (!tenantName || !adminEmail || !adminPassword) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }

        try {
            const result = await db.runTransaction(async (tx) => {
                // 1. Create Tenant
                const tenantRef = db.collection('tenants').doc();
                const tenantData: Tenant = {
                    name: tenantName,
                    tier: tier,
                    quota: {
                        maxDevices: tier === 'PRO' ? 50 : 10,
                        maxUsers: tier === 'PRO' ? 20 : 5
                    }
                };
                tx.set(tenantRef, tenantData);

                // 2. Create Admin User in Firebase Auth
                const userRecord = await admin.auth().createUser({
                    email: adminEmail,
                    password: adminPassword,
                    displayName: `${tenantName} Admin`
                });

                // 3. Set Custom Claims
                await admin.auth().setCustomUserClaims(userRecord.uid, {
                    role: 'ADMIN',
                    tenantId: tenantRef.id
                });

                // 4. Create Member Document
                const memberRef = db
                    .collection('tenants')
                    .doc(tenantRef.id)
                    .collection('members')
                    .doc(userRecord.uid);

                tx.set(memberRef, {
                    role: 'ADMIN',
                    joinedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // 5. Create User Profile
                const userProfileRef = db.collection('users').doc(userRecord.uid);
                tx.set(userProfileRef, {
                    email: adminEmail,
                    currentTenantId: tenantRef.id,
                    ownedTenants: [tenantRef.id]
                });

                return {
                    tenantId: tenantRef.id,
                    adminUid: userRecord.uid,
                    adminEmail: adminEmail
                };
            });

            return {
                success: true,
                ...result,
                message: 'Tenant created successfully'
            };
        } catch (error: any) {
            console.error('Error creating tenant:', error);
            throw new functions.https.HttpsError('internal', error.message || 'Failed to create tenant');
        }
    }
);

// ========================================
// 3. REGISTER DEVICE (Callable)
// ========================================
export const registerDevice = functions.https.onCall(
    async (data: RegisterDeviceRequest, context): Promise<RegisterDeviceResponse> => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Login required');
        }

        const tenantId = context.auth.token.tenantId as string;
        const { deviceId, claimCode } = data;

        if (!tenantId || !deviceId || !claimCode) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }

        // Use Firestore Transaction for Atomicity
        const result = await db.runTransaction(async (tx) => {
            // 1. Verify Hardware Genuineness (Global Registry)
            const globalDevRef = db.collection('global_devices').doc(deviceId);
            const globalDevSnap = await tx.get(globalDevRef);

            if (!globalDevSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Invalid Hardware');
            }

            const globalDev = globalDevSnap.data() as GlobalDevice;

            // Verify claim code (in production, use proper hashing)
            if (globalDev.secretHash !== claimCode) {
                throw new functions.https.HttpsError('permission-denied', 'Invalid claim code');
            }

            if (globalDev.claimedBy) {
                throw new functions.https.HttpsError('already-exists', 'Device already claimed');
            }

            // 2. Enforce Quotas
            const tenantRef = db.collection('tenants').doc(tenantId);
            const tenantSnap = await tx.get(tenantRef);

            if (!tenantSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Tenant not found');
            }

            const tenant = tenantSnap.data() as Tenant;

            // Count existing devices
            const devicesSnap = await db
                .collection('tenants')
                .doc(tenantId)
                .collection('devices')
                .get();

            if (devicesSnap.size >= tenant.quota.maxDevices) {
                throw new functions.https.HttpsError('resource-exhausted', 'Quota Exceeded');
            }

            // 3. Atomically Update Registries
            tx.update(globalDevRef, { claimedBy: tenantId });

            const newDevice: Device = {
                name: 'New Switch',
                type: globalDev.model,
                metadata: {
                    hardwareRev: '1.0',
                    firmwareVersion: '0.0.1'
                },
                config: {},
                status: 'OFFLINE',
                registeredAt: new Date()
            };

            const deviceRef = db
                .collection('tenants')
                .doc(tenantId)
                .collection('devices')
                .doc(deviceId);

            tx.set(deviceRef, newDevice);

            return newDevice;
        });

        return { success: true, device: result };
    }
);

// ========================================
// 4. PRESENCE SYNC (RTDB Trigger)
// ========================================
export const syncPresence = functions.database
    .ref('/tenants/{tenantId}/presence/{deviceId}')
    .onUpdate(async (change, context) => {
        const isOnline = change.after.val()?.online || false;
        const { tenantId, deviceId } = context.params;

        // Sync to Firestore for searchable/filterable status
        await db
            .collection('tenants')
            .doc(tenantId)
            .collection('devices')
            .doc(deviceId)
            .update({
                status: isOnline ? 'ONLINE' : 'OFFLINE',
                lastSeen: admin.firestore.FieldValue.serverTimestamp()
            });
    });

// ========================================
// 5. SET TENANT CLAIM (Trigger on Member Creation)
// ========================================
export const setTenantClaim = functions.firestore
    .document('tenants/{tenantId}/members/{uid}')
    .onCreate(async (snap, context) => {
        const { tenantId, uid } = context.params;
        const memberData = snap.data();

        // Set custom claims for instant RTDB/Firestore rule enforcement
        await admin.auth().setCustomUserClaims(uid, {
            tenantId: tenantId,
            role: memberData.role
        });
    });
