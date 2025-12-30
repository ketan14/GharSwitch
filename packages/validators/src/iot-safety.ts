import { DeviceCommand } from '@ghar-switch/domain-types';

export function validateCommandPayload(payload: any): { valid: boolean; error?: string } {
    if (!payload) return { valid: false, error: 'Empty payload' };

    // Basic Type Checks
    if (typeof payload.switchIndex !== 'number') return { valid: false, error: 'Invalid switchIndex' };
    if (!['ON', 'OFF', 'TOGGLE'].includes(payload.action)) return { valid: false, error: 'Invalid action' };

    // Note: We do NOT validate deviceId here because that's usually a URL parameter or context

    return { valid: true };
}
