import { useEffect, useState, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export interface Device {
    id: string;
    name: string;
    type: string;
    status?: 'ONLINE' | 'OFFLINE';
    metadata?: any;
    config?: any;
    assignedUsers?: string[];
    switchNames?: string[];
}

export function useDevices() {
    const { tenantId, user, role: userRole } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [devicesLoading, setDevicesLoading] = useState(true);
    const [presenceLoading, setPresenceLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const [presence, setPresence] = useState<Record<string, any>>({});

    // 1. Fetch Devices Metadata from Firestore
    useEffect(() => {
        if (!tenantId) {
            setDevices([]);
            setDevicesLoading(false);
            return;
        }

        const devicesRef = collection(db, `tenants/${tenantId}/devices`);
        const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(userRole?.toLowerCase().replace('-', '_') || '');

        const q = isAdmin
            ? query(devicesRef)
            : query(devicesRef, where('assignedUsers', 'array-contains', user?.uid));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const deviceList: Device[] = [];
                snapshot.forEach((doc) => {
                    deviceList.push({
                        id: doc.id,
                        ...doc.data(),
                    } as Device);
                });
                setDevices(deviceList);
                setDevicesLoading(false);
            },
            (err) => {
                console.error('Error fetching devices:', err);
                setError(err as Error);
                setDevicesLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId, user?.uid, userRole]);

    // 2. Listen to RTDB Presence for Live Status
    useEffect(() => {
        if (!tenantId) {
            setPresenceLoading(false);
            return;
        }

        const { ref, onValue, off } = require('firebase/database');
        const { rtdb } = require('../lib/firebase');

        const presenceRef = ref(rtdb, `tenants/${tenantId}/presence`);

        const unsub = onValue(presenceRef, (snapshot: any) => {
            setPresence(snapshot.val() || {});
            setPresenceLoading(false);
        }, (err: any) => {
            console.error('Presence listener error:', err);
            setPresenceLoading(false);
        });

        return () => off(presenceRef, 'value', unsub);
    }, [tenantId]);

    // 3. Merge Data (Calculate Online/Offline based on Heartbeat)
    const combinedDevices = useMemo(() => {
        return devices.map(device => {
            const devicePresence = presence[device.id];
            let isOnline = false;

            if (devicePresence && devicePresence.lastSeen) {
                const now = Date.now();
                const lastSeen = devicePresence.lastSeen;
                // 12 Minute Grace Period (Heartbeat is 10m)
                const THRESHOLD = 12 * 60 * 1000;

                if (Math.abs(now - lastSeen) > THRESHOLD) {
                    isOnline = true;
                }
            }
            return {
                ...device,
                status: isOnline ? 'ONLINE' : 'OFFLINE'
            };
        });
    }, [devices, presence]);

    return {
        devices: combinedDevices,
        loading: devicesLoading || presenceLoading,
        error
    };
}
