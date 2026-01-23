import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface UpdateSwitchNamesRequest {
    deviceId: string;
    switchNames: string[];
}

export function useUpdateSwitchNames() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const updateSwitchNames = async (deviceId: string, switchNames: string[]) => {
        setLoading(true);
        setError(null);

        try {
            const updateFn = httpsCallable<UpdateSwitchNamesRequest, { success: boolean }>(
                functions,
                'updateSwitchNames'
            );

            const result = await updateFn({
                deviceId,
                switchNames,
            });

            setLoading(false);
            return result.data;
        } catch (err) {
            console.error('Error updating switch names:', err);
            setError(err as Error);
            setLoading(false);
            throw err;
        }
    };

    return { updateSwitchNames, loading, error };
}
