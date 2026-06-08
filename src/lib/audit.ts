import db from './db';
import { auditLog } from './schema';

export async function logAudit(
    userId: number | null,
    username: string | null,
    action: string,
    module: string,
    description: string,
    refType?: string,
    refId?: number
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
        });
    } catch (error) {
        console.error("Audit Logging Error:", error);
    }
}
