import { Client } from 'pg';

async function main() {
  const c = new Client('postgres://postgres:postgres@127.0.0.1:5433/latuns');
  await c.connect();

  // Add missing columns
  await c.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Roof Estimator'`);
  await c.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS image_url TEXT`);
  console.log('✅ Added role and image_url columns to agents');

  await c.end();
}

main();
