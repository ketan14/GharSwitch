import * as admin from 'firebase-admin';
import { AtombergHub } from '@ghar-switch/domain-types';
import { decrypt, encrypt } from '../utils/encryption';
import { AtombergApiClient } from './atombergApi';

// Ensure admin is initialized in index.ts

export class TokenService {
    /**
     * Gets a valid access token. If the current token is missing or near expiration,
     * it refreshes the token safely using a Firestore distributed lock.
     */
    static async getValidAccessToken(uid: string, hubId: string): Promise<string> {
        const hubRef = admin.firestore().collection(`users/${uid}/hubs`).doc(hubId);

        // 1. Check current token
        const hubDoc = await hubRef.get();
        if (!hubDoc.exists) throw new Error('Hub not found');

        const hubData = hubDoc.data() as AtombergHub;
        if (!hubData.isActive) throw new Error('Hub is not active');

        const now = Date.now();
        // If we have a token and it expires in more than 5 minutes (300,000 ms)
        if (hubData.accessToken && hubData.expiresAt && (hubData.expiresAt.toMillis() - now > 300000)) {
            return hubData.accessToken;
        }

        // 2. Token is missing or expiring soon. Acquire Refresh Lock.
        const lockRef = admin.firestore().collection('locks').doc(`atomberg_${hubId}`);

        return await admin.firestore().runTransaction(async (transaction) => {
            const lockDoc = await transaction.get(lockRef);

            // If lock exists and was acquired less than 30 seconds ago, another process is refreshing.
            // Ideally we'd wait/retry, but for simplicity we throw or return a cached token if available.
            if (lockDoc.exists) {
                const lockedAt = lockDoc.data()?.lockedAt?.toMillis() || 0;
                if (now - lockedAt < 30000) {
                    // Try to re-fetch hub data in case it just finished
                    const latestHubDoc = await transaction.get(hubRef);
                    const latestHubData = latestHubDoc.data() as AtombergHub;
                    if (latestHubData.accessToken && latestHubData.expiresAt && (latestHubData.expiresAt.toMillis() - now > 0)) {
                        return latestHubData.accessToken;
                    }
                    throw new Error('Token refresh currently in progress by another process. Please try again.');
                }
            }

            // Acquire Lock
            transaction.set(lockRef, { lockedAt: admin.firestore.Timestamp.now() });

            // Fetch the refreshToken securely
            const refreshToken = decrypt(hubData.refreshTokenEncrypted);

            try {
                // Call API
                const authResponse = await AtombergApiClient.refreshToken(refreshToken);

                // Encrypt potentially new refresh token if it rotated
                const newRefreshTokenEncrypted = encrypt(authResponse.refreshToken);

                // Update Hub Document
                const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + (authResponse.expiresIn * 1000));

                transaction.update(hubRef, {
                    accessToken: authResponse.accessToken,
                    refreshTokenEncrypted: newRefreshTokenEncrypted,
                    expiresAt: expiresAt,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Release Lock
                transaction.delete(lockRef);

                return authResponse.accessToken;
            } catch (error) {
                // Release Lock on failure
                transaction.delete(lockRef);
                throw new Error(`Failed to refresh Atomberg token: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
}
