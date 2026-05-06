import { create } from 'zustand';

interface DeviceState {
    power: boolean;
    speed: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'FAILED';
}

interface AtombergStore {
    // We store optimistic states keyed by deviceId
    optimisticStates: Record<string, DeviceState>;
    setOptimisticState: (deviceId: string, state: Partial<DeviceState>) => void;
    clearOptimisticState: (deviceId: string) => void;
}

export const useAtombergStore = create<AtombergStore>((set) => ({
    optimisticStates: {},
    setOptimisticState: (deviceId, newState) => set((state) => ({
        optimisticStates: {
            ...state.optimisticStates,
            [deviceId]: {
                ...(state.optimisticStates[deviceId] || { power: false, speed: 1, syncStatus: 'PENDING' }),
                ...newState
            }
        }
    })),
    clearOptimisticState: (deviceId) => set((state) => {
        const nextState = { ...state.optimisticStates };
        delete nextState[deviceId];
        return { optimisticStates: nextState };
    })
}));
