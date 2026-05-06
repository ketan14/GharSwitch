// Hardware Types
export type DeviceTypeId = 'basic_4ch' | 'standard_8ch' | 'pro_16ch';
export type SwitchType = 'toggle' | 'dimmer' | 'fan';

export interface Device {
    id: string;
    tenantId: string;
    typeId: DeviceTypeId;
    displayName: string;
    secretKeyHash: string;
    firmwareVersion: string;
    isOnline: boolean;
    createdAt: any;
}

export interface Switch {
    id: string; // "0", "1"...
    index: number;
    deviceId: string;
    tenantId: string;
    displayName: string;
    type: SwitchType;
}

export interface DeviceType {
    id: string;
    name: string;
    channelCount: number;
    capabilities: string[];
    planTier: 'bronze' | 'silver' | 'gold';
}

// RTDB Types
export interface DeviceState {
    on: boolean;
    updatedAt: number;
}

export interface DeviceCommand {
    cmdId?: string; // Generated
    switchIndex: number;
    action: 'ON' | 'OFF' | 'TOGGLE';
    issuedBy: string;
    timestamp: number;
}

export interface DeviceStatus {
    state: 'online' | 'offline';
    lastSeen: number;
    ip: string;
}

// Hub & Third-Party Integrations
export interface HubProvider {
    type: 'ATOMBERG' | 'ESP32' | 'TUYA' | 'MATTER';
}

export interface AtombergHub {
    id: string;
    nickname: string;
    type: 'ATOMBERG';
    apiKeyEncrypted: string;
    refreshTokenEncrypted: string;
    accessToken?: string;
    expiresAt?: any; // Timestamp
    isActive: boolean;
    createdAt: any;
    updatedAt: any;
    metadata?: {
        totalDevices?: number;
    };
}

export interface FanDevice {
    id: string;
    hubId: string;
    atombergDeviceId: string;
    provider: 'ATOMBERG';
    type: 'FAN';
    name: string;
    room?: string;
    online: boolean;
    lastSeenAt?: any;
    capabilities: {
        powerControl: boolean;
        speedControl: boolean;
    };
    createdAt: any;
    updatedAt: any;
}

export interface FanDeviceState {
    power: boolean;
    speed: 1 | 2 | 3 | 4 | 5 | 6;
    syncStatus: 'SYNCED' | 'PENDING' | 'FAILED';
    source: 'USER' | 'SYNC' | 'AUTOMATION';
    updatedAt: any;
}

export interface CommandQueueItem {
    id?: string;
    deviceId: string;
    hubId: string;
    provider: 'ATOMBERG';
    payload: {
        power?: boolean;
        speed?: number;
    };
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: any;
    updatedAt: any;
    error?: string;
}
