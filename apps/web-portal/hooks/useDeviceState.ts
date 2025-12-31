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
        const path = `tenants/${tenantId}/device_states/${deviceId}`;
        console.log(`[useDeviceState] 🔌 Connecting to: ${path}`);
        const stateRef = ref(rtdb, path);

        // Fail-safe: Force loading to false if Firebase doesn't respond in 5s
        const timeout = setTimeout(() => {
            if (loading) {
                console.warn(`[useDeviceState] ⏳ Timeout waiting for ${deviceId} state. Forcing load.`);
                setLoading(false);
            }
        }, 5000);

        const unsubscribe = onValue(
            stateRef,
            (snapshot) => {
                clearTimeout(timeout);
                const data = snapshot.val();
                console.log(`[useDeviceState] ✅ Received for ${deviceId}:`, data);
                if (data) {
                    setState(data as DeviceState);
                } else {
                    console.log(`[useDeviceState] ℹ️ Path exists but is empty for ${deviceId}`);
                    setState(null);
                }
                setLoading(false);
            },
            (error) => {
                clearTimeout(timeout);
                console.error(`[useDeviceState] ❌ Error for ${deviceId}:`, error);
                setLoading(false);
            }
        );

        return () => {
            clearTimeout(timeout);
            off(stateRef, 'value', unsubscribe);
        };
    }, [tenantId, deviceId]);

    return { state, loading };
}
