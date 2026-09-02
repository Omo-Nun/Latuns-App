require('dotenv').config();
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const path = require('path');

async function main() {
    console.log("Starting database migration...");
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/latuns',
    });

    const db = drizzle(pool);
    const migrationsFolder = path.join(process.cwd(), 'drizzle');

    try {
        // Check if database is in standby (read-only) recovery mode
        const recoveryResult = await pool.query('SELECT pg_is_in_recovery() as in_recovery');
        if (recoveryResult.rows[0] && recoveryResult.rows[0].in_recovery) {
            console.log("PostgreSQL engine is in standby (read-only) mode. Skipping migration writes.");
            return;
        }

        await migrate(db, { migrationsFolder });
        console.log("Database migrations completed successfully.");

        await seedIfEmpty(pool);
    } catch (error) {
        console.error("Migration failed:", error);
        // Don't crash container startup if migration fails due to read-only or lock
        if (error.message && (error.message.includes('read-only') || error.message.includes('cannot execute'))) {
            console.warn("Database is read-only, continuing application startup...");
            return;
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

async function seedIfEmpty(pool) {
    try {
        const userCheck = await pool.query('SELECT count(*) as count FROM users');
        if (parseInt(userCheck.rows[0].count, 10) > 0) {
            return;
        }

        console.log("No users found in PostgreSQL. Checking for legacy SQLite database to seed...");
        const fs = require('fs');
        const legacyDbPath = path.join(process.cwd(), 'data', 'latuns.db');
        if (fs.existsSync(legacyDbPath)) {
            try {
                const { DatabaseSync } = require('node:sqlite');
                const legacyDb = new DatabaseSync(legacyDbPath);

                const roles = legacyDb.prepare('SELECT * FROM staff_roles').all();
                for (const r of roles) {
                    await pool.query(
                        'INSERT INTO staff_roles (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
                        [r.id, r.name]
                    );
                }
                await pool.query("SELECT setval(pg_get_serial_sequence('staff_roles', 'id'), COALESCE((SELECT MAX(id) FROM staff_roles), 1))");

                const users = legacyDb.prepare('SELECT * FROM users').all();
                for (const u of users) {
                    await pool.query(
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
                await pool.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))");

                console.log(`Seeded ${users.length} users and ${roles.length} roles from SQLite database.`);
                return;
            } catch (seedErr) {
                console.warn("Could not import from SQLite:", seedErr.message);
            }
        }

        // Fallback: seed default admin user
        console.log("Seeding default admin user (admin / admin)...");
        await pool.query("INSERT INTO staff_roles (id, name) VALUES (4, 'Admin') ON CONFLICT (id) DO NOTHING");
        await pool.query(`
            INSERT INTO users (username, password_hash, role_id)
            VALUES ('admin', 'scrypt:f5faabcf611c85b111185ca6205f3d4a:7ea053c982989652458bbdd9a69fe4c70085086798e15dc8e44868004d01e059aeb41166374aef9433f86b388a5e1477d60bb7c9c25a93b2df4fde459ef304cb', 4)
            ON CONFLICT (username) DO NOTHING
        `);
        console.log("Default admin user created.");
    } catch (e) {
        console.warn("Error checking or seeding users:", e.message);
    }
}

main();
