import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { onRequest, HttpsError, Request } from 'firebase-functions/v2/https';
import { AtombergApiClient } from '../services/atombergApi';
import { TokenService } from '../services/tokenService';
import { encrypt } from '../utils/encryption';
import { AtombergHub, FanDevice } from '@ghar-switch/domain-types';

// Middleware to verify auth
const verifyAuth = async (req: Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new HttpsError('unauthenticated', 'Missing or invalid token');
    }
    return await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
};

export const atombergLogin = onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        const decodedToken = await verifyAuth(req);
        const { apiKey, hubNickname } = req.body;

        if (!apiKey) {
            res.status(400).json({ success: false, error: { message: 'API Key is required' } });
            return;
        }

        // Authenticate with Atomberg
        const authResponse = await AtombergApiClient.login(apiKey);

        const hubId = admin.firestore().collection('users').doc(decodedToken.uid).collection('hubs').doc().id;

        const hubData: AtombergHub = {
            id: hubId,
            nickname: hubNickname || 'My Atomberg Hub',
            type: 'ATOMBERG',
            apiKeyEncrypted: encrypt(apiKey),
            refreshTokenEncrypted: encrypt(authResponse.refreshToken),
            accessToken: authResponse.accessToken,
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + authResponse.expiresIn * 1000),
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await admin.firestore().doc(`users/${decodedToken.uid}/hubs/${hubId}`).set(hubData);

        res.json({ success: true, data: { hubId } });
    } catch (error) {
        logger.error('Atomberg Login Error:', error);
        res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Unknown error' } });
    }
});

export const atombergDiscover = onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        const decodedToken = await verifyAuth(req);
        const { hubId } = req.body;
        if (!hubId) {
            res.status(400).json({ success: false, error: { message: 'hubId is required' } });
            return;
        }

        const accessToken = await TokenService.getValidAccessToken(decodedToken.uid, hubId);
        const devices = await AtombergApiClient.discoverDevices(accessToken);

        const batch = admin.firestore().batch();
        const devicesRef = admin.firestore().collection(`users/${decodedToken.uid}/devices`);

        const discoveredDevices: FanDevice[] = [];

        for (const ad of devices) {
            const deviceId = `${hubId}_${ad.id}`;
            const deviceRef = devicesRef.doc(deviceId);

            const fanDevice: FanDevice = {
                id: deviceId,
                hubId,
                atombergDeviceId: ad.id,
                provider: 'ATOMBERG',
                type: 'FAN',
                name: ad.name,
                room: ad.room,
                online: true,
                capabilities: {
                    powerControl: ad.capabilities.power,
                    speedControl: ad.capabilities.speed
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            batch.set(deviceRef, fanDevice, { merge: true });

            // Set initial state
            const stateRef = deviceRef.collection('state').doc('current');
            batch.set(stateRef, {
                power: false,
                speed: 1,
                syncStatus: 'SYNCED',
                source: 'SYNC',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            discoveredDevices.push(fanDevice);
        }

        await batch.commit();

        res.json({ success: true, data: { devices: discoveredDevices } });
    } catch (error) {
        logger.error('Atomberg Discover Error:', error);
        res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Unknown error' } });
    }
});

export const atombergCommand = onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        const decodedToken = await verifyAuth(req);
        const { deviceId, hubId, payload } = req.body;

        if (!deviceId || !hubId || !payload) {
            res.status(400).json({ success: false, error: { message: 'Missing parameters' } });
            return;
        }

        // Instead of calling Atomberg directly, we enqueue it in Firestore
        // The queue processor will handle rate limiting and API calls
        const queueRef = admin.firestore().collection(`users/${decodedToken.uid}/commands`).doc();

        await queueRef.set({
            deviceId,
            hubId,
            provider: 'ATOMBERG',
            payload,
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Optimistically update the current state to PENDING
        await admin.firestore().doc(`users/${decodedToken.uid}/devices/${deviceId}/state/current`).update({
            ...payload,
            syncStatus: 'PENDING',
            source: 'USER',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, data: { commandId: queueRef.id } });
    } catch (error) {
        logger.error('Atomberg Command Error:', error);
        res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Unknown error' } });
    }
});
