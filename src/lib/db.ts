// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'latuns.db');

declare global {
  var db: any;
  var db_initialized: boolean;
}

let db: any;

if (process.env.NODE_ENV === 'production') {
  db = new DatabaseSync(dbPath);
} else {
  if (!global.db) {
    global.db = new DatabaseSync(dbPath);
  }
  db = global.db;
}

const isBuildPhase = process.env.npm_lifecycle_event === 'build' || 
                     process.env.NEXT_PHASE === 'phase-production-build' ||
                     process.argv.some(arg => arg.includes('build')) ||
                     process.env.IS_DOCKER_BUILD === '1';

if (!isBuildPhase) {
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
}

// Initialize database schema - only if not already initialized in this process
if (!global.db_initialized && !isBuildPhase) {
    // 1. Base Tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      
      CREATE TABLE IF NOT EXISTS inventory_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        description TEXT,
        default_price REAL DEFAULT 0,
        tags TEXT,
        display_order INTEGER DEFAULT 0,
        stock_qty REAL DEFAULT 0,
        min_stock REAL DEFAULT 10,
        low_stock REAL DEFAULT 20,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        state TEXT,
        city TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_number TEXT UNIQUE,
        subsidiary_name TEXT DEFAULT 'LATUNS ROOFING SYSTEM',
        client_name TEXT NOT NULL,
        client_phone TEXT,
        client_address TEXT,
        client_state TEXT,
        client_city TEXT,
        project_type TEXT,
        agent_id INTEGER,
        client_id INTEGER,
        sundries TEXT,
        transportation REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        client_visited BOOLEAN DEFAULT FALSE,
        visit_status TEXT DEFAULT 'Not Visited',
        project_status TEXT DEFAULT 'Pending',
        doc_type TEXT DEFAULT 'quotation',
        discount_value REAL DEFAULT 0,
        linked_quotations TEXT,
        header_note TEXT,
        project_scope TEXT,
        discount_statement TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        qty REAL NOT NULL,
        unit TEXT NOT NULL,
        unit_cost REAL NOT NULL,
        total REAL NOT NULL,
        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date DATETIME NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        alarm_time DATETIME,
        archived_at DATETIME,
        assigned_to INTEGER,
        created_by INTEGER,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS inventory_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        qty REAL NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        date DATETIME NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stock_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS stock_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        inventory_item_id INTEGER NOT NULL,
        requested_qty REAL NOT NULL,
        approved_qty REAL,
        FOREIGN KEY(request_id) REFERENCES stock_requests(id) ON DELETE CASCADE,
        FOREIGN KEY(inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS company_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        classification TEXT,
        image_url TEXT,
        purchase_date DATETIME,
        purchase_cost REAL DEFAULT 0,
        current_value REAL DEFAULT 0,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS staff_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        staff_id INTEGER,
        role_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(staff_id) REFERENCES agents(id) ON DELETE SET NULL,
        FOREIGN KEY(role_id) REFERENCES staff_roles(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER NOT NULL,
        module TEXT NOT NULL,
        can_view BOOLEAN DEFAULT FALSE,
        can_edit BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        UNIQUE(role_id, module),
        FOREIGN KEY(role_id) REFERENCES staff_roles(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS mail_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        imap_host TEXT NOT NULL,
        imap_port INTEGER NOT NULL,
        imap_secure BOOLEAN DEFAULT TRUE,
        smtp_host TEXT NOT NULL,
        smtp_port INTEGER NOT NULL,
        smtp_secure BOOLEAN DEFAULT TRUE,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        ref_type TEXT,
        ref_id INTEGER,
        is_read BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        action TEXT NOT NULL,
        module TEXT,
        description TEXT NOT NULL,
        ref_type TEXT,
        ref_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sub_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER NOT NULL,
        module TEXT NOT NULL,
        sub_module TEXT NOT NULL,
        allowed BOOLEAN DEFAULT TRUE,
        UNIQUE(role_id, module, sub_module),
        FOREIGN KEY(role_id) REFERENCES staff_roles(id) ON DELETE CASCADE
      );
    `);

    // 2. Migration Helper
    const addColumn = (table: string, column: string, type: string) => {
        try {
            const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
            if (!columns.some(c => c.name === column)) {
                db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
            }
        } catch (e) { console.error(`Migration failed: ${table}.${column}`, e); }
    };

    // 3. Incremental Updates
    addColumn('quotations', 'quote_number', 'TEXT');
    addColumn('quotations', 'subsidiary_name', 'TEXT DEFAULT "LATUNS ROOFING SYSTEM"');
    addColumn('quotations', 'client_state', 'TEXT');
    addColumn('quotations', 'client_city', 'TEXT');
    addColumn('quotations', 'agent_id', 'INTEGER');
    addColumn('quotations', 'client_visited', 'BOOLEAN DEFAULT FALSE');
    addColumn('quotations', 'visit_status', 'TEXT DEFAULT "Not Visited"');
    addColumn('quotations', 'client_phone', 'TEXT');
    addColumn('quotations', 'client_id', 'INTEGER');
    addColumn('quotations', 'project_status', 'TEXT DEFAULT "Pending"');
    addColumn('quotations', 'doc_type', 'TEXT DEFAULT "quotation"');
    addColumn('quotations', 'discount_value', 'REAL DEFAULT 0');
    addColumn('quotations', 'linked_quotations', 'TEXT');
    addColumn('quotations', 'header_note', 'TEXT');
    addColumn('quotations', 'project_scope', 'TEXT');
    addColumn('quotations', 'discount_statement', 'TEXT');
    
    addColumn('inventory_items', 'default_price', 'REAL DEFAULT 0');
    addColumn('inventory_items', 'tags', 'TEXT');
    addColumn('inventory_items', 'display_order', 'INTEGER DEFAULT 0');
    addColumn('inventory_items', 'stock_qty', 'REAL DEFAULT 0');
    addColumn('inventory_items', 'min_stock', 'REAL DEFAULT 10');
    addColumn('inventory_items', 'low_stock', 'REAL DEFAULT 20');

    addColumn('tasks', 'archived_at', 'DATETIME');
    addColumn('tasks', 'assigned_to', 'INTEGER');
    addColumn('tasks', 'created_by', 'INTEGER');
    addColumn('tasks', 'status', 'TEXT DEFAULT "pending"');
    addColumn('tasks', 'priority', 'TEXT DEFAULT "medium"');
    addColumn('tasks', 'quotation_id', 'INTEGER');
    addColumn('tasks', 'client_id', 'INTEGER');

    addColumn('clients', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    
    addColumn('sessions', 'ip_address', 'TEXT');
    addColumn('sessions', 'user_agent', 'TEXT');
    addColumn('sessions', 'last_active', 'DATETIME');
    
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS staff_roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL
        );
      `);
    } catch (e) { }

    // Insert default roles if table is empty
    const rolesCount = db.prepare('SELECT COUNT(*) as count FROM staff_roles').get() as { count: number };
    if (rolesCount.count === 0) {
        db.exec(`
            INSERT INTO staff_roles (name) VALUES ('Admin'), ('Roof Estimator'), ('Sub-contractor'), ('Office Staff');
        `);
    }

    // Initialize Permissions for modules
    const modules = ['Dashboard', 'Inventory', 'People', 'Quotations', 'Finances', 'Insights', 'Settings', 'Tasks', 'Mail'];
    const roles = db.prepare('SELECT * FROM staff_roles').all() as any[];

    roles.forEach(role => {
        modules.forEach(module => {
            try {
                const exists = db.prepare('SELECT id FROM permissions WHERE role_id = ? AND module = ?').get(role.id, module);
                if (!exists) {
                    const isFull = role.name === 'Admin';
                    db.prepare(`
                        INSERT INTO permissions (role_id, module, can_view, can_edit, can_delete)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(role.id, module, isFull ? 1 : 0, isFull ? 1 : 0, isFull ? 1 : 0);
                }
            } catch (e) { }
        });
    });

    // Initialize Sub-Permissions for modules with tabs
    const subModuleMap: Record<string, string[]> = {
        'Inventory': ['Catalog', 'Store', 'Requests', 'Issued', 'Assets'],
        'People': ['Clients', 'Staff'],
        'Settings': ['General', 'Staff'],
        'Finances': ['Revenue', 'Expenses'],
    };

    roles.forEach(role => {
        Object.entries(subModuleMap).forEach(([mod, subs]) => {
            subs.forEach(sub => {
                try {
                    const exists = db.prepare('SELECT id FROM sub_permissions WHERE role_id = ? AND module = ? AND sub_module = ?').get(role.id, mod, sub);
                    if (!exists) {
                        const isFull = role.name === 'Admin';
                        db.prepare(`
                            INSERT INTO sub_permissions (role_id, module, sub_module, allowed)
                            VALUES (?, ?, ?, ?)
                        `).run(role.id, mod, sub, isFull ? 1 : 1); // Default all allowed
                    }
                } catch (e) { }
            });
        });
    });

    global.db_initialized = true;
}

db.exec('PRAGMA foreign_keys = ON;');

export default db;
