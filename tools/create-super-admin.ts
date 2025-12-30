import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables if needed, though usually we rely on GOOGLE_APPLICATION_CREDENTIALS
dotenv.config();

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !require('fs').existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("ERROR: strict mode requires a service account.");
    console.error("Please download 'service-account.json' from Firebase Console > Project Settings > Service Accounts");
    console.error("And place it in the root directory: " + path.resolve(__dirname, '..'));
    process.exit(1);
}

// Initialize Admin SDK
// If GOOGLE_APPLICATION_CREDENTIALS is set, it works automatically.
// Otherwise we try to load the file explicitly.
let app;
try {
    app = admin.initializeApp({
        credential: admin.credential.cert(SERVICE_ACCOUNT_PATH)
    });
} catch (e) {
    app = admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

async function createSuperAdmin() {
    const email = 'admin@gharswitch.com';
    const password = 'superuser123'; // Change this!

    console.log(`Creating Super Admin: ${email}...`);

    try {
        // 1. Create Auth User
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
            console.log("User exists, updating...");
        } catch (e) {
            userRecord = await auth.createUser({
                email,
                password,
                displayName: 'Super Admin'
            });
        }

        // 2. Set Custom Claims (The Magic)
        await auth.setCustomUserClaims(userRecord.uid, {
            role: 'super_admin'
        });
        console.log("✅ Custom Claims set: { role: 'super_admin' }");

        // 3. Create User Profile in Firestore
        await db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: email,
            displayName: 'Super Admin',
            role: 'super_admin',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log("✅ Firestore Profile created.");
        console.log(`\nSUCCESS! You can now login with:\nEmail: ${email}\nPassword: ${password}`);

    } catch (error) {
        console.error("FAILED:", error);
    }
}

createSuperAdmin();
