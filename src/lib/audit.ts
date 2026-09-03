import db from './db';
import { auditLog } from './schema';

export async function logAudit(
    userId: number | null,
    username: string | null,
    action: string,
    module: string,
    description: string,
    refType?: string,
    refId?: number,
    options?: { beforeData?: object; afterData?: object; entityType?: string; entityId?: number }
) {
    try {
        await db.insert(auditLog).values({
            userId,
            username,
            action,
            module,
            description,
            refType: refType || null,
            refId: refId || null,
            entityType: options?.entityType || null,
            entityId: options?.entityId || null,
            beforeData: options?.beforeData ? JSON.stringify(options.beforeData) : null,
            afterData: options?.afterData ? JSON.stringify(options.afterData) : null,
        });
    } catch (error) {
        console.error("Audit Logging Error:", error);
    }
}
