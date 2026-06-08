import { Client } from 'pg';

async function main() {
  const c = new Client('postgres://postgres:postgres@127.0.0.1:5433/latuns');
  await c.connect();

  const tables = [
    'clients', 'agents', 'staff_roles', 'users', 'permissions',
    'sub_permissions', 'mail_accounts', 'notifications', 'audit_log',
    'inventory_items', 'inventory_logs', 'company_assets', 'quotations',
    'quotation_items', 'payments', 'expenses', 'stock_requests',
    'stock_request_items', 'tasks',
  ];

  for (const t of tables) {
    try {
      await c.query(
        `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE(MAX(id), 1)) FROM ${t}`
      );
      console.log('✅ Reset sequence for', t);
    } catch (e: any) {
      console.log('⚠️ Skip', t, e.message);
    }
  }

  await c.end();
}

main();
