import { useState } from 'react';
import { functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';

export function useSuperAdmin() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setTenantStatus = async (tenantId: string, active: boolean, suspendedReason?: string) => {
        setLoading(true);
        setError(null);
        try {
            const func = httpsCallable(functions, 'setTenantStatus');
            await func({ tenantId, active, suspendedReason });
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const setDeviceGlobalStatus = async (deviceId: string, active: boolean) => {
        setLoading(true);
        setError(null);
        try {
            const func = httpsCallable(functions, 'setDeviceGlobalStatus');
            await func({ deviceId, active });
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const assignSubscriptionPlan = async (tenantId: string, plan: 'bronze' | 'silver' | 'gold') => {
        setLoading(true);
        setError(null);
        try {
            const func = httpsCallable(functions, 'assignSubscriptionPlan');
            await func({ tenantId, plan });
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const updatePlatformConfig = async (config: { maintenanceMode?: boolean, featureFlags?: any }) => {
        setLoading(true);
        setError(null);
        try {
            const func = httpsCallable(functions, 'updatePlatformConfig');
            await func(config);
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const setUserActiveStatus = async (userId: string, active: boolean) => {
        setLoading(true);
        setError(null);
        try {
            const func = httpsCallable(functions, 'setUserActiveStatus');
            await func({ userId, active });
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    return {
        setTenantStatus,
        setDeviceGlobalStatus,
        assignSubscriptionPlan,
        updatePlatformConfig,
        setUserActiveStatus,
        loading,
        error
    };
}
