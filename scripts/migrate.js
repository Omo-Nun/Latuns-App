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

main();
