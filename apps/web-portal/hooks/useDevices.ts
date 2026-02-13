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

    // 3. Merge Data (Online only if presence lastSeen within last hour)
    // Policy: Store lastSeen in UTC in RTDB; do all "within last hour" math in UTC (no local time).
    const ONE_HOUR_MS = 60 * 60 * 1000;

    const combinedDevices = useMemo(() => {
        return devices.map(device => {
            const devicePresence = presence[device.id];
            let isOnline = false;

            if (devicePresence && devicePresence.lastSeen != null) {
                // Compare UTC to UTC: Date.now() and RTDB lastSeen are both UTC milliseconds
                const nowUtcMs = Date.now();
                let lastSeenUtcMs = Number(devicePresence.lastSeen);

                // Normalize: Firebase server timestamp is UTC ms. Some devices send Unix seconds (10 digits).
                if (lastSeenUtcMs > 0 && lastSeenUtcMs < 1e12) {
                    lastSeenUtcMs = lastSeenUtcMs * 1000;
                }

                // If device clock is in the future (e.g. 2717666640000 = year 2056), cap to "now"
                // so we still treat it as "just seen" and show ONLINE when they're sending heartbeats.
                if (lastSeenUtcMs > nowUtcMs) {
                    lastSeenUtcMs = nowUtcMs;
                }

                // Device is ONLINE if lastSeen (UTC) is within the last hour
                const isWithinHour = nowUtcMs - lastSeenUtcMs <= ONE_HOUR_MS;
                if (isWithinHour) {
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
