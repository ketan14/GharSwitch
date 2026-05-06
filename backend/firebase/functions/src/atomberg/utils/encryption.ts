import * as crypto from 'crypto';

// Get encryption key from environment variable (ensure this is set in Firebase Secrets or config)
// e.g. process.env.ATOMBERG_ENCRYPTION_KEY
const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey(): Buffer {
    const key = process.env.ATOMBERG_ENCRYPTION_KEY || 'default_secret_key_needs_change_'; // 32 bytes minimum for production
    // Ensure key is 32 bytes for aes-256-cbc
    const hashedKey = crypto.createHash('sha256').update(String(key)).digest('base64').substring(0, 32);
    return Buffer.from(hashedKey, 'utf-8');
}

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
