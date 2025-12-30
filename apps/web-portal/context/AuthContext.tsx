import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useRouter } from 'next/router';

// Extended User type to include custom claims if needed locally
type UserRole = 'super_admin' | 'admin' | 'user' | 'tenant_admin' | null;

interface AuthContextType {
    user: User | null;
    role: UserRole;
    tenantId: string | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    tenantId: null,
    loading: true,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Force refresh token to get latest custom claims
                const tokenResult = await currentUser.getIdTokenResult(true);
                const claims = tokenResult.claims;

                setRole((claims.role as UserRole) || 'user'); // Default to user if undefined
                setTenantId((claims.tenantId as string) || null);
            } else {
                setRole(null);
                setTenantId(null);
                // Optional: Redirect to login if not on public page
                if (router.pathname !== '/login') {
                    router.push('/login');
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    const signOut = async () => {
        await firebaseSignOut(auth);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, role, tenantId, loading, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
