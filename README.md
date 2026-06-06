# Latuns ERP

Enterprise Resource Planning (ERP) platform for Quotations, Finances & Inventory Management, optimized for isolated local networks.

## Architecture Highlights
- **Framework**: Next.js 16 (App Router) / React 19
- **Database**: SQLite (Node 22 native `node:sqlite` module via `DatabaseSync`)
- **Zero-Terminal Administration**: Designed to be managed fully via the web UI without SSH access.
- **Node Redundancy**: Dual-node network setup (Primary / Standby) with one-click role handover.
- **Client-Side Encryption**: Database snapshot backups are encrypted using AES-256-GCM before transport.

## Installation (Production)

You can launch the application directly on Windows using the provided launcher, or via Docker for isolated containerization.

### Option A: Direct Execution (Windows)
1. Ensure Node.js 22+ is installed.
2. Copy `.env.example` to `.env` and configure your `ENCRYPTION_KEY`.
3. Run `npm install`
4. Run `npm run build`
5. Execute `start.bat` to launch the background daemon and UI server concurrently.

### Option B: Docker (Recommended)
1. Copy `.env.example` to `.env` and configure your `ENCRYPTION_KEY`.
2. Run `docker-compose up -d --build`
3. Access the dashboard at `http://localhost:3000`

## Production Notes
- **Never lose your `ENCRYPTION_KEY`**. Database snapshots created by the End of Day (COB) trigger cannot be decrypted without it.
- **Zero Cloud Dependency**: While heartbeat integration is provided via the daemon, the system will never lock or freeze if WAN/Cloud connectivity is lost. All statuses are buffered locally.
- **Database Location**: The primary database file is `latuns.db` in the root folder. Backups are pushed to the `backups/` directory.
