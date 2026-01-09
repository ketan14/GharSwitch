
import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin (Assumes you are running this locally with credentials)
// Usage: ts-node tools/migrate-device-access.ts

const serviceAccountKeyPath = path.resolve(__dirname, '../tools/service-account.json');

if (!require('fs').existsSync(serviceAccountKeyPath)) {
    console.error(`Error: Credential file not found at: ${serviceAccountKeyPath}`);
    console.error("Please export GOOGLE_APPLICATION_CREDENTIALS or place 'service-account.json' in the root.");
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(require(path.resolve(serviceAccountKeyPath)))
});

const db = admin.firestore();

async function migrate() {
    console.log("🚀 Starting Migration: Assigning ALL users to ALL devices for each tenant...");

    try {
        const tenantsSnap = await db.collection('tenants').get();
        console.log(`Found ${tenantsSnap.size} tenants.`);

        for (const tenantDoc of tenantsSnap.docs) {
            const tenantId = tenantDoc.id;
            console.log(`\nProcessing Tenant: ${tenantDoc.data().name} (${tenantId})`);

            // 1. Get All Devices
            const devicesSnap = await db.collection('tenants').doc(tenantId).collection('devices').get();
            if (devicesSnap.empty) {
                console.log("  - No devices found. Skipping.");
                continue;
            }

            // 2. Get All Members
            const membersSnap = await db.collection('tenants').doc(tenantId).collection('members').get();
            if (membersSnap.empty) {
                console.log("  - No members found. Skipping.");
                continue;
            }

            const memberIds = membersSnap.docs.map(doc => doc.id);
            console.log(`  - Found ${devicesSnap.size} devices and ${memberIds.length} members.`);

            const batch = db.batch();
            let opCount = 0;

            for (const deviceDoc of devicesSnap.docs) {
                const deviceId = deviceDoc.id;

                // A. Update Device Document (Array)
                // We overwrite assignedUsers with ALL current members
                const deviceRef = deviceDoc.ref;
                batch.update(deviceRef, {
                    assignedUsers: memberIds
                });
                opCount++;

                // B. Create Mapping Documents (Collection)
                for (const userId of memberIds) {
                    const mappingRef = db.collection('tenants').doc(tenantId).collection('device_users').doc(`${deviceId}_${userId}`);
                    batch.set(mappingRef, {
                        tenantId,
                        deviceId,
                        userId,
                        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
                        migrated: true
                    }, { merge: true });
                    opCount++;
                }
            }

            await batch.commit();
            console.log(`  - ✅ Successfully migrated ${devicesSnap.size} devices for this tenant.`);
        }

        console.log("\n🎉 Migration Complete!");

    } catch (error) {
        console.error("❌ Migration Failed:", error);
    }
}

migrate();
