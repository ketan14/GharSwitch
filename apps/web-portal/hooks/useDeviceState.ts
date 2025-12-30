import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export interface SwitchStates {
    s1: boolean;
    s2: boolean;
    s3: boolean;
    s4: boolean;
}

export interface DeviceState {
    switches: SwitchStates;
    diagnostics?: {
        rssi: number;
        heap: number;
        uptime: number;
    };
    last_updated?: number;
}

export function useDeviceState(deviceId: string | null) {
    const { tenantId } = useAuth();
    const [state, setState] = useState<DeviceState | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId || !deviceId) {
            setState(null);
            setLoading(false);
            return;
        }

        const stateRef = ref(rtdb, `tenants/${tenantId}/device_states/${deviceId}`);

        const unsubscribe = onValue(
            stateRef,
            (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    setState(data as DeviceState);
                } else {
                    setState(null);
                }
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching device state:', error);
                setLoading(false);
            }
        );

        return () => {
            off(stateRef, 'value', unsubscribe);
        };
    }, [tenantId, deviceId]);

    return { state, loading };
}
