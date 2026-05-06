import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import { AtombergApiClient } from '../services/atombergApi';
import { TokenService } from '../services/tokenService';
import { encrypt } from '../utils/encryption';
import { AtombergHub, FanDevice } from '@ghar-switch/domain-types';

const db = admin.firestore();

// Middleware to verify auth
const verifyAuth = (req: functions.https.Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new functions.https.HttpsError('unauthenticated', 'Missing or invalid token');
    }
    return admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
};

export const atombergLogin = functions.https.onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
        const decodedToken = await verifyAuth(req);
        const { apiKey, hubNickname } = req.body;
        
        if (!apiKey) return res.status(400).json({ success: false, error: { message: 'API Key is required' } });

        // Authenticate with Atomberg
        const authResponse = await AtombergApiClient.login(apiKey);

        const hubId = db.collection('users').doc(decodedToken.uid).collection('hubs').doc().id;
        
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

        await db.doc(`users/${decodedToken.uid}/hubs/${hubId}`).set(hubData);

        res.json({ success: true, data: { hubId } });
    } catch (error) {
        console.error('Atomberg Login Error:', error);
        res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Unknown error' } });
    }
});

export const atombergDiscover = functions.https.onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
        const decodedToken = await verifyAuth(req);
        const { hubId } = req.body;
        if (!hubId) return res.status(400).json({ success: false, error: { message: 'hubId is required' } });

        const accessToken = await TokenService.getValidAccessToken(decodedToken.uid, hubId);
        const devices = await AtombergApiClient.discoverDevices(accessToken);

        const batch = db.batch();
        const devicesRef = db.collection(`users/${decodedToken.uid}/devices`);

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
        console.error('Atomberg Discover Error:', error);
        res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Unknown error' } });
    }
});

export const atombergCommand = functions.https.onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
        const decodedToken = await verifyAuth(req);
        const { deviceId, hubId, payload } = req.body;

        if (!deviceId || !hubId || !payload) {
            return res.status(400).json({ success: false, error: { message: 'Missing parameters' } });
        }

        // Instead of calling Atomberg directly, we enqueue it in Firestore
        // The queue processor will handle rate limiting and API calls
        const queueRef = db.collection(`users/${decodedToken.uid}/commands`).doc();
        
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
        await db.doc(`users/${decodedToken.uid}/devices/${deviceId}/state/current`).update({
            ...payload,
            syncStatus: 'PENDING',
            source: 'USER',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, data: { commandId: queueRef.id } });
    } catch (error) {
        console.error('Atomberg Command Error:', error);
        res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Unknown error' } });
    }
});
