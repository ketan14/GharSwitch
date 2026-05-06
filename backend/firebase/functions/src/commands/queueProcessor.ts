import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { TokenService } from '../atomberg/services/tokenService';
import { AtombergApiClient } from '../atomberg/services/atombergApi';

const db = admin.firestore();

export const processCommandQueue = functions.firestore.onDocumentCreated(
    'users/{uid}/commands/{commandId}',
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const command = snapshot.data();
        const { uid, commandId } = event.params;

        if (command.provider !== 'ATOMBERG') {
            // Not for us
            return;
        }

        const { deviceId, hubId, payload } = command;
        
        try {
            // 1. Update queue status to PROCESSING
            await snapshot.ref.update({ status: 'PROCESSING', updatedAt: admin.firestore.FieldValue.serverTimestamp() });

            // 2. Get Device details
            const deviceRef = db.doc(`users/${uid}/devices/${deviceId}`);
            const deviceDoc = await deviceRef.get();
            if (!deviceDoc.exists) throw new Error('Device not found');
            const atombergDeviceId = deviceDoc.data()?.atombergDeviceId;

            // 3. Get valid token
            const accessToken = await TokenService.getValidAccessToken(uid, hubId);

            // 4. Send API command
            const success = await AtombergApiClient.sendCommand(accessToken, atombergDeviceId, payload);

            if (!success) throw new Error('API returned failure');

            // 5. Update Device State to SYNCED
            await deviceRef.collection('state').doc('current').update({
                syncStatus: 'SYNCED',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 6. Update Queue status to COMPLETED
            await snapshot.ref.update({ status: 'COMPLETED', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            
            // Optionally, delete the command to save space
            // await snapshot.ref.delete();

        } catch (error) {
            console.error(`Command ${commandId} Failed:`, error);
            
            // Revert state to FAILED
            await db.doc(`users/${uid}/devices/${deviceId}/state/current`).update({
                syncStatus: 'FAILED',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            await snapshot.ref.update({ 
                status: 'FAILED', 
                error: error instanceof Error ? error.message : 'Unknown error',
                updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
        }
    }
);
