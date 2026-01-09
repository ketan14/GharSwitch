import * as functions from 'firebase-functions';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
//import * as crypto from "crypto";
// ========================================
// TYPE DEFINITIONS (Inline)
// ========================================

export type UserRole = 'super_admin' | 'tenant_admin' | 'admin' | 'user';
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

export interface SetTenantStatusRequest {
    tenantId: string;
    active: boolean;
    suspendedReason?: string;
}

export interface SetDeviceGlobalStatusRequest {
    deviceId: string;
    active: boolean;
}

export interface AssignSubscriptionPlanRequest {
    tenantId: string;
    plan: 'bronze' | 'silver' | 'gold';
}

export interface DeviceTypeConfig {
    name: string;
    maxSwitches: number;
    allowedPlans: string[];
    active: boolean;
}

export interface ManageDeviceTypeRequest {
    action: 'create' | 'update' | 'set_active';
    typeId: string;
    data?: Partial<DeviceTypeConfig>;
}

export interface UpdatePlatformConfigRequest {
    maintenanceMode?: boolean;
    featureFlags?: Record<string, any>;
}

export interface SetUserActiveStatusRequest {
    userId: string;
    active: boolean;
}

export interface InviteUserRequest {
    email: string;
    password?: string;
    role: 'admin' | 'user';
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
    assignedUsers?: string[];
    status?: string;
    registeredAt: Date;
}

export type GetDeviceTokenRequest = { deviceId?: string; timestamp?: number; signature?: string; };

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
// HELPER: Log Audit Action
// ========================================
async function logAuditAction(context: any, actionType: string, targetId: string, metadata: any = {}) {
    const actorId = context.auth?.uid || 'system';
    const actorRole = context.auth?.token?.role || 'unknown';

    await db.collection('auditLogs').add({
        actorId,
        actorRole,
        actionType,
        targetId,
        metadata,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
}

// ========================================
// HELPER: Recalculate User Summary
// ========================================
async function recalculateUserSummary(userId: string) {
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) return;
    const userData = userSnap.data();
    const tenantId = userData?.tenantId;
    if (!tenantId) return;

    try {
        // 1. Get all device assignments for this user
        // assignments are in tenants/{tenantId}/device_users
        const assignmentsSnap = await db.collection('tenants').doc(tenantId).collection('device_users')
            .where('userId', '==', userId).get();

        const deviceIds = assignmentsSnap.docs.map(doc => doc.data().deviceId);
        const deviceCount = deviceIds.length;

        let switchCount = 0;
        if (deviceCount > 0) {
            // Get all devices for this tenant that are in the user's assigned list
            // Chunking in case deviceCount > 10
            const devicesSnap = await db.collection('tenants').doc(tenantId).collection('devices').get();
            const relevantDevices = devicesSnap.docs.filter(d => deviceIds.includes(d.id));

            for (const devDoc of relevantDevices) {
                const devData = devDoc.data();
                // We'll assume for now each device has its switch count or default to 4
                // A better way would be looking up the device_types registry
                switchCount += devData.maxSwitches || 4;
            }
        }

        // 2. Write to aggregated view
        await db.collection('adminViews').doc('userSummaries').collection('users').doc(userId).set({
            tenantId,
            role: userData?.role,
            active: userData?.active !== false,
            deviceCount,
            switchCount,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

    } catch (err) {
        console.error(`Error recalculating summary for ${userId}:`, err);
    }
}

// ========================================
// 1. SEND COMMAND (Callable V2)
// ========================================
export const sendCommand = onCall({ cors: true }, async (request) => {
    // 1. Authenticate Caller
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login required');
    }

    const caller = request.auth;
    const tenantId = caller.token.tenantId as string;

    if (!tenantId) {
        throw new HttpsError('failed-precondition', 'User has no tenant assigned');
    }

    // 2. Validate Payload
    const { deviceId, action, target } = request.data as SendCommandRequest;
    if (!deviceId || typeof action !== 'boolean' || !target) {
        throw new HttpsError('invalid-argument', 'Invalid payload');
    }

    try {
        // 1.5 Platform Enforcement (Maintenance Mode)
        const platformConfig = await db.collection('platformConfig').doc('global').get();
        if (platformConfig.exists && platformConfig.data()?.maintenanceMode === true) {
            throw new HttpsError('unavailable', 'Platform is currently in maintenance mode');
        }

        // 1.6 Tenant Activity Enforcement
        const tenantSnap = await db.collection('tenants').doc(tenantId).get();
        if (!tenantSnap.exists || tenantSnap.data()?.active === false) {
            throw new HttpsError('permission-denied', 'Tenant is inactive or suspended');
        }

        // 3. Authorization (Check Role)
        const memberSnap = await db.collection('tenants').doc(tenantId).collection('members').doc(caller.uid).get();

        if (!memberSnap.exists) {
            throw new HttpsError('permission-denied', 'Not a member of this tenant');
        }

        const rawRole = memberSnap.data()?.role as string;
        const memberRole = (rawRole || '').toLowerCase().replace('-', '_');
        const canControl = ['super_admin', 'tenant_admin', 'admin', 'user'].includes(memberRole);

        if (!canControl) {
            throw new HttpsError('permission-denied', 'You do not have permission to send commands');
        }

        // 4. Verification (Device Ownership & Activity)
        const deviceDoc = await db.collection('tenants').doc(tenantId).collection('devices').doc(deviceId).get();
        if (!deviceDoc.exists) {
            throw new HttpsError('not-found', 'Device not registered to this tenant');
        }

        const deviceData = deviceDoc.data();
        if (deviceData?.active === false) {
            throw new HttpsError('permission-denied', 'Device is globally deactivated');
        }

        // 4.5. STRICT ISOLATION ENFORCEMENT
        // If caller is a standard USER (not an admin of any kind), they MUST be assigned.
        const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(memberRole);

        if (!isAdmin) {
            const assignedUsers = (deviceData?.assignedUsers || []) as string[];
            if (!assignedUsers.includes(caller.uid)) {
                throw new HttpsError('permission-denied', 'You do not have permission to control this specific device');
            }
        }

        // 5. Execution (RTDB Write)
        const cmdId = generateUniqueId();
        const command: DeviceCommand = { action, target, timestamp: Date.now() };

        await rtdb.ref(`tenants/${tenantId}/device_commands/${deviceId}/pending/${cmdId}`).set(command);

        return { success: true, commandId: cmdId };
    } catch (error: any) {
        console.error('Error in sendCommand:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'Failed to send command');
    }
});

// ========================================
// 2. CREATE TENANT (Super Admin Only)
// ========================================
export const createTenant = functions.https.onCall(async (data: {
    tenantName: string;
    adminEmail: string;
    adminPassword: string;
    tier?: 'BASIC' | 'PRO';
}, context) => {
    // Only super admins can create tenants
    if (!context.auth || context.auth.token.role !== 'super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only super admins can create tenants');
    }

    const { tenantName, adminEmail, adminPassword, tier = 'BASIC' } = data;
    if (!tenantName || !adminEmail || !adminPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const result = await db.runTransaction(async (tx) => {
            const tenantRef = db.collection('tenants').doc();
            tx.set(tenantRef, {
                name: tenantName,
                tier: tier,
                quota: { maxDevices: tier === 'PRO' ? 50 : 10, maxUsers: tier === 'PRO' ? 20 : 5 }
            });

            const userRecord = await admin.auth().createUser({
                email: adminEmail,
                password: adminPassword,
                displayName: `${tenantName} Admin`
            });

            await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'tenant_admin', tenantId: tenantRef.id });

            const memberRef = db.collection('tenants').doc(tenantRef.id).collection('members').doc(userRecord.uid);
            tx.set(memberRef, { role: 'tenant_admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() });

            const userProfileRef = db.collection('users').doc(userRecord.uid);
            tx.set(userProfileRef, { email: adminEmail, currentTenantId: tenantRef.id, ownedTenants: [tenantRef.id] });

            return { tenantId: tenantRef.id, adminUid: userRecord.uid, adminEmail: adminEmail };
        });

        return { success: true, ...result, message: 'Tenant created successfully' };
    } catch (error: any) {
        console.error('Error creating tenant:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to create tenant');
    }
});

// ========================================
// 3. SET TENANT STATUS (Super Admin Only)
// ========================================
export const setTenantStatus = functions.https.onCall(async (data: SetTenantStatusRequest, context) => {
    // 1. Authenticate & Verify Super Admin
    if (!context.auth || context.auth.token.role !== 'super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Super Admin privileges required');
    }

    const { tenantId, active, suspendedReason } = data;
    if (!tenantId || typeof active !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid payload');
    }

    try {
        await db.collection('tenants').doc(tenantId).update({
            active,
            suspendedReason: active ? admin.firestore.FieldValue.delete() : (suspendedReason || 'Administrative suspension')
        });

        await logAuditAction(context, 'SET_TENANT_STATUS', tenantId, { active, suspendedReason });

        return { success: true };
    } catch (error: any) {
        console.error('Error in setTenantStatus:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update tenant status');
    }
});

// ========================================
// 4. SET DEVICE GLOBAL STATUS (Super Admin Only)
// ========================================
export const setDeviceGlobalStatus = functions.https.onCall(async (data: SetDeviceGlobalStatusRequest, context) => {
    // 1. Authenticate & Verify Super Admin
    if (!context.auth || context.auth.token.role !== 'super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Super Admin privileges required');
    }

    const { deviceId, active } = data;
    if (!deviceId || typeof active !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid payload');
    }

    try {
        // Update Global Registry
        await db.collection('global_devices').doc(deviceId).update({ active });

        // Update Tenant-Specific Device Record (if already registered)
        const tenantsSnap = await db.collectionGroup('devices').where('deviceId', '==', deviceId).get();
        const batch = db.batch();
        tenantsSnap.forEach(doc => {
            batch.update(doc.ref, { active });
        });
        await batch.commit();

        await logAuditAction(context, 'SET_DEVICE_GLOBAL_STATUS', deviceId, { active });

        return { success: true };
    } catch (error: any) {
        console.error('Error in setDeviceGlobalStatus:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update device status');
    }
});

// ========================================
// 5. ASSIGN SUBSCRIPTION PLAN (Super Admin Only)
// ========================================
export const assignSubscriptionPlan = functions.https.onCall(async (data: AssignSubscriptionPlanRequest, context) => {
    // 1. Authenticate & Verify Super Admin
    if (!context.auth || context.auth.token.role !== 'super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Super Admin privileges required');
    }

    const { tenantId, plan } = data;
    if (!tenantId || !plan) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid payload');
    }

    const planConfigs: Record<string, any> = {
        bronze: { maxDevices: 5, maxUsers: 2 },
        silver: { maxDevices: 15, maxUsers: 5 },
        gold: { maxDevices: 50, maxUsers: 15 }
    };

    if (!planConfigs[plan]) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid plan type');
    }

    try {
        await db.collection('tenants').doc(tenantId).update({
            plan: plan,
            quota: planConfigs[plan]
        });

        await logAuditAction(context, 'ASSIGN_SUBSCRIPTION_PLAN', tenantId, { plan });

        return { success: true };
    } catch (error: any) {
        console.error('Error in assignSubscriptionPlan:', error);
        throw new functions.https.HttpsError('internal', 'Failed to assign plan');
    }
});

// ========================================
// 6. REGISTER DEVICE (Callable)
// ========================================
export const registerDevice = functions.https.onCall(async (data: RegisterDeviceRequest, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const tenantId = context.auth.token.tenantId as string;
    const role = context.auth.token.role as string;
    const { deviceId, claimCode } = data;

    if (role !== 'tenant_admin' && role !== 'super_admin' && role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can register devices');
    }

    if (!tenantId || !deviceId || !claimCode) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const result = await db.runTransaction(async (tx) => {
        const globalDevRef = db.collection('global_devices').doc(deviceId);
        const globalDevSnap = await tx.get(globalDevRef);

        if (!globalDevSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Invalid Hardware');
        }

        const globalDev = globalDevSnap.data() as GlobalDevice;
        if (globalDev.secretHash !== claimCode) {
            throw new functions.https.HttpsError('permission-denied', 'Invalid claim code');
        }

        if (globalDev.claimedBy) {
            throw new functions.https.HttpsError('already-exists', 'Device already claimed');
        }

        const tenantRef = db.collection('tenants').doc(tenantId);
        const tenantSnap = await tx.get(tenantRef);

        if (!tenantSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Tenant not found');
        }

        const tenant = tenantSnap.data() as Tenant;
        const devicesSnap = await db.collection('tenants').doc(tenantId).collection('devices').get();

        if (devicesSnap.size >= tenant.quota.maxDevices) {
            throw new functions.https.HttpsError('resource-exhausted', 'Quota Exceeded');
        }

        tx.update(globalDevRef, { claimedBy: tenantId });

        const newDevice: Device = {
            name: 'New Switch',
            type: globalDev.model,
            metadata: { hardwareRev: '1.0', firmwareVersion: '0.0.1' },
            config: {},
            status: 'OFFLINE',
            registeredAt: new Date()
        };

        const deviceRef = db.collection('tenants').doc(tenantId).collection('devices').doc(deviceId);
        tx.set(deviceRef, newDevice);

        return newDevice;
    });

    return { success: true, device: result };
});

// ========================================
// 4. INVITE USER (Callable)
// ========================================
export const inviteUser = functions.https.onCall(async (data: InviteUserRequest, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const tenantId = context.auth.token.tenantId as string;
    const callerRole = context.auth.token.role as string;
    const { email, password, role } = data;

    // 0. Authorization: Only admins can invite users
    // 0. Authorization: Tenant Admins AND standard Admins can invite users
    if (callerRole !== 'tenant_admin' && callerRole !== 'super_admin' && callerRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can invite members');
    }

    if (!tenantId || !email || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const result = await db.runTransaction(async (tx) => {
            // 1. Enforce Quotas
            const tenantRef = db.collection('tenants').doc(tenantId);
            const tenantSnap = await tx.get(tenantRef);

            if (!tenantSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Tenant not found');
            }

            const tenant = tenantSnap.data() as Tenant;
            const membersSnap = await db.collection('tenants').doc(tenantId).collection('members').get();

            if (membersSnap.size >= tenant.quota.maxUsers) {
                throw new functions.https.HttpsError('resource-exhausted', 'User quota exceeded');
            }

            // 2. Create User in Auth
            const userRecord = await admin.auth().createUser({
                email,
                password: password || 'Welcome123!', // Generic temp password
                displayName: email.split('@')[0]
            });

            // 3. Set Claims (Immediate access for RTDB/Rules)
            await admin.auth().setCustomUserClaims(userRecord.uid, {
                role: role,
                tenantId: tenantId
            });

            // 4. Create Member Document
            const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(userRecord.uid);
            tx.set(memberRef, {
                role: role,
                joinedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 5. Create User Profile
            const userProfileRef = db.collection('users').doc(userRecord.uid);
            tx.set(userProfileRef, {
                email,
                currentTenantId: tenantId,
                ownedTenants: []
            });

            return { uid: userRecord.uid, email: userRecord.email };
        });

        return { success: true, ...result };
    } catch (error: any) {
        console.error('Invite Error:', error);
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'User already exists');
        }
        throw new functions.https.HttpsError('internal', error.message || 'Failed to invite user');
    }
});


// ========================================
// 4. PRESENCE SYNC (RTDB Trigger)
// ========================================
export const syncPresence = functions.database.ref('/tenants/{tenantId}/presence/{deviceId}')
    .onUpdate(async (change, context) => {
        const isOnline = change.after.val()?.online || false;
        const { tenantId, deviceId } = context.params;

        await db.collection('tenants').doc(tenantId).collection('devices').doc(deviceId).update({
            status: isOnline ? 'ONLINE' : 'OFFLINE',
            lastSeen: admin.firestore.FieldValue.serverTimestamp()
        });
    });

// ========================================
// 5. SET TENANT CLAIM (Trigger on Member Creation)
// ========================================
export const setTenantClaim = functions.firestore.document('tenants/{tenantId}/members/{uid}')
    .onCreate(async (snap, context) => {
        const { tenantId, uid } = context.params;
        const memberData = snap.data();

        await admin.auth().setCustomUserClaims(uid, {
            tenantId: tenantId,
            role: memberData.role
        });
    });

// ========================================
// 7. MANAGE DEVICE TYPE (Super Admin Only)
// ========================================
// ========================================
// 7. ASSIGN DEVICE TO USER (Tenant Admin/Admin)
// ========================================
export const assignDeviceToUser = functions.https.onCall(async (data: { deviceId: string, userId: string, access: boolean }, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

    const tenantId = context.auth.token.tenantId as string;
    const role = context.auth.token.role as string;
    const { deviceId, userId, access } = data;

    // 1. Authorization
    if (role !== 'tenant_admin' && role !== 'super_admin' && role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can assign devices');
    }

    if (!tenantId || !deviceId || !userId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        await db.runTransaction(async (tx) => {
            const deviceRef = db.collection('tenants').doc(tenantId).collection('devices').doc(deviceId);
            const mappingRef = db.collection('tenants').doc(tenantId).collection('device_users').doc(`${deviceId}_${userId}`);

            const deviceSnap = await tx.get(deviceRef);
            if (!deviceSnap.exists) throw new functions.https.HttpsError('not-found', 'Device not found');

            // 2. Dual Write: Logic & Indexing
            if (access) {
                // Grant Access
                tx.update(deviceRef, {
                    assignedUsers: admin.firestore.FieldValue.arrayUnion(userId)
                });
                tx.set(mappingRef, {
                    tenantId, deviceId, userId,
                    assignedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Revoke Access
                tx.update(deviceRef, {
                    assignedUsers: admin.firestore.FieldValue.arrayRemove(userId)
                });
                tx.delete(mappingRef);
            }
        });

        // Log Audit (outside transaction)
        await logAuditAction(context, access ? 'ASSIGN_DEVICE' : 'REVOKE_DEVICE', deviceId, { userId });

        return { success: true };
    } catch (error: any) {
        console.error('Error assigning device:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update assignment');
    }
});

// ========================================
// 7.5. ASSIGN USER TO GROUP (Group-Based Access)
// ========================================
export const assignUserToGroup = functions.https.onCall(async (data: { groupId: string, userId: string, access: boolean }, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

    const tenantId = context.auth.token.tenantId as string;
    const role = context.auth.token.role as string;
    const { groupId, userId, access } = data;

    // 1. Authorization
    if (role !== 'tenant_admin' && role !== 'super_admin' && role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can assign groups');
    }

    if (!tenantId || !groupId || !userId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        await db.runTransaction(async (tx) => {
            const groupRef = db.collection('tenants').doc(tenantId).collection('groups').doc(groupId);
            const groupSnap = await tx.get(groupRef);

            if (!groupSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Group not found');
            }

            const groupData = groupSnap.data();
            const deviceIds = (groupData?.deviceIds || []) as string[];

            // 2. Update Group Membership (Logical Layer)
            if (access) {
                tx.update(groupRef, { members: admin.firestore.FieldValue.arrayUnion(userId) });
            } else {
                tx.update(groupRef, { members: admin.firestore.FieldValue.arrayRemove(userId) });
            }

            // 3. Cascade to Devices (Physical Layer)
            // Note: In an ideal world with >500 devices, this should be a background trigger.
            // For typical smart homes (10-50 devices), loop in transaction is fine.
            for (const deviceId of deviceIds) {
                const deviceRef = db.collection('tenants').doc(tenantId).collection('devices').doc(deviceId);
                const mappingRef = db.collection('tenants').doc(tenantId).collection('device_users').doc(`${deviceId}_${userId}`);

                if (access) {
                    tx.update(deviceRef, { assignedUsers: admin.firestore.FieldValue.arrayUnion(userId) });
                    tx.set(mappingRef, { tenantId, deviceId, userId, assignedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                } else {
                    tx.update(deviceRef, { assignedUsers: admin.firestore.FieldValue.arrayRemove(userId) });
                    // We don't strictly delete mappingRef here to keep history, or we can delete.
                    // Let's delete to keep clean.
                    tx.delete(mappingRef);
                }
            }
        });

        await logAuditAction(context, access ? 'ASSIGN_GROUP' : 'REVOKE_GROUP', groupId, { userId, deviceCount: 'cascade' });

        return { success: true };
    } catch (error: any) {
        console.error('Error in assignUserToGroup:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update group assignment');
    }
});

// ========================================
// 7.6. MANAGE GROUP (Create/Update Rooms)
// ========================================
export const manageGroup = functions.https.onCall(async (data: { groupId?: string, name: string, deviceIds: string[] }, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

    const tenantId = context.auth.token.tenantId as string;
    const role = context.auth.token.role as string;
    const { groupId, name, deviceIds } = data;

    // 1. Authorization
    if (role !== 'tenant_admin' && role !== 'super_admin' && role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can manage groups');
    }

    if (!tenantId || !name || !Array.isArray(deviceIds)) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const id = groupId || generateUniqueId();
        const groupRef = db.collection('tenants').doc(tenantId).collection('groups').doc(id);

        const groupData = {
            name,
            deviceIds,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // If it's a new group, add createdAt
            ...(!groupId ? { createdAt: admin.firestore.FieldValue.serverTimestamp(), members: [] } : {})
        };

        await groupRef.set(groupData, { merge: true });

        await logAuditAction(context, groupId ? 'UPDATE_GROUP' : 'CREATE_GROUP', id, { name, deviceCount: deviceIds.length });

        return { success: true, groupId: id };
    } catch (error: any) {
        console.error('Error in manageGroup:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage group');
    }
});
export const manageDeviceType = functions.https.onCall(async (data: ManageDeviceTypeRequest, context) => {
    if (!context.auth || context.auth.token.role !== 'super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Super Admin privileges required');
    }

    const { action, typeId, data: typeData } = data;
    if (!action || !typeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const typeRef = db.collection('device_types').doc(typeId);

        if (action === 'create') {
            await typeRef.set({
                ...typeData,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else if (action === 'update') {
            await typeRef.update({
                ...typeData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else if (action === 'set_active') {
            await typeRef.update({
                active: typeData?.active ?? false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        await logAuditAction(context, `DEVICE_TYPE_${action.toUpperCase()}`, typeId, typeData);

        return { success: true };
    } catch (error: any) {
        console.error('Error in manageDeviceType:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage device type');
    }
});

// ========================================
// 8. UPDATE PLATFORM CONFIG (Super Admin Only)
// ========================================
export const updatePlatformConfig = functions.https.onCall(async (data: UpdatePlatformConfigRequest, context) => {
    if (!context.auth || context.auth.token.role !== 'super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Super Admin privileges required');
    }

    try {
        const configRef = db.collection('platformConfig').doc('global');
        await configRef.set({
            ...data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await logAuditAction(context, 'UPDATE_PLATFORM_CONFIG', 'global', data);

        return { success: true };
    } catch (error: any) {
        console.error('Error in updatePlatformConfig:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update platform configuration');
    }
});

// ========================================
// 10. USER SUMMARY TRIGGERS
// ========================================
export const onUserUpdate = functions.firestore.document('users/{userId}')
    .onWrite(async (change, context) => {
        await recalculateUserSummary(context.params.userId);
    });

export const onDeviceAssignmentChange = functions.firestore.document('tenants/{tenantId}/device_users/{mappingId}')
    .onWrite(async (change, context) => {
        const data = change.after.exists ? change.after.data() : change.before.data();
        if (data?.userId) {
            await recalculateUserSummary(data.userId);
        }
    });

export const onDeviceChange = functions.firestore.document('tenants/{tenantId}/devices/{deviceId}')
    .onWrite(async (change, context) => {
        // If device switches change, we might need to update summaries for ALL users assigned to this device
        const tenantId = context.params.tenantId;
        const deviceId = context.params.deviceId;

        const assignmentsSnap = await db.collection('tenants').doc(tenantId).collection('device_users')
            .where('deviceId', '==', deviceId).get();

        const userIds = assignmentsSnap.docs.map(doc => doc.data().userId);
        await Promise.all(userIds.map(uid => recalculateUserSummary(uid)));
    });
export const setUserActiveStatus = functions.https.onCall(async (data: SetUserActiveStatusRequest, context) => {
    // 1. Authenticate & Verify Super Admin
    if (!context.auth || context.auth.token.role !== 'super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Super Admin privileges required');
    }

    const { userId, active } = data;
    if (!userId || typeof active !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid payload');
    }

    try {
        // Toggle Firebase Auth status
        await admin.auth().updateUser(userId, { disabled: !active });

        // Update Firestore user document
        await db.collection('users').doc(userId).update({
            active,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await logAuditAction(context, active ? 'USER_ENABLED' : 'USER_DISABLED', userId);

        return { success: true };
    } catch (error: any) {
        console.error('Error in setUserActiveStatus:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update user status');
    }
});

export const getDeviceToken = functions.https.onRequest(
    async (req: functions.https.Request, res: functions.Response) => {
        // Only allow POST
        if (req.method !== "POST") {
            res.status(405).json({ error: "method not allowed" });
            return;
        }

        const body = (req.body || {}) as any;
        const { deviceId, deviceSecret } = body;

        // Basic validation
        if (!deviceId || !deviceSecret) {
            res.status(400).json({ error: "missing deviceId or deviceSecret" });
            return;
        }

        try {
            // 1. Fetch the device secret from your secure SaaS registry (Firestore)
            const deviceRef = admin.firestore().collection("global_devices").doc(deviceId);
            const deviceSnap = await deviceRef.get();

            if (!deviceSnap.exists) {
                res.status(404).json({ error: "Device not registered" });
                return;
            }

            const deviceData = deviceSnap.data();
            if (!deviceData) {
                res.status(500).json({ error: "device record malformed" });
                return;
            }

            // In production, compare hashes. For now, direct string match.
            const storedSecret = String(deviceData.sharedSecret || "");
            const orgId = deviceData.orgId || null;

            if (!storedSecret) {
                res.status(500).json({ error: "device sharedSecret not configured on server" });
                return;
            }

            if (deviceSecret !== storedSecret) {
                res.status(401).json({ error: "Invalid Secret" });
                return;
            }

            // 2. Create Custom Token with SaaS Claims
            // The UID 'device:<deviceId>' matches the RTDB rules
            const uid = `device:${deviceId}`;
            const additionalClaims = { orgId, isIot: true, deviceId };

            const customToken = await admin.auth().createCustomToken(uid, additionalClaims);

            res.status(200).json({ token: customToken });
        } catch (err: any) {
            console.error("Auth Error:", err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
);