import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../apps/web-portal/.env.local' });

// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
});

const db = admin.firestore();

async function seedGlobalDevices() {
    console.log('Seeding global device registry...\n');

    const devices = [
        {
            deviceId: 'ESP32_DEMO_001',
            serialNumber: 'SN-2024-001',
            model: '4CH-RELAY-V1',
            secretHash: 'CLAIM_CODE_001', // In production, this should be a hash
            claimedBy: null
        },
        {
            deviceId: 'ESP32_DEMO_002',
            serialNumber: 'SN-2024-002',
            model: '4CH-RELAY-V1',
            secretHash: 'CLAIM_CODE_002',
            claimedBy: null
        },
        {
            deviceId: 'ESP32_DEMO_003',
            serialNumber: 'SN-2024-003',
            model: '4CH-RELAY-V1',
            secretHash: 'CLAIM_CODE_003',
            claimedBy: null
        }
    ];

    const batch = db.batch();

    for (const device of devices) {
        const docRef = db.collection('global_devices').doc(device.deviceId);
        batch.set(docRef, device);
        console.log(`✅ Added: ${device.deviceId} (Claim Code: ${device.secretHash})`);
    }

    await batch.commit();
    console.log('\n✅ Global device registry seeded successfully!');
    console.log('\nYou can now register these devices using the admin dashboard:');
    console.log('- Device ID: ESP32_DEMO_001, Claim Code: CLAIM_CODE_001');
    console.log('- Device ID: ESP32_DEMO_002, Claim Code: CLAIM_CODE_002');
    console.log('- Device ID: ESP32_DEMO_003, Claim Code: CLAIM_CODE_003');

    process.exit(0);
}

seedGlobalDevices().catch((error) => {
    console.error('Error seeding devices:', error);
    process.exit(1);
});
