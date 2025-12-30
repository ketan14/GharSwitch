import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface RegisterDeviceRequest {
    deviceId: string;
    claimCode: string;
}

interface RegisterDeviceResponse {
    success: boolean;
    device: any;
}

export function useRegisterDevice() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const registerDevice = async (deviceId: string, claimCode: string) => {
        setLoading(true);
        setError(null);

        try {
            const registerDeviceFn = httpsCallable<RegisterDeviceRequest, RegisterDeviceResponse>(
                functions,
                'registerDevice'
            );

            const result = await registerDeviceFn({
                deviceId,
                claimCode,
            });

            setLoading(false);
            return result.data;
        } catch (err) {
            console.error('Error registering device:', err);
            setError(err as Error);
            setLoading(false);
            throw err;
        }
    };

    return { registerDevice, loading, error };
}
