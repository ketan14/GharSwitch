import { useEffect, useState, useRef, useCallback } from 'react';
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
    // Per-switch count of pending commands (for badge on button)
    const [pendingCountBySwitch, setPendingCountBySwitch] = useState<Record<string, number>>({});

    // Store raw Firebase data to re-process for timeouts
    const rawCmdsRef = useRef<any>(null);

    // Helper to recalculate pending state based on timeout
    const recalcPending = useCallback(() => {
        const data = rawCmdsRef.current;
        if (!data) {
            setPendingSwitches({});
            setPendingCountBySwitch({});
            return;
        }

        const busymap: Record<string, boolean> = {};
        const countmap: Record<string, number> = {};
        const now = Date.now();
        const TIMEOUT_MS = 15000; // 15 Seconds UI Timeout

        Object.values(data).forEach((cmd: any) => {
            if (cmd.timestamp && (now - cmd.timestamp > TIMEOUT_MS)) return;
            if (!cmd.target || typeof cmd.action !== 'boolean') return;

            busymap[cmd.target] = cmd.action;
            countmap[cmd.target] = (countmap[cmd.target] || 0) + 1;
        });
        setPendingSwitches(busymap);
        setPendingCountBySwitch(countmap);
    }, []);

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
            rawCmdsRef.current = snapshot.val();
            recalcPending(); // Update immediately on new data
        });

        // 3. Interval Timer to clean up stale spinners
        const intervalId = setInterval(recalcPending, 1000);

        return () => {
            off(stateRef, 'value', stateUnsub);
            off(cmdRef, 'value', cmdUnsub);
            clearInterval(intervalId);
        };
    }, [tenantId, deviceId, recalcPending]);

    return { state, loading, pendingSwitches, pendingCountBySwitch };
}
