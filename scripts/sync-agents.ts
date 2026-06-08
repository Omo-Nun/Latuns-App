// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { Client } from 'pg';

async function main() {
  const sqliteDb = new DatabaseSync(path.join(process.cwd(), 'data', 'latuns.db'));
  const pgClient = new Client('postgres://postgres:postgres@127.0.0.1:5433/latuns');
  await pgClient.connect();

  const agents = sqliteDb.prepare('SELECT id, role, image_url FROM agents').all();

  for (const agent of agents) {
    await pgClient.query(
      'UPDATE agents SET role = $1, image_url = $2 WHERE id = $3',
      [agent.role, agent.image_url, agent.id]
    );
  }

  console.log(`✅ Synced role and image_url for ${agents.length} agents`);
  await pgClient.end();
}

main();
