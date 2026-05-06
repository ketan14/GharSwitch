const ATOMBERG_BASE_URL =
    process.env.ATOMBERG_BASE_URL ||
    'https://mock-api.atomberg.com/v1';

export interface AtombergAuthResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number; // in seconds
}

export interface AtombergDevice {
    id: string;
    name: string;
    room?: string;
    type: string;
    capabilities: { power: boolean; speed: boolean };
}

export class AtombergApiClient {
    /**
     * Authenticates with Atomberg and returns tokens.
     */
    static async login(apiKey: string): Promise<AtombergAuthResponse> {
        const response = await fetch(`${ATOMBERG_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey })
        });
        if (!response.ok) throw new Error('Atomberg login failed');
        return await response.json();
    }

    /**
     * Refreshes the access token using the refresh token.
     */
    static async refreshToken(refreshToken: string): Promise<AtombergAuthResponse> {
        const response = await fetch(`${ATOMBERG_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        if (!response.ok) throw new Error('Atomberg token refresh failed');
        return await response.json();
    }

    /**
     * Discovers devices for the authenticated user.
     */
    static async discoverDevices(accessToken: string): Promise<AtombergDevice[]> {
        const response = await fetch(`${ATOMBERG_BASE_URL}/devices`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to discover Atomberg devices');
        const data = await response.json();
        return data.devices;
    }

    /**
     * Sends a command to a specific device.
     */
    static async sendCommand(accessToken: string, deviceId: string, payload: { power?: boolean; speed?: number }): Promise<boolean> {
        console.log(`Sending command to Atomberg Device ${deviceId}:`, payload);
        const response = await fetch(`${ATOMBERG_BASE_URL}/devices/${deviceId}/command`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to send command to Atomberg device');
        const data = await response.json();
        return data.success;
    }
}
