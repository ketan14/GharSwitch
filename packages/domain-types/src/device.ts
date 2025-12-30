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
