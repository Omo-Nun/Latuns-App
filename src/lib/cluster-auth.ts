import crypto from 'crypto';

/**
 * Cluster Authentication Module
 * 
 * Provides HMAC-based authentication for inter-node API calls (demote, etc.)
 * Uses the shared ENCRYPTION_KEY as the HMAC secret — both nodes must have the same key.
 * Includes timestamp-based replay protection (30-second window).
 */

const HMAC_ALGORITHM = 'sha256';
const MAX_AGE_MS = 30_000; // 30 seconds — reject tokens older than this

function getSecret(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY is required for cluster authentication');
    }
    return key;
}

/**
 * Generate an HMAC cluster token for inter-node requests.
 * Include both `clusterToken` and `clusterTimestamp` in the request body.
 */
export function generateClusterToken(): { clusterToken: string; clusterTimestamp: string } {
    const timestamp = Date.now().toString();
    const hmac = crypto.createHmac(HMAC_ALGORITHM, getSecret());
    hmac.update(timestamp);
    const token = hmac.digest('hex');
    return { clusterToken: token, clusterTimestamp: timestamp };
}

/**
 * Verify an HMAC cluster token from a peer node request.
 * Returns `true` if valid and within the replay window, `false` otherwise.
 */
export function verifyClusterToken(token: string | undefined, timestamp: string | undefined): boolean {
    if (!token || !timestamp) {
        return false;
    }

    // Replay protection: reject tokens older than MAX_AGE_MS
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > MAX_AGE_MS) {
        console.warn(`Cluster token rejected: age ${tokenAge}ms exceeds ${MAX_AGE_MS}ms window`);
        return false;
    }

    // Verify HMAC signature
    const hmac = crypto.createHmac(HMAC_ALGORITHM, getSecret());
    hmac.update(timestamp);
    const expectedToken = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expectedToken, 'hex'));
    } catch {
        return false;
    }
}
