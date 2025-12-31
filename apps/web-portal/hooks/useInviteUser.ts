import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export function useInviteUser() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const inviteUser = async (email: string, role: 'admin' | 'user') => {
        setLoading(true);
        setError(null);
        try {
            const inviteFunc = httpsCallable(functions, 'inviteUser');
            const result = await inviteFunc({ email, role });
            setLoading(false);
            return result.data;
        } catch (err: any) {
            console.error('Invite Error:', err);
            setError(err);
            setLoading(false);
            throw err;
        }
    };

    return { inviteUser, loading, error };
}
