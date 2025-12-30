import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export type SwitchTarget = 's1' | 's2' | 's3' | 's4';

interface SendCommandRequest {
    deviceId: string;
    action: boolean;
    target: SwitchTarget;
}

interface SendCommandResponse {
    success: boolean;
    commandId: string;
}

export function useSendCommand() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const sendCommand = async (deviceId: string, target: SwitchTarget, action: boolean) => {
        setLoading(true);
        setError(null);

        try {
            const sendCommandFn = httpsCallable<SendCommandRequest, SendCommandResponse>(
                functions,
                'sendCommand'
            );

            const result = await sendCommandFn({
                deviceId,
                action,
                target,
            });

            setLoading(false);
            return result.data;
        } catch (err) {
            console.error('Error sending command:', err);
            setError(err as Error);
            setLoading(false);
            throw err;
        }
    };

    return { sendCommand, loading, error };
}
