import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getActiveKey() {
    const key = process.env.ENCRYPTION_KEY;
    const isBuildPhase = process.argv.includes('build') || process.env.npm_lifecycle_event === 'build';
    
    if (!key) {
        if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
            throw new Error('FATAL: ENCRYPTION_KEY environment variable is missing in production. It must be a 64-character hex string.');
        }
        // Dev/Build fallback
        return '6c6174756e732d6572702d7365637265742d6b65792d323032362d30352d3130';
    }
    
    return key;
}

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(getActiveKey(), 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return IV + AuthTag + EncryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
    
    if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Invalid encrypted data format.'); 
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(getActiveKey(), 'hex'), iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}
