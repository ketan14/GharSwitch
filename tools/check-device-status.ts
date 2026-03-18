
import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

// Run from 'tools' directory or workspace root
const BASE_DIR = process.cwd().endsWith('tools') ? process.cwd() : resolve(process.cwd(), 'tools');

// Load .env from Root (../.env)
const envPath = resolve(BASE_DIR, '../.env');
if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        const serviceAccountPath = resolve(BASE_DIR, "service-account.json");
        if (!existsSync(serviceAccountPath)) {
            throw new Error(`Service account not found at ${serviceAccountPath}`);
        }

        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
            serviceAccount.project_id;

        const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
            `https://${projectId}-default-rtdb.firebaseio.com`;

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: projectId,
            databaseURL: databaseURL
        });

        console.log(`Initialized Admin SDK for ${projectId} with DB: ${databaseURL}`);

    } catch (e) {
        console.error("Initialization Error:", e);
        process.exit(1);
    }
}

const db = admin.database();

async function checkDeviceStatus() {
    console.log("Checking device status from Realtime Database...");

    try {
        // Fetch the root "tenants" node
        // Warning: If there are many tenants, this might be slow. 
        // For this project, it likely has few tenants.
        const tenantsRef = db.ref('tenants');
        const snapshot = await tenantsRef.once('value');

        if (!snapshot.exists()) {
            console.log("No tenants found in database.");
            return;
        }

        const tenants = snapshot.val();
        let foundDevices = false;

        console.log("\n------ Device Status Report ------");

        for (const tenantId in tenants) {
            const tenantData = tenants[tenantId];
            if (tenantData.presence) {
                console.log(`\nTenant: ${tenantId}`);
                for (const deviceId in tenantData.presence) {
                    foundDevices = true;
                    const presence = tenantData.presence[deviceId];
                    const status = presence.online ? "ONLINE" : "OFFLINE";
                    const lastSeen = presence.lastSeen ? new Date(presence.lastSeen).toLocaleString() : "Unknown";

                    console.log(`  - Device: ${deviceId}`);
                    console.log(`    Status: ${status}`);
                    console.log(`    Last Seen: ${lastSeen} (${presence.lastSeen})`);
                }
            }
        }

        if (!foundDevices) {
            console.log("\nNo devices found in 'presence' nodes.");
        }
        console.log("\n----------------------------------");

    } catch (error) {
        console.error("Error fetching device status:", error);
    }
}

checkDeviceStatus().then(() => {
    process.exit(0);
});
