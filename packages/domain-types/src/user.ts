export type UserRole = 'super_admin' | 'admin' | 'user';

export interface Tenant {
    id: string;
    name: string;
    planId: 'bronze' | 'silver' | 'gold';
    subscriptionStatus: 'active' | 'past_due' | 'canceled';
    maxDevices: number;
    maxUsers: number;
    createdAt: any; // Firestore Timestamp
}

export interface User {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    tenantId: string;
    disabled: boolean;
    createdAt: any;
}

export interface CustomClaims {
    role: UserRole;
    tenantId: string;
}
