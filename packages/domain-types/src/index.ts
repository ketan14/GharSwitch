// ========================================
// DOMAIN TYPES - SHARED ACROSS ENTIRE SYSTEM
// ========================================
// This package defines the data contracts for:
// - Frontend (Next.js)
// - Backend (Cloud Functions)
// - Future: Firmware (via code generation)

// ========================================
// USER & AUTHENTICATION
// ========================================

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface User {
    uid: string;
    email: string;
    currentTenantId: string;
    ownedTenants: string[];
}

export interface TenantMember {
    role: UserRole;
    joinedAt: Date;
    // Future: Switch-level permissions
    overrides?: {
        [deviceId: string]: {
            allowedSwitches: string[];
        };
    };
}

// ========================================
// TENANT & SUBSCRIPTION
// ========================================

export type SubscriptionTier = 'BASIC' | 'PRO';

export interface TenantQuota {
    maxDevices: number;
    maxUsers: number;
}

export interface Tenant {
    name: string;
    tier: SubscriptionTier;
    createdAt: Date;
    quota: TenantQuota;
}

// ========================================
// DEVICE REGISTRY
// ========================================

export interface DeviceMetadata {
    hardwareRev: string;
    firmwareVersion: string;
}

export interface DeviceConfig {
    rebootOnCommand?: boolean;
    ledBrightness?: number;
}

export interface Device {
    name: string;
    type: string;
    metadata: DeviceMetadata;
    config: DeviceConfig;
    status?: 'ONLINE' | 'OFFLINE';
    lastSeen?: Date;
    registeredAt: Date;
}

export interface GlobalDevice {
    serialNumber: string;
    model: string;
    secretHash: string;
    claimedBy: string | null;
}

// ========================================
// REAL-TIME STATE (RTDB)
// ========================================

export interface SwitchStates {
    s1: boolean;
    s2: boolean;
    s3: boolean;
    s4: boolean;
}

export interface DeviceDiagnostics {
    rssi: number;
    heap: number;
    uptime: number;
}

export interface DeviceState {
    switches: SwitchStates;
    diagnostics: DeviceDiagnostics;
    last_updated: number; // timestamp
}

export type SwitchTarget = 's1' | 's2' | 's3' | 's4';

export interface DeviceCommand {
    action: boolean;
    target: SwitchTarget;
    timestamp: number;
}

export interface DevicePresence {
    online: boolean;
    last_seen: number;
}

// ========================================
// CLOUD FUNCTION PAYLOADS
// ========================================

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
    device: Device;
}
