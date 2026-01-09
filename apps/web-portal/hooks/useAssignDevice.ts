import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export function useAssignDevice() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const assignDevice = async (deviceId: string, userId: string, access: boolean) => {
        setLoading(true);
        setError(null);
        try {
            const functions = getFunctions();
            const assignDeviceFn = httpsCallable(functions, 'assignDeviceToUser');
            const result = await assignDeviceFn({ deviceId, userId, access });
            setLoading(false);
            return result.data;
        } catch (err: any) {
            console.error('Error assigning device:', err);
            setError(err as Error);
            setLoading(false);
            throw err;
        }
    };

    return { assignDevice, loading, error };
}
