const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/latuns',
});

async function syncSequences() {
  const tables = [
    'inventory_items',
    'clients',
    'agents',
    'quotations',
    'quotation_items',
    'payments',
    'tasks',
    'inventory_logs',
    'expenses',
    'stock_requests',
    'stock_request_items',
    'company_assets',
    'staff_roles',
    'users',
    'permissions',
    'mail_accounts',
    'notifications',
    'audit_log',
    'sub_permissions',
    'custom_charts',
    'activity_logs'
  ];

  for (const table of tables) {
    try {
      await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
      console.log(`Synced sequence for ${table}`);
    } catch (e) {
      console.log(`Error syncing ${table}:`, e.message);
    }
  }

  await pool.end();
}

syncSequences();
