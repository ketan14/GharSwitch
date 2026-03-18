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

    const getDeviceAccessDetails = async (deviceId: string) => {
        setLoading(true);
        setError(null);
        try {
            const func = httpsCallable(functions, 'getDeviceAccessDetails');
            const result = await func({ deviceId });
            return { success: true, data: result.data };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const transferDeviceToTenant = async (deviceId: string, newTenantId: string) => {
        setLoading(true);
        setError(null);
        try {
            const func = httpsCallable(functions, 'transferDeviceToTenant');
            await func({ deviceId, newTenantId });
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const getUserDeviceAccess = async (userEmailOrId: string) => {
        setLoading(true);
        setError(null);
        try {
            const func = httpsCallable(functions, 'getUserDeviceAccess');
            const result = await func({ userEmailOrId });
            return { success: true, data: result.data };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const revokeUserDeviceAccess = async (userId: string, deviceId: string) => {
        setLoading(true);
        setError(null);
        try {
            const func = httpsCallable(functions, 'revokeUserDeviceAccess');
            await func({ userId, deviceId });
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
        getDeviceAccessDetails,
        transferDeviceToTenant,
        getUserDeviceAccess,
        revokeUserDeviceAccess,
        loading,
        error
    };
}
