// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from '../src/lib/schema';

dotenv.config();

const dbPath = path.join(process.cwd(), 'data', 'latuns.db');
const legacyDb = new DatabaseSync(dbPath);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/latuns',
});
const pgDb = drizzle(pool, { schema });

async function migrateData() {
  console.log('Starting data migration...');

  try {
    // Determine tables to migrate, ideally ordered by dependency
    const tables = [
      { name: 'settings', schema: schema.settings },
      { name: 'clients', schema: schema.clients },
      { name: 'agents', schema: schema.agents },
      { name: 'staff_roles', schema: schema.staffRoles },
      { name: 'users', schema: schema.users },
      { name: 'permissions', schema: schema.permissions },
      { name: 'sub_permissions', schema: schema.subPermissions },
      { name: 'sessions', schema: schema.sessions },
      { name: 'mail_accounts', schema: schema.mailAccounts },
      { name: 'notifications', schema: schema.notifications },
      { name: 'audit_log', schema: schema.auditLog },
      { name: 'inventory_items', schema: schema.inventoryItems },
      { name: 'inventory_logs', schema: schema.inventoryLogs },
      { name: 'company_assets', schema: schema.companyAssets },
      { name: 'quotations', schema: schema.quotations },
      { name: 'quotation_items', schema: schema.quotationItems },
      { name: 'payments', schema: schema.payments },
      { name: 'expenses', schema: schema.expenses },
      { name: 'stock_requests', schema: schema.stockRequests },
      { name: 'stock_request_items', schema: schema.stockRequestItems },
      { name: 'tasks', schema: schema.tasks },
      { name: 'activity_logs', schema: schema.activityLogs },
      { name: 'custom_charts', schema: schema.customCharts },
    ];

    for (const table of tables) {
      console.log(`Migrating table: ${table.name}...`);
      
      try {
        const rows = legacyDb.prepare(`SELECT * FROM ${table.name}`).all();
        
        if (rows.length > 0) {
          // Convert date strings to Date objects or handle boolean mapping if needed
          const mappedRows = rows.map((row: any) => {
            const mapped: any = {};
            for (const key of Object.keys(row)) {
              let value = row[key];
              
              // Find the Drizzle schema column name matching this SQLite column
              const colName = Object.keys(table.schema).find(k => (table.schema as any)[k].name === key);
              if (colName) {
                const colDef = (table.schema as any)[colName];
                const colType = colDef.dataType;
                const columnType = colDef.columnType;
                
                // SQLite stores booleans as 1/0
                if (colType === 'boolean' && typeof value === 'number') {
                  value = value === 1;
                }
                // SQLite stores dates as strings or unix timestamps — coerce to Date
                if ((colType === 'date' || columnType === 'PgTimestamp') && value !== null && value !== undefined) {
                  const d = new Date(value);
                  value = isNaN(d.getTime()) ? null : d;
                }
                mapped[colName] = value;
              }
            }
            return mapped;
          });

          // Insert into Postgres row by row to catch orphans
          let successCount = 0;
          for (const row of mappedRows) {
            try {
              await pgDb.insert(table.schema as any).values(row).onConflictDoNothing();
              successCount++;
            } catch (err: any) {
              console.log(`⚠️ Skipped row in ${table.name} due to error: ${err.message}`);
            }
          }
          console.log(`✅ Migrated ${successCount}/${rows.length} rows to ${table.name}`);
        } else {
          console.log(`- Table ${table.name} is empty.`);
        }
      } catch (e: any) {
        if (e.message.includes('no such table')) {
          console.log(`⚠️ Table ${table.name} not found in legacy DB, skipping.`);
        } else {
          console.error(`❌ Error migrating ${table.name}:`, e);
        }
      }
    }

    console.log('Syncing PostgreSQL sequences...');
    for (const table of tables) {
      try {
        await pgDb.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${table.name}', 'id'), COALESCE(MAX(id), 1)) FROM ${table.name}`));
        console.log(`Synced sequence for ${table.name}`);
      } catch (e: any) {
        // Some tables might not have 'id' sequence, skip silently or log
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Fatal Migration Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrateData();
