@echo off
title Latuns ERP - Start Services
echo Starting Latuns ERP containers...
docker-compose up -d

echo Waiting for PostgreSQL to initialize...
timeout /t 15 /nobreak >nul

echo Running database migrations...
call npm run migrate

echo Applying pg_hba.conf replication rules...
docker exec latuns_db bash -c "grep -q '0.0.0.0/0' /opt/bitnami/postgresql/conf/pg_hba.conf || echo 'host replication repl_user 0.0.0.0/0 md5' >> /opt/bitnami/postgresql/conf/pg_hba.conf"
docker exec latuns_db bash -c "PGPASSWORD=postgres psql -U postgres -c 'SELECT pg_reload_conf();'" >nul 2>&1

echo.
echo ========================================================
echo   Latuns ERP is running!
echo   Open the app and connect to this node.
echo ========================================================
