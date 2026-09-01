#!/bin/sh
echo "Skipping database migrations (run externally)..."
# node scripts/migrate.js

echo "Starting Latuns ERP Daemon..."
node scripts/heartbeat.js &

echo "Starting Latuns ERP Next.js Server..."
exec node server.js
