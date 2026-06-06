# Latuns ERP — Production Finalization Plan

Resolve every issue discovered in the production readiness assessment: compile failures, security gaps, dead code, mocked infrastructure, and missing middleware.

---

## User Review Required

> [!IMPORTANT]
> **Database engine decision.** The architecture spec calls for PostgreSQL Streaming Replication, but the entire codebase currently runs on SQLite via `node:sqlite`. This plan **keeps SQLite as the production database** and adapts the cluster/backup subsystem to work with it (SQLite `.backup()` API + file-based replication). Migrating to PostgreSQL would be a separate, much larger project. Please confirm this is acceptable.

> [!IMPORTANT]
> **Syncthing integration.** Full programmatic Syncthing daemon management (auto-start binary, peer discovery, REST API auth handshake) is a complex systems-programming effort. This plan wires the Node Management panel to **real SQLite backup + file-copy operations** over local network paths, but defers Syncthing binary orchestration to a future phase. Please confirm.

## Open Questions

> [!WARNING]
> **Cloud backup destination.** The `/api/cluster/backup` route currently mocks a `gsutil cp` push to Google Cloud Storage. Should I wire this to a real GCS bucket (requires a service account key JSON and `GOOGLE_APPLICATION_CREDENTIALS`), or keep it as an encrypted local-export-to-folder flow for now?

> [!WARNING]
> **Heartbeat Cloud Function.** `scripts/heartbeat.js` pings a placeholder URL. Do you have a deployed Google Cloud Function endpoint, or should I create the Cloud Function code as well?

---

## Proposed Changes

### Phase 1 — Critical Build Fix
*Unblocks `npm run build` immediately.*

#### [MODIFY] [route.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/app/api/cluster/backup/route.ts)
- Change `import { encryptData } from '@/lib/encryption'` → `import { encrypt } from '@/lib/encryption'`
- Change `encryptData(mockSqlData)` → `encrypt(mockSqlData)` on line 27
- This is the **only** compile error blocking `npm run build`.

---

### Phase 2 — Security Hardening

#### [MODIFY] [encryption.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/lib/encryption.ts)
- Remove the hardcoded fallback encryption key on line 9.
- Read `ENCRYPTION_KEY` strictly from `process.env.ENCRYPTION_KEY`.
- Throw a clear startup error if the env var is missing, preventing the app from silently running with a publicly-visible key.

#### [MODIFY] [login route.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/app/api/auth/login/route.ts)
- Add **rate limiting** — track failed login attempts per IP using an in-memory map with a 15-minute sliding window. Lock out after 5 consecutive failures.
- Increase minimum password length enforcement from 4 → **8 characters** (applies to password change endpoint too).

#### [MODIFY] [auth.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/lib/auth.ts)
- Add a `SESSION_MAX_AGE` constant and reduce session TTL from 30 days to **7 days** for production safety.
- Add session-pruning logic: on each `getSession()` call, delete all expired sessions for that user to prevent table bloat over time.

#### [NEW] [.env.example](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/.env.example)
- Document all required environment variables:
  - `ENCRYPTION_KEY` (64 hex chars)
  - `HEARTBEAT_ENDPOINT` (Cloud Function URL)
  - `NODE_NAME` (e.g. "Node Alpha")
  - `NODE_ROLE` (Primary | Standby)
  - `NODE_ENV` (production)
- This file is committed to source control; actual `.env` is gitignored (already handled).

---

### Phase 3 — Middleware & Auth Gate

#### [NEW] [middleware.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/middleware.ts)
- The existing `src/proxy.ts` contains correct auth-gate logic but **Next.js never loads it** because middleware must be named `middleware.ts` (not `proxy.ts`).
- Create a proper `src/middleware.ts` that:
  - Allows `/_next`, `/api/auth`, static assets, and `/favicon.ico` through.
  - Redirects unauthenticated users to `/login`.
  - Redirects authenticated users away from `/login` to `/`.
  - Uses the same `matcher` config from the existing proxy file.

#### [DELETE] [proxy.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/proxy.ts)
- Remove the dead file after its logic is moved into `middleware.ts`.

---

### Phase 4 — Cluster Infrastructure (Real Operations)

#### [MODIFY] [backup route.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/app/api/cluster/backup/route.ts)
- Replace the mock SQL dump with a **real SQLite backup** using `node:sqlite`'s `DatabaseSync` backup capabilities or the `VACUUM INTO` SQL command to produce a timestamped `.db` snapshot file.
- Encrypt the snapshot file using the existing `encrypt()` function.
- Write the encrypted backup to a configurable output directory (e.g. `./backups/`).
- Add audit logging for backup events.

#### [MODIFY] [handover route.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/app/api/cluster/handover/route.ts)
- Replace the `setTimeout` mock with real operations:
  1. Trigger a SQLite backup (reuse backup logic) as a safety snapshot before handover.
  2. Write the current node's role change to the `settings` table (`nodeRole = 'Standby'`).
  3. Return the new role state so the UI can reflect it.
- Guard behind `requirePermission('Settings', 'can_edit')` + Admin role check.

#### [MODIFY] [NodeManagementPanel.tsx](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/app/settings/components/NodeManagementPanel.tsx)
- Replace hardcoded node state with **real data** fetched from a new `/api/cluster/status` endpoint.
- Wire the `[Take Over as Primary]` button to actually call `/api/cluster/handover`.
- Wire the `[End Day]` button to actually call `/api/cluster/backup`.
- Add loading spinners and success/error toast notifications instead of `alert()`.
- Display the last backup timestamp.

#### [NEW] [status route.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/app/api/cluster/status/route.ts)
- New `GET` endpoint that reads node metadata from the `settings` table (`nodeName`, `nodeRole`, `nodeIp`, `lastBackup`, `lastHeartbeat`).
- Returns the structured cluster state JSON consumed by `NodeManagementPanel`.

#### [MODIFY] [heartbeat.js](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/scripts/heartbeat.js)
- Add a `setInterval` loop (every 30 minutes) so the script runs as a persistent background daemon, not a one-shot execution.
- Add graceful shutdown handling (`SIGINT`, `SIGTERM`).
- Read endpoint URL from env vars (already partially done).

#### [MODIFY] [start-latuns-erp-production.bat](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/start-latuns-erp-production.bat)
- Add a line to start `scripts/heartbeat.js` as a background process alongside the Next.js server.
- Load environment variables from `.env` before starting services.

---

### Phase 5 — Workspace Cleanup

#### [DELETE] Root-level throwaway scripts
The following files are one-off migration/refactor scripts that should not ship to production. They will be **moved to a `scripts/archive/` directory** rather than deleted outright, preserving history:

| File | Reason |
|:-----|:-------|
| `check_db.js` | One-off DB inspector |
| `fix_scroll_jump.js` | One-off UI patch script |
| `migrate.js` | Superseded by `db.ts` auto-migrations |
| `migrate_revised.js` | Superseded by `db.ts` auto-migrations |
| `polish_finances_phase3.js` | One-off polish script |
| `polish_mail_phase3.js` | One-off polish script |
| `polish_ui.js` | One-off polish script |
| `polish_ui_v2.js` | One-off polish script |
| `refactor_clients.js` | One-off refactor script |
| `refactor_estimator_profile.js` | One-off refactor script |
| `refactor_finances.js` | One-off refactor script |
| `refactor_finances.py` | One-off refactor script (Python) |
| `refactor_insights.js` | One-off refactor script |
| `refactor_inventory.js` | One-off refactor script |
| `refactor_inventory_catalog.js` | One-off refactor script |
| `refactor_inventory_store.js` | One-off refactor script |
| `refactor_inventory_tabs.js` | One-off refactor script |
| `refactor_mail.js` | One-off refactor script |
| `refactor_settings.js` | One-off refactor script |
| `refactor_sidebar.js` | One-off refactor script |
| `refactor_staff.js` | One-off refactor script |
| `refactor_tasks.js` | One-off refactor script |
| `refactor_tasks_updates.js` | One-off refactor script |
| `repair.js` | One-off repair script |
| `restore_premium_look.js` | One-off UI restore |
| `restore_v2.js` | One-off UI restore |
| `update-db.js` | References wrong DB file |
| `update-db.ts` | Uses `better-sqlite3` + wrong DB path (`data.db`) |
| `upgrade_dashboard_css.js` | One-off CSS patch |
| `upgrade_insights.js` | One-off upgrade |
| `upgrade_task_css.js` | One-off CSS patch |
| `upgrade_v2.js` | One-off upgrade |

#### [MODIFY] [.gitignore](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/.gitignore)
- Add entries for:
  - `latuns.db` (production database should not be in source control)
  - `backups/` (encrypted backup output directory)
  - `upload/` (runtime upload directory)
  - `scripts/archive/` (archived one-off scripts)

#### [DELETE] Unused Docker config references
- `docker-compose.yml` references `./scripts/init.sql` and `./scripts/config/` which do not exist. Since we are keeping SQLite, **delete `docker-compose.yml`** entirely (it was scaffolded for a PostgreSQL setup that was never completed). If you want to keep it for future reference, it will be moved to `scripts/archive/`.

#### [DELETE] Unused public assets
- Remove `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — these are default Next.js scaffolding files not used by the app.
- Remove `template-prototype.html` if it's a development-only prototype.

---

### Phase 6 — Production Polish

#### [MODIFY] [layout.tsx](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/src/app/layout.tsx)
- Expand `metadata` with:
  - Proper `description` for SEO: "Latuns Office ERP — Quotation management, inventory tracking, and client operations for roofing businesses."
  - `applicationName: "Latuns Office ERP"`
  - `robots: "noindex, nofollow"` (internal business tool, should not be indexed)

#### [MODIFY] [next.config.ts](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/next.config.ts)
- Add `poweredByHeader: false` to remove the `X-Powered-By: Next.js` response header (security best practice).
- Add `output: 'standalone'` for leaner production deployments.

#### [MODIFY] [package.json](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/package.json)
- Update `version` from `0.1.0` to `1.0.0` to reflect production release.
- Remove `@types/better-sqlite3` from devDependencies (the app uses `node:sqlite`, not `better-sqlite3`).
- Add a `"heartbeat"` script: `"node scripts/heartbeat.js"`.

#### [MODIFY] [README.md](file:///c:/Users/MY-PC/.gemini/antigravity/playground/hidden-kepler/README.md)
- Replace the default Next.js boilerplate with a real README covering:
  - Project description (Latuns ERP)
  - Prerequisites (Node.js version)
  - Environment setup (`.env.example` reference)
  - How to start in dev and production mode
  - Backup and heartbeat configuration
  - Architecture overview (link to the existing spec doc)

---

## Verification Plan

### Automated Tests
1. **Build validation**: Run `npm run build` after Phase 1 — must complete with zero errors.
2. **Build validation**: Run `npm run build` again after all phases — must still succeed.
3. **Middleware check**: Start the dev server, open an incognito browser, navigate to `http://localhost:3000/` — must redirect to `/login`.
4. **Backup endpoint**: `POST /api/cluster/backup` — verify it creates a real encrypted `.db` file in `./backups/`.
5. **Heartbeat**: Run `node scripts/heartbeat.js` — verify it logs outbound ping attempts (will fail gracefully if no real endpoint is set).

### Manual Verification
- Confirm login/logout flow works correctly with the new middleware.
- Confirm Node Management panel loads real cluster state from `/api/cluster/status`.
- Confirm `[End Day]` trigger creates a backup file on disk.
- Spot-check that all 32 archived scripts are in `scripts/archive/` and no root clutter remains.
- Verify the production `.bat` launcher starts both the Next.js server and the heartbeat daemon.
