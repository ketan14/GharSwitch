import { useEffect, useState } from 'react';
import { doc, onSnapshot, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAtombergStore } from '../store/useAtombergStore';
import { AtombergApi } from '../api/client';
import { FanDeviceState } from '@ghar-switch/domain-types';

export const useFanControl = (hubId: string, deviceId: string) => {
    const db = getFirestore();
    const auth = getAuth();
    const setOptimisticState = useAtombergStore((state) => state.setOptimisticState);
    const optimisticState = useAtombergStore((state) => state.optimisticStates[deviceId]);

    const [realState, setRealState] = useState<FanDeviceState | null>(null);
    const [loading, setLoading] = useState(true);

    // Listen to real-time state
    useEffect(() => {
        const user = auth.currentUser;
        if (!user || !deviceId) return;

        const stateRef = doc(db, `users/${user.uid}/devices/${deviceId}/state/current`);

        const unsubscribe = onSnapshot(stateRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as FanDeviceState;
                setRealState(data);
                // Clear optimistic state once the real state is synced or failed
                if (data.syncStatus === 'SYNCED' || data.syncStatus === 'FAILED') {
                    setOptimisticState(deviceId, { syncStatus: data.syncStatus });
                    // Usually we clear optimistic state if synced, but for simplicity we keep it matching
                }
            }
            setLoading(false);
        }, (error) => {
            console.error("Failed to listen to device state:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [deviceId, auth.currentUser]);

    // Derived state: Use optimistic if pending, otherwise real state
    const currentState = (optimisticState?.syncStatus === 'PENDING')
        ? optimisticState
        : (realState || optimisticState);

    const sendCommand = async (payload: { power?: boolean; speed?: number }) => {
        // Optimistic UI update
        setOptimisticState(deviceId, { ...payload, syncStatus: 'PENDING' });

        try {
            await AtombergApi.sendCommand(hubId, deviceId, payload);
            // We don't set SYNCED here, we let the onSnapshot handle it when the Cloud Function confirms
        } catch (error) {
            console.error("Command failed", error);
            // Rollback on failure immediately
            setOptimisticState(deviceId, { syncStatus: 'FAILED' });
        }
    };

    return {
        state: currentState,
        loading,
        setPower: (power: boolean) => sendCommand({ power }),
        setSpeed: (speed: number) => sendCommand({ speed })
    };
};
