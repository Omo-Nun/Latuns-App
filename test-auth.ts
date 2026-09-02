import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './src/lib/schema';
import { verifyPassword } from './src/lib/auth';
import { sql } from 'drizzle-orm';

dotenv.config();

async function testAuth() {
    console.log('Testing authentication...');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/latuns',
    });
    
    const db = drizzle(pool, { schema });

    try {
        const username = 'admin';
        const password = 'admin';

        console.log(`Looking up user: ${username}`);
        const result = await db.select().from(schema.users)
            .where(sql`LOWER(${schema.users.username}) = LOWER(${username.trim()})`)
            .limit(1);
            
        const user = result[0];

        if (!user) {
            console.log('❌ User not found in database.');
            return;
        }

        console.log(`✅ User found. ID: ${user.id}, Role ID: ${user.roleId}`);
        console.log(`Stored password hash: ${user.passwordHash}`);

        const isValid = verifyPassword(password.trim(), user.passwordHash);
        
        if (isValid) {
            console.log('✅ Password verification PASSED!');
        } else {
            console.log('❌ Password verification FAILED!');
        }

    } catch (e: any) {
        console.error('Error during test:', e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

testAuth();
