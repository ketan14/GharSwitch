
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
        // Look for service-account.json in the tools dir
        const serviceAccountPath = resolve(BASE_DIR, "service-account.json");
        if (!existsSync(serviceAccountPath)) {
            throw new Error(`Service account not found at ${serviceAccountPath}`);
        }

        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

        // Try to find Project ID from multiple sources
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
            process.env.GCLOUD_PROJECT ||
            process.env.FIREBASE_PROJECT_ID ||
            serviceAccount.project_id;

        if (!projectId) {
            console.warn("⚠️ Warning: Project ID could not be determined from env or service account.");
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: projectId
        });
    } catch (e) {
        console.error("Initialization Error:", e);
        console.log("Attempting default credentials...");
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function setDeviceSecret(deviceId: string, secret: string) {
    console.log(`Configuring device: ${deviceId} with secret...`);

    const deviceRef = db.collection('global_devices').doc(deviceId);

    // Check if device exists
    const snap = await deviceRef.get();

    if (!snap.exists) {
        console.log("⚠️ Device does not exist in global_devices. Creating it...");
        await deviceRef.set({
            active: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            model: "PICO_W_SWITCH_4CH",
            sharedSecret: secret,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log("✅ Created new device record with secret.");
    } else {
        await deviceRef.update({
            sharedSecret: secret,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Updated existing device with new secret (sharedSecret).");
    }
}

// === CLI ARGS ===
const args = process.argv.slice(2);
const DEVICE_ID = args[0];
const SECRET = args[1];

if (!DEVICE_ID || !SECRET) {
    console.error("\nUsage: npm run set-device-secret -- <DEVICE_ID> <SECRET>");
    console.error("Example: npm run set-device-secret -- PICO_001 my-password-123\n");
    process.exit(1);
}

setDeviceSecret(DEVICE_ID, SECRET)
    .then(() => {
        console.log("Done.");
        process.exit(0);
    })
    .catch(err => {
        console.error("Error:", err);
        process.exit(1);
    });
