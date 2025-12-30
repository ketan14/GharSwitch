import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export interface Device {
    id: string;
    name: string;
    type: string;
    status?: 'ONLINE' | 'OFFLINE';
    metadata?: any;
    config?: any;
}

export function useDevices() {
    const { tenantId } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!tenantId) {
            setDevices([]);
            setLoading(false);
            return;
        }

        const devicesRef = collection(db, `tenants/${tenantId}/devices`);
        const q = query(devicesRef);

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
    }, [tenantId]);

    return { devices, loading, error };
}
