// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const dbPath = path.join(process.cwd(), 'data', 'latuns.db');
const legacyDb = new DatabaseSync(dbPath);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/latuns',
});

async function fixUsersAndRoles() {
  console.log('Connecting to Postgres...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fix staff_roles
    console.log('Updating staff_roles...');
    const roles = legacyDb.prepare('SELECT * FROM staff_roles').all() as any[];
    for (const r of roles) {
      await client.query(
        `INSERT INTO staff_roles (id, name) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [r.id, r.name]
      );
    }
    await client.query("SELECT setval(pg_get_serial_sequence('staff_roles', 'id'), COALESCE((SELECT MAX(id) FROM staff_roles), 1))");

    // 2. Fix users
    console.log('Updating users...');
    const users = legacyDb.prepare('SELECT * FROM users').all() as any[];
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, username, password_hash, staff_id, role_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET 
           username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           staff_id = EXCLUDED.staff_id,
           role_id = EXCLUDED.role_id`,
        [u.id, u.username, u.password_hash, u.staff_id, u.role_id, u.created_at ? new Date(u.created_at) : new Date()]
      );
    }
    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))");

    // 3. Fix permissions
    console.log('Updating permissions...');
    const permissions = legacyDb.prepare('SELECT * FROM permissions').all() as any[];
    for (const p of permissions) {
      await client.query(
        `INSERT INTO permissions (id, role_id, module, can_view, can_edit, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           role_id = EXCLUDED.role_id,
           module = EXCLUDED.module,
           can_view = EXCLUDED.can_view,
           can_edit = EXCLUDED.can_edit,
           can_delete = EXCLUDED.can_delete`,
        [p.id, p.role_id, p.module, p.can_view === 1, p.can_edit === 1, p.can_delete === 1]
      );
    }
    await client.query("SELECT setval(pg_get_serial_sequence('permissions', 'id'), COALESCE((SELECT MAX(id) FROM permissions), 1))");

    // 4. Fix sub_permissions
    console.log('Updating sub_permissions...');
    const subPerms = legacyDb.prepare('SELECT * FROM sub_permissions').all() as any[];
    for (const sp of subPerms) {
      await client.query(
        `INSERT INTO sub_permissions (id, role_id, module, sub_module, allowed)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           role_id = EXCLUDED.role_id,
           module = EXCLUDED.module,
           sub_module = EXCLUDED.sub_module,
           allowed = EXCLUDED.allowed`,
        [sp.id, sp.role_id, sp.module, sp.sub_module, sp.allowed === 1]
      );
    }
    await client.query("SELECT setval(pg_get_serial_sequence('sub_permissions', 'id'), COALESCE((SELECT MAX(id) FROM sub_permissions), 1))");

    // 5. Fix mail_accounts
    console.log('Updating mail_accounts...');
    const mailAccounts = legacyDb.prepare('SELECT * FROM mail_accounts').all() as any[];
    for (const m of mailAccounts) {
      await client.query(
        `INSERT INTO mail_accounts (id, user_id, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, email, password, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           imap_host = EXCLUDED.imap_host,
           imap_port = EXCLUDED.imap_port,
           imap_secure = EXCLUDED.imap_secure,
           smtp_host = EXCLUDED.smtp_host,
           smtp_port = EXCLUDED.smtp_port,
           smtp_secure = EXCLUDED.smtp_secure,
           email = EXCLUDED.email,
           password = EXCLUDED.password`,
        [
          m.id, m.user_id, m.imap_host, m.imap_port, m.imap_secure === 1,
          m.smtp_host, m.smtp_port, m.smtp_secure === 1, m.email, m.password,
          m.created_at ? new Date(m.created_at) : new Date()
        ]
      );
    }
    await client.query("SELECT setval(pg_get_serial_sequence('mail_accounts', 'id'), COALESCE((SELECT MAX(id) FROM mail_accounts), 1))");

    await client.query('COMMIT');
    console.log('Successfully updated all users, roles, permissions, and mail accounts!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to update:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

fixUsersAndRoles();
