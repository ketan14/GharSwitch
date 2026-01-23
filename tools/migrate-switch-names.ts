import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize with service account
const serviceAccountPath = path.join(__dirname, 'service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
});

const db = admin.firestore();

async function migrate() {
    console.log('🚀 Starting Switch Names Migration...');

    try {
        // 1. Get all tenants
        const tenantsSnap = await db.collection('tenants').get();
        console.log(`Found ${tenantsSnap.size} tenants.`);

        let totalUpdated = 0;

        for (const tenantDoc of tenantsSnap.docs) {
            const tenantId = tenantDoc.id;
            console.log(`\nProcessing Tenant: ${tenantId}`);

            // 2. Get all devices for this tenant
            const devicesSnap = await db.collection('tenants').doc(tenantId).collection('devices').get();
            console.log(`  Found ${devicesSnap.size} devices.`);

            for (const deviceDoc of devicesSnap.docs) {
                const deviceData = deviceDoc.data();
                const deviceId = deviceDoc.id;

                // 3. Check if switchNames already exists
                if (!deviceData.switchNames || !Array.isArray(deviceData.switchNames)) {
                    console.log(`  Updating Device: ${deviceId}...`);

                    await deviceDoc.ref.update({
                        switchNames: ['Switch 1', 'Switch 2', 'Switch 3', 'Switch 4'],
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    totalUpdated++;
                } else {
                    console.log(`  Device: ${deviceId} already has switchNames. Skipping.`);
                }
            }
        }

        console.log('\n✅ Migration Complete!');
        console.log(`Total devices updated: ${totalUpdated}`);
    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
