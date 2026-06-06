import db from './db';

export function logAudit(
    userId: number | null,
    username: string | null,
    action: string,
    module: string,
    description: string,
    refType?: string,
    refId?: number
) {
    try {
        db.prepare(`
            INSERT INTO audit_log (user_id, username, action, module, description, ref_type, ref_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, username, action, module, description, refType || null, refId || null);
    } catch (error) {
        console.error("Audit Logging Error:", error);
    }
}
