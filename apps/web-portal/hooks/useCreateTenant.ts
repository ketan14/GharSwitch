import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface CreateTenantRequest {
    tenantName: string;
    adminEmail: string;
    adminPassword: string;
    tier?: 'BASIC' | 'PRO';
}

interface CreateTenantResponse {
    success: boolean;
    tenantId: string;
    adminUid: string;
    adminEmail: string;
    message: string;
}

export function useCreateTenant() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const createTenant = async (
        tenantName: string,
        adminEmail: string,
        adminPassword: string,
        tier: 'BASIC' | 'PRO' = 'BASIC'
    ) => {
        setLoading(true);
        setError(null);

        try {
            const createTenantFn = httpsCallable<CreateTenantRequest, CreateTenantResponse>(
                functions,
                'createTenant'
            );

            const result = await createTenantFn({
                tenantName,
                adminEmail,
                adminPassword,
                tier,
            });

            setLoading(false);
            return result.data;
        } catch (err) {
            console.error('Error creating tenant:', err);
            setError(err as Error);
            setLoading(false);
            throw err;
        }
    };

    return { createTenant, loading, error };
}
