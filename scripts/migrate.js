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
        await migrate(db, { migrationsFolder });
        console.log("Database migrations completed successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
