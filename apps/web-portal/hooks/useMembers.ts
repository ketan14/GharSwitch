import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export interface TenantMember {
    id: string;
    role: string;
    joinedAt: any;
    email?: string; // We'll need to fetch this or store it in the member doc
}

export function useMembers() {
    const { tenantId } = useAuth();
    const [members, setMembers] = useState<TenantMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!tenantId) {
            setMembers([]);
            setLoading(false);
            return;
        }

        const membersRef = collection(db, `tenants/${tenantId}/members`);
        const q = query(membersRef, orderBy('joinedAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const memberList: TenantMember[] = [];
                snapshot.forEach((doc) => {
                    memberList.push({
                        id: doc.id,
                        ...doc.data(),
                    } as TenantMember);
                });
                setMembers(memberList);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching members:', err);
                setError(err as Error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    return { members, loading, error };
}
