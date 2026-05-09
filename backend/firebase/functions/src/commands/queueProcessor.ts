import { logger } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { TokenService } from '../atomberg/services/tokenService';
import { AtombergApiClient } from '../atomberg/services/atombergApi';



export const processCommandQueue = onDocumentCreated('users/{uid}/commands/{commandId}', async (event) => {
    if (!event.data) return;
    
    const { uid, commandId } = event.params;
    const command = event.data.data();

    if (!command) return;

        if (command.provider !== 'ATOMBERG') {
            // Not for us
            return;
        }

        const { deviceId, hubId, payload } = command;
        
        try {
            // 1. Update queue status to PROCESSING
            await event.data.ref.update({ status: 'PROCESSING', updatedAt: admin.firestore.FieldValue.serverTimestamp() });

            // 2. Get Device details
            const deviceRef = admin.firestore().doc(`users/${uid}/devices/${deviceId}`);
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
            await event.data.ref.update({ status: 'COMPLETED', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            
            // Optionally, delete the command to save space
            // await event.data.ref.delete();

        } catch (error) {
            logger.error(`Command ${commandId} Failed:`, error);
            
            // Revert state to FAILED
            await admin.firestore().doc(`users/${uid}/devices/${deviceId}/state/current`).update({
                syncStatus: 'FAILED',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            await event.data.ref.update({ 
                status: 'FAILED', 
                error: error instanceof Error ? error.message : 'Unknown error',
                updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
        }
    }
);
