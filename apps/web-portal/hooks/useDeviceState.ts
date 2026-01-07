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

    // Map pending commands to switch target states (true=ON, false=OFF)
    const [pendingSwitches, setPendingSwitches] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!tenantId || !deviceId) return;

        // 1. Listen for State
        const statePath = `tenants/${tenantId}/device_states/${deviceId}`;
        const stateRef = ref(rtdb, statePath);

        const stateUnsub = onValue(stateRef, (snapshot) => {
            const data = snapshot.val();
            if (data) setState(data as DeviceState);
            setLoading(false);
        });

        // 2. Listen for Pending Commands
        const cmdPath = `tenants/${tenantId}/device_commands/${deviceId}/pending`;
        const cmdRef = ref(rtdb, cmdPath);

        const cmdUnsub = onValue(cmdRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                setPendingSwitches({});
                return;
            }

            // Map pending commands to switches + target state
            const busymap: Record<string, boolean> = {};
            Object.values(data).forEach((cmd: any) => {
                if (cmd.target && typeof cmd.action === 'boolean') {
                    busymap[cmd.target] = cmd.action;
                }
            });
            setPendingSwitches(busymap);
        });

        return () => {
            off(stateRef, 'value', stateUnsub);
            off(cmdRef, 'value', cmdUnsub);
        };
    }, [tenantId, deviceId]);

    return { state, loading, pendingSwitches };
}
