import {
  pgTable,
  serial,
  text,
  numeric,
  real,
  timestamp,
  boolean,
  integer,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  description: text('description'),
  defaultPrice: numeric('default_price', { precision: 15, scale: 2 }).default('0'),
  tags: text('tags'),
  displayOrder: integer('display_order').default(0),
  stockQty: numeric('stock_qty', { precision: 15, scale: 3 }).default('0'),
  minStock: numeric('min_stock', { precision: 15, scale: 3 }).default('10'),
  lowStock: numeric('low_stock', { precision: 15, scale: 3 }).default('20'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  state: text('state'),
  city: text('city'),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role').default('Roof Estimator'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const quotations = pgTable('quotations', {
  id: serial('id').primaryKey(),
  quoteNumber: text('quote_number').unique(),
  subsidiaryName: text('subsidiary_name').default('LATUNS ROOFING SYSTEM'),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone'),
  clientAddress: text('client_address'),
  clientState: text('client_state'),
  clientCity: text('client_city'),
  projectType: text('project_type'),
  agentId: integer('agent_id').references(() => agents.id),
  clientId: integer('client_id').references(() => clients.id),
  sundries: text('sundries'),
  transportation: numeric('transportation', { precision: 15, scale: 2 }).default('0'),
  status: text('status').default('pending'),
  clientVisited: boolean('client_visited').default(false),
  visitStatus: text('visit_status').default('Not Visited'),
  projectStatus: text('project_status').default('Pending'),
  docType: text('doc_type').default('quotation'),
  discountValue: numeric('discount_value', { precision: 15, scale: 2 }).default('0'),
  linkedQuotations: text('linked_quotations'),
  headerNote: text('header_note'),
  projectScope: text('project_scope'),
  discountStatement: text('discount_statement'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const quotationItems = pgTable('quotation_items', {
  id: serial('id').primaryKey(),
  quotationId: integer('quotation_id').notNull().references(() => quotations.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),
  unit: text('unit').notNull(),
  unitCost: numeric('unit_cost', { precision: 15, scale: 2 }).notNull(),
  total: numeric('total', { precision: 15, scale: 2 }).notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  quotationId: integer('quotation_id').notNull().references(() => quotations.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  date: timestamp('date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  completed: boolean('completed').default(false),
  alarmTime: timestamp('alarm_time'),
  archivedAt: timestamp('archived_at'),
  assignedTo: integer('assigned_to').references(() => agents.id, { onDelete: 'set null' }),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').default('pending'),
  priority: text('priority').default('medium'),
  quotationId: integer('quotation_id').references(() => quotations.id, { onDelete: 'set null' }),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inventoryLogs = pgTable('inventory_logs', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  date: timestamp('date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const stockRequests = pgTable('stock_requests', {
  id: serial('id').primaryKey(),
  quotationId: integer('quotation_id').notNull().references(() => quotations.id, { onDelete: 'cascade' }),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const stockRequestItems = pgTable('stock_request_items', {
  id: serial('id').primaryKey(),
  requestId: integer('request_id').notNull().references(() => stockRequests.id, { onDelete: 'cascade' }),
  inventoryItemId: integer('inventory_item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  requestedQty: numeric('requested_qty', { precision: 15, scale: 3 }).notNull(),
  approvedQty: numeric('approved_qty', { precision: 15, scale: 3 }),
});

export const companyAssets = pgTable('company_assets', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  classification: text('classification'),
  imageUrl: text('image_url'),
  purchaseDate: timestamp('purchase_date'),
  purchaseCost: numeric('purchase_cost', { precision: 15, scale: 2 }).default('0'),
  currentValue: numeric('current_value', { precision: 15, scale: 2 }).default('0'),
  status: text('status').default('Active'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const staffRoles = pgTable('staff_roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  staffId: integer('staff_id').references(() => agents.id, { onDelete: 'set null' }),
  roleId: integer('role_id').references(() => staffRoles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').notNull().references(() => staffRoles.id, { onDelete: 'cascade' }),
  module: text('module').notNull(),
  canView: boolean('can_view').default(false),
  canEdit: boolean('can_edit').default(false),
  canDelete: boolean('can_delete').default(false),
}, (t) => [
  unique().on(t.roleId, t.module),
]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  lastActive: timestamp('last_active'),
});

export const mailAccounts = pgTable('mail_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  imapHost: text('imap_host').notNull(),
  imapPort: integer('imap_port').notNull(),
  imapSecure: boolean('imap_secure').default(true),
  smtpHost: text('smtp_host').notNull(),
  smtpPort: integer('smtp_port').notNull(),
  smtpSecure: boolean('smtp_secure').default(true),
  email: text('email').notNull(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message'),
  refType: text('ref_type'),
  refId: integer('ref_id'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  username: text('username'),
  action: text('action').notNull(),
  module: text('module'),
  description: text('description').notNull(),
  refType: text('ref_type'),
  refId: integer('ref_id'),
  entityType: text('entity_type'),
  entityId: integer('entity_id'),
  beforeData: text('before_data'),
  afterData: text('after_data'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subPermissions = pgTable('sub_permissions', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').notNull().references(() => staffRoles.id, { onDelete: 'cascade' }),
  module: text('module').notNull(),
  subModule: text('sub_module').notNull(),
  allowed: boolean('allowed').default(true),
}, (t) => [
  unique().on(t.roleId, t.module, t.subModule),
]);

export const customCharts = pgTable('custom_charts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  config: text('config'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  actionType: text('action_type').notNull(),
  description: text('description'),
  refId: integer('ref_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inventoryMovements = pgTable('inventory_movements', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  movementType: text('movement_type').notNull(), // 'IN', 'OUT', 'ADJUSTMENT', 'OPENING_BALANCE'
  quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 15, scale: 2 }),
  referenceType: text('reference_type'), // 'quotation', 'stock_request', 'manual'
  referenceId: integer('reference_id'),
  note: text('note'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
});
