"use client";

import {
    Package, Users, FileText, CreditCard, PieChart, Settings,
    LayoutDashboard, Globe, Info, History, Bell, Search, ShieldCheck,
    BarChart2, Download, ClipboardList, Warehouse, GitPullRequest,
    Tag, SortAsc, Filter, Printer, BookOpen, TrendingUp, CheckSquare
} from "lucide-react";

const moduleColor = (color: string) => ({
    background: color,
    padding: '10px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
});

function Module({ id, icon, title, path, color, textColor, children }: {
    id: string;
    icon: React.ReactNode;
    title: string;
    path?: string;
    color: string;
    textColor: string;
    children: React.ReactNode;
}) {
    return (
        <div id={id} className="card module-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px', scrollMarginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={moduleColor(color)}>
                    <span style={{ color: textColor }}>{icon}</span>
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{title}</h3>
                    {path && (
                        <code style={{ fontSize: '12px', color: 'var(--text-muted)', backgroundColor: 'var(--row-odd)', padding: '2px 8px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>
                            {path}
                        </code>
                    )}
                </div>
            </div>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '14px' }}>
                {children}
            </ul>
        </div>
    );
}

function NavPill({ label, href }: { label: string; href: string }) {
    return (
        <a
            href={href}
            style={{
                display: 'inline-block',
                backgroundColor: 'var(--row-odd)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 500,
                padding: '6px 14px',
                borderRadius: '20px',
                margin: '2px',
                textDecoration: 'none',
                transition: 'background 0.15s, border-color 0.15s',
                cursor: 'pointer'
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--accent-light)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--primary)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--row-odd)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)';
            }}
        >
            {label}
        </a>
    );
}

export default function AboutPage() {
    return (
        <>
            {/* Hero Header */}
            <div className="page-header mb-6">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-indigo-500">
                        <Info size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">About Latuns ERP</h1>
                        <p className="page-description">A complete guide to every module, feature, and workflow in the system.</p>
                    </div>
                </div>
            </div>

            {/* Description Card */}
            <div className="card mb-8" style={{ padding: '24px 28px', borderLeft: '4px solid var(--primary)', marginBottom: '40px' }}>
                <p style={{ lineHeight: 1.9, fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>
                    <strong>Latuns ERP</strong> is a unified enterprise resource planning platform built specifically for construction and project-based businesses. It consolidates inventory, client management, quotations, financial tracking, and business analytics into one seamless desktop application. The entire system runs locally with a persistent SQLite database, ensuring your data is private, fast, and always available &bull; even without internet. The interface supports both <strong>Light and Dark mode</strong> with intelligent theming throughout every page.
                </p>
        </div>

        {/* Quick Nav Pills */}
            <div style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Jump to Module</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <NavPill label="Dashboard" href="#mod-dashboard" />
                    <NavPill label="Inventory Catalog" href="#mod-catalog" />
                    <NavPill label="Store & Stock" href="#mod-store" />
                    <NavPill label="Pending Stock Requests" href="#mod-requests" />
                    <NavPill label="Quotations & Invoices" href="#mod-quotations" />
                    <NavPill label="People & CRM" href="#mod-people" />
                    <NavPill label="Finances" href="#mod-finances" />
                    <NavPill label="Insights & Analytics" href="#mod-insights" />
                    <NavPill label="Tasks & Reminders" href="#mod-tasks" />
                    <NavPill label="Settings" href="#mod-settings" />
                </div>
            </div>

            {/* Modules Grid */}
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '24px' }}>System Modules</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '48px' }}>

                {/* Dashboard */}
                <Module id="mod-dashboard" icon={<LayoutDashboard size={24} />} title="Dashboard" path="/  (Home)" color="rgba(99,102,241,0.15)" textColor="#6366f1">
                    <li><strong>Live KPI Tiles:</strong> Instantly see total revenue, total outstanding balances, total expenses, and system-wide inventory valuation at a glance.</li>
                    <li><strong>Low Stock Live Tile:</strong> Automatically cycles through items that have breached their Low or Critical thresholds — badge turns red for Critical. Clicking it navigates directly to the Store alerts view.</li>
                    <li><strong>Recent Quotations:</strong> A quick-access list of the last few quotations with status badges.</li>
                    <li><strong>Tasks &amp; Reminders:</strong> View, add, and complete upcoming tasks directly from the dashboard.</li>
                    <li><strong>System Updates Feed:</strong> A real-time activity log of notable system events.</li>
                </Module>

                {/* Inventory Catalog */}
                <Module id="mod-catalog" icon={<Package size={24} />} title="Inventory — Item Catalog" path="/inventory  (Item Catalog tab)" color="rgba(16,185,129,0.15)" textColor="#10b981">
                    <li><strong>Item Catalog:</strong> A master list of all materials with name, unit, default price, project type tag, and description. Items are grouped by their tag/category.</li>
                    <li><strong>Drag-and-Drop Reordering:</strong> Rearrange catalog items by dragging them within the table. Order persists across sessions.</li>
                    <li><strong>Add / Edit / Delete Items:</strong> Full CRUD for each catalog entry with configurable Low Stock and Critical Stock thresholds per item.</li>
                    <li><strong>Multi-Threshold Alerts:</strong> Each item has two configurable levels — <em>Low</em> (yellow warning) and <em>Critical</em> (red alert) — set independently for each item.</li>
                </Module>

                {/* Inventory Store */}
                <Module id="mod-store" icon={<Warehouse size={24} />} title="Inventory — Store (Stock)" path="/inventory  (Store tab)" color="rgba(245,158,11,0.15)" textColor="#f59e0b">
                    <li><strong>Live Stock Levels:</strong> Tracks current quantity on hand for every item, colour-coded as OK / Low / Critical based on configurable thresholds.</li>
                    <li><strong>Search Bar:</strong> Instantly filter store items by name in real-time.</li>
                    <li><strong>Sortable Columns:</strong> Sort the store list by Current Stock Qty or Project Type (Tags) using column header toggles.</li>
                    <li><strong>Manage Stock Modal:</strong> Manually receive (add) or issue (subtract) stock quantities with a reference note recorded on every transaction.</li>
                    <li><strong>Global Store History:</strong> A single history modal covering all items across the entire store, filtered by any date range, showing stock-in and stock-out logs with timestamps and reference notes.</li>
                    <li><strong>Export Store History CSV:</strong> Download the currently filtered history log as a structured CSV file for external reporting.</li>
                    <li><strong>Inventory Valuation:</strong> A live "Store Value" indicator in the page header showing the total monetary value of all stocked items.</li>
                </Module>

                {/* Stock Request Review */}
                <Module id="mod-requests" icon={<GitPullRequest size={24} />} title="Inventory — Pending Stock Requests" path="/inventory  (Pending Requests tab)" color="rgba(239,68,68,0.15)" textColor="#ef4444">
                    <li><strong>Decoupled Deduction Workflow:</strong> When a project is marked as "Started," inventory is <em>not</em> automatically deducted. Instead, a Pending Stock Request is created for review.</li>
                    <li><strong>Review Modal:</strong> Displays the Quotation ID, client, project type, and a full table of requested materials with current store availability vs. originally quoted quantities.</li>
                    <li><strong>Editable Issue Quantities:</strong> The reviewer can adjust the actual quantity to issue for each item (e.g., for partial fulfillment) without altering the original quotation.</li>
                    <li><strong>Approve &amp; Issue:</strong> Finalises the deduction — only the approved amounts are subtracted from the Store and logged in the Global History.</li>
                    <li><strong>Reject Request:</strong> Dismisses the request entirely with a confirmation prompt. No stock deduction occurs.</li>
                    <li><strong>Live Badge Count:</strong> A red notification badge on the tab shows the number of pending requests from the moment you open the Inventory page.</li>
                </Module>

                {/* Quotations */}
                <Module id="mod-quotations" icon={<FileText size={24} />} title="Quotations & Invoices" path="/quotations" color="rgba(59,130,246,0.15)" textColor="#3b82f6">
                    <li><strong>Quotation Builder:</strong> Create detailed line-item quotations with drag-and-drop reordering, inventory item import, auto-calculated unit costs and totals.</li>
                    <li><strong>Sundries &amp; Transportation:</strong> Add fixed or percentage-based margin/sundries and transportation costs that factor into the final grand total.</li>
                    <li><strong>Discount Statements:</strong> Generate linked discount documents that apply a specific discount amount to a prior quotation; the final discounted grand total and a highlighted "Discount Applied" row is shown in the totals section.</li>
                    <li><strong>Project Scope Documents:</strong> Create multi-quotation composite documents that consolidate linked quotation items into one master scope.</li>
                    <li><strong>Visit Status Tracking:</strong> Mark quotations as Not Visited → Visited → Sent with one-click cycling.</li>
                    <li><strong>Project Status Lifecycle:</strong> Cycle through Pending → Started → Halted → Completed. Transitioning to "Started" triggers the Stock Request workflow.</li>
                    <li><strong>Print &amp; Export:</strong> Dedicated "Print Quote" and "Print Ledger" buttons render only the required template, eliminating print preview lag. PDF and JPG export available for both.</li>
                    <li><strong>CSV Export (Quotations List):</strong> Download a filtered view of all quotations as a CSV file, including subsidiary, agent, project type, and total columns.</li>
                    <li><strong>Payment Ledger:</strong> Log, edit, and reconcile client payments against each quotation's outstanding balance.</li>
                    <li><strong>Synchronized Ledger:</strong> For composite documents, all payments are automatically rolled up to the master document's balance.</li>
                </Module>

                {/* People & CRM */}
                <Module id="mod-people" icon={<Users size={24} />} title="People & CRM" path="/people" color="rgba(168,85,247,0.15)" textColor="#a855f7">
                    <li><strong>Client Directory:</strong> Full client profiles with name, contact details, state/city, and a full activity timeline. Each client page shows their complete history of quotations, payments, and notes in chronological order.</li>
                    <li><strong>Estimators Directory:</strong> Manage estimators/agents assigned to quotations. Each estimator profile lists their associated clients and project history.</li>
                    <li><strong>Activity Timeline:</strong> A per-client log of all significant events (quotation created, project started, payment received, etc.) displayed in a visual timeline.</li>
                    <li><strong>Client-Quotation Linkage:</strong> Auto-links quotations to the appropriate client record when created or updated.</li>
                </Module>

                {/* Finances */}
                <Module id="mod-finances" icon={<CreditCard size={24} />} title="Finances — Payments & Expenses" path="/finances" color="rgba(16,185,129,0.15)" textColor="#10b981">
                    <li><strong>Unified Finance Hub:</strong> Payments and Expenses are consolidated into a single Finances page with tabbed navigation.</li>
                    <li><strong>Payments Tab:</strong> Lists all incoming client payments across all quotations. Filter by date range and search by client or reference.</li>
                    <li><strong>Expenses Tab:</strong> Track all outgoing business expenses with amount, date, category, and notes. Filterable by month/year and searchable by description.</li>
                    <li><strong>Expense Categories:</strong> Create and manage custom expense categories (stored in system settings). Categories appear as selectable tags when logging an expense.</li>
                    <li><strong>Expense CSV Export:</strong> Export the currently filtered expense ledger to a structured CSV file for external accounting.</li>
                    <li><strong>Profit &amp; Loss:</strong> The Finances page computes total revenue, total expenses, and net profit automatically from live data.</li>
                </Module>

                {/* Insights */}
                <Module id="mod-insights" icon={<PieChart size={24} />} title="Insights & Analytics" path="/insights" color="rgba(249,115,22,0.15)" textColor="#f97316">
                    <li><strong>Revenue Overview Tile:</strong> Shows total billed revenue. Clicking it jumps to the Finances → Payments tab.</li>
                    <li><strong>Expenses Overview Tile:</strong> Shows total expenditure. Clicking it jumps to the Finances → Expenses tab.</li>
                    <li><strong>Outstanding Balance Tile:</strong> Total outstanding across all active quotations.</li>
                    <li><strong>Low Stock Alert Tile:</strong> Shows a count of items in Low or Critical state. Clicking it opens the Inventory Store with the alerts filter active.</li>
                    <li><strong>Custom Chart Builder:</strong> Build any bar, line, or pie chart on the fly. Data sources include Revenue by Month, Expenses by Category, Top Clients by Revenue, Project Type Breakdown, and more. Charts can be filtered by date range and exported.</li>
                    <li><strong>Top Performing Projects:</strong> Ranked table of the highest-value quotations and project summaries.</li>
                </Module>

                {/* Tasks */}
                <Module id="mod-tasks" icon={<CheckSquare size={24} />} title="Tasks & Reminders" path="/  (Dashboard)" color="rgba(99,102,241,0.15)" textColor="#6366f1">
                    <li><strong>Task List:</strong> Create, complete, and delete tasks with a title and optional due date. Tasks display directly on the main Dashboard as a live widget.</li>
                    <li><strong>Reminders:</strong> Set reminder entries that appear alongside tasks, with color indicators for approaching or overdue dates.</li>
                    <li><strong>Priority View:</strong> The dashboard always surfaces the most urgent tasks and reminders at the top.</li>
                </Module>

                {/* Settings */}
                <Module id="mod-settings" icon={<Settings size={24} />} title="System & Settings" path="/settings" color="rgba(100,116,139,0.15)" textColor="#64748b">
                    <li><strong>Company Profile:</strong> Set your company name, address, phone, email, and website — these populate automatically on all print templates and quotation exports.</li>
                    <li><strong>Bank Details:</strong> Configure default bank name, account name, and account number shown on quotation PDFs.</li>
                    <li><strong>Expense Categories:</strong> Manage the global list of expense categories used across the Finances module.</li>
                    <li><strong>Dark / Light Mode Toggle:</strong> System-wide theme switch persisted across sessions; respects the users' preference immediately.</li>
                    <li><strong>App Logo:</strong> A custom SVG logo is displayed in the sidebar and optionally on print/export templates.</li>
                </Module>

            </div>

            {/* Cross-Cutting Features */}
            <div className="card" style={{ padding: '28px', marginBottom: '48px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={22} color="var(--primary)" /> Cross-Cutting Features
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    {[
                        { icon: <Download size={16} />, title: "CSV / PDF Exports", desc: "Available across Quotations, Finances, and Store History." },
                        { icon: <Search size={16} />, title: "Real-Time Search", desc: "Instant filtering across the Store, Quotations list, and Finances." },
                        { icon: <SortAsc size={16} />, title: "Column Sorting", desc: "Sort tables by key columns with toggling asc/desc controls." },
                        { icon: <Filter size={16} />, title: "Date Range Filtering", desc: "Store History and Expenses both support From/To date filters." },
                        { icon: <Bell size={16} />, title: "Live Alert Tiles", desc: "Dashboard and Insights low-stock alert tile cycles all affected items." },
                        { icon: <History size={16} />, title: "Audit Trails", desc: "Every stock movement is timestamped and logged with a reference note." },
                        { icon: <Tag size={16} />, title: "Project Type Tags", desc: "Inventory items and quotations are tagged by project type for filtering." },
                        { icon: <Printer size={16} />, title: "Fast Print Templates", desc: "Conditional rendering ensures print previews load instantly." },
                        { icon: <BookOpen size={16} />, title: "Dark Mode", desc: "Full dark mode support with CSS variable theming across every component." },
                    ].map(f => (
                        <div key={f.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', backgroundColor: 'var(--row-odd)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <span style={{ color: 'var(--primary)', marginTop: '2px' }}>{f.icon}</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{f.title}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{f.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <footer style={{ paddingTop: '24px', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <p>Latuns ERP System &copy; {new Date().getFullYear()} — Engineered for operational excellence.</p>
            </footer>
        </>
    );
}
