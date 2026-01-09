import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, DocumentData, where } from 'firebase/firestore';
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
}

export function useDevices() {
    const { tenantId, user, role: userRole } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const [presence, setPresence] = useState<Record<string, any>>({});

    // 1. Fetch Devices Metadata from Firestore
    useEffect(() => {
        if (!tenantId) {
            setDevices([]);
            setLoading(false);
            return;
        }

        const devicesRef = collection(db, `tenants/${tenantId}/devices`);

        // 1.5. Authorization-Aware Query
        // Admins can see EVERYTHING in the tenant
        // Standard users can ONLY see what they are assigned to
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
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching devices:', err);
                setError(err as Error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId, user?.uid, userRole]);

    // 2. Listen to RTDB Presence for Live Status
    useEffect(() => {
        if (!tenantId) return;

        const { ref, onValue, off } = require('firebase/database'); // Lazy load/require to match existing style or import above
        const { rtdb } = require('../lib/firebase');

        const presenceRef = ref(rtdb, `tenants/${tenantId}/presence`);

        const unsub = onValue(presenceRef, (snapshot: any) => {
            setPresence(snapshot.val() || {});
        });

        return () => off(presenceRef, 'value', unsub);
    }, [tenantId]);

    // 3. Merge Data (Calculate Online/Offline based on Heartbeat)
    const combinedDevices = devices.map(device => {
        const devicePresence = presence[device.id];
        let isOnline = false;

        if (devicePresence && devicePresence.lastSeen) {
            const now = Date.now();
            const lastSeen = devicePresence.lastSeen;
            // 12 Minute Grace Period (Heartbeat is 10m)
            const THRESHOLD = 12 * 60 * 1000;
            if (now - lastSeen < THRESHOLD) {
                isOnline = true;
            }
        }

        return {
            ...device,
            status: isOnline ? 'ONLINE' : 'OFFLINE'
        };
    });

    return { devices: combinedDevices, loading, error };
}
