"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, FileText, Settings, Users, PieChart, Moon, Sun, Menu, ChevronLeft, ChevronRight, CreditCard, Info, LogOut, User, Mail, CheckSquare, Bell, X as CloseIcon, Check } from "lucide-react";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const [unreadMailCount, setUnreadMailCount] = useState(0);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            setIsDarkMode(true);
            document.documentElement.classList.add('dark-theme');
        }

        const savedCollapse = localStorage.getItem('sidebar-collapsed');
        if (savedCollapse === 'true') {
            setIsCollapsed(true);
            document.body.classList.add('sidebar-collapsed');
        }

        fetchSession();
        fetchPendingCount();
        fetchUnreadMail();
        fetchNotifications();
        
        const interval = setInterval(() => {
            fetchPendingCount();
            fetchUnreadMail();
            fetchNotifications();
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchSession = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                setPermissions(data.permissions);
            } else if (res.status === 401 && pathname !== '/login') {
                router.push('/login');
            }
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    };

    const fetchPendingCount = async () => {
        try {
            const res = await fetch('/api/inventory/requests');
            if (res.ok) {
                const data = await res.json();
                const pending = Array.isArray(data) ? data.filter((r: any) => r.status === 'pending') : [];
                setPendingRequestCount(pending.length);
            }
        } catch { /* silent */ }
    };

    const fetchUnreadMail = async () => {
        try {
            const res = await fetch('/api/mail/unread');
            if (res.ok) {
                const data = await res.json();
                setUnreadMailCount(data.count || 0);
            }
        } catch { /* silent */ }
    };

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadNotificationCount(data.unreadCount || 0);
            }
        } catch { /* silent */ }
    };

    const markNotificationRead = async (id: number) => {
        try {
            const res = await fetch('/api/notifications', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) fetchNotifications();
        } catch { /* silent */ }
    };

    const markAllRead = async () => {
        try {
            const res = await fetch('/api/notifications', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true })
            });
            if (res.ok) fetchNotifications();
        } catch { /* silent */ }
    };

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = async () => {
        setShowLogoutConfirm(false);
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                router.push('/login');
                router.refresh();
            }
        } catch {
            alert("Logout failed");
        }
    };

    const toggleTheme = () => {
        if (isDarkMode) {
            document.documentElement.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
            setIsDarkMode(false);
        } else {
            document.documentElement.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            setIsDarkMode(true);
        }
    };

    const toggleCollapse = () => {
        if (isCollapsed) {
            document.body.classList.remove('sidebar-collapsed');
            localStorage.setItem('sidebar-collapsed', 'false');
            setIsCollapsed(false);
        } else {
            document.body.classList.add('sidebar-collapsed');
            localStorage.setItem('sidebar-collapsed', 'true');
            setIsCollapsed(true);
        }
    };

    const navItems = [
        { label: "Dashboard", href: "/", icon: <LayoutDashboard size={20} />, module: "Dashboard" },
        {
            label: "Inventory", href: "/inventory", icon: <Package size={20} />, module: "Inventory",
            badge: pendingRequestCount > 0 ? pendingRequestCount : null
        },
        { label: "People", href: "/people/clients", icon: <Users size={20} />, module: "People" },
        { label: "Quotations", href: "/quotations", icon: <FileText size={20} />, module: "Quotations" },
        { label: "Finances", href: "/finances", icon: <CreditCard size={20} />, module: "Finances" },
        { label: "Tasks", href: "/tasks", icon: <CheckSquare size={20} />, module: "Tasks" },
        { 
            label: "Mail", href: "/mail", icon: <Mail size={20} />, module: "Mail",
            badge: unreadMailCount > 0 ? unreadMailCount : null
        },
        { label: "Insights", href: "/insights", icon: <PieChart size={20} />, module: "Insights" },
        { label: "Settings", href: "/settings", icon: <Settings size={20} />, module: "Settings" },
        { label: "About", href: "/about", icon: <Info size={20} /> },
    ];

    const filteredNavItems = navItems.filter(item => {
        if (!item.module) return true;
        const perm = permissions.find(p => p.module === item.module);
        return perm ? perm.can_view : true; 
    });

    if (pathname === '/login') return null;

    if (loading) {
        return <aside className="sidebar" style={{ width: isCollapsed ? '80px' : '260px' }} />;
    }

    return (
        <>
            <button className="mobile-nav-toggle btn btn-primary" onClick={() => setIsMobileOpen(true)}>
                <Menu size={20} />
            </button>

            {isMobileOpen && (
                <div className="sidebar-backdrop" onClick={() => setIsMobileOpen(false)} />
            )}

            <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
                <div className="brand">
                    {!isCollapsed ? (
                        <>
                            <Image src="/Logo 2026.svg" alt="Latuns Logo" width={140} height={52} className="object-contain flex-shrink-0" style={{ filter: 'var(--logo-filter)' }} priority />
                            <button
                                onClick={toggleCollapse}
                                className="desktop-collapse-toggle"
                                title="Collapse sidebar"
                            >
                                <ChevronLeft size={16} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={toggleCollapse}
                            className="desktop-collapse-toggle"
                            title="Expand sidebar"
                        >
                            <ChevronRight size={16} />
                        </button>
                    )}
                </div>

                {/* Notifications modal container */}
                <div className="relative z-50">
                    {showNotifications && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] backdrop-blur-sm p-5" onClick={() => setShowNotifications(false)}>
                            <div 
                                className="w-full max-w-md max-h-[80vh] bg-[var(--bg-color-alt)] rounded-xl flex flex-col shadow-2xl overflow-hidden" 
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="px-5 py-4 border-b flex justify-between items-center bg-[var(--bg-color)]">
                                    <div className="flex items-center gap-3">
                                        <Bell size={20} className="text-primary" />
                                        <h2 className="m-0 text-lg font-extrabold">Notification Center</h2>
                                    </div>
                                    <div className="flex gap-3 items-center">
                                        <button onClick={markAllRead} className="text-[12px] text-primary bg-transparent border-none cursor-pointer font-semibold">Mark all as read</button>
                                        <button onClick={() => setShowNotifications(false)} className="bg-transparent border-none cursor-pointer text-muted flex items-center justify-center">
                                            <CloseIcon size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto py-1">
                                    {notifications.length === 0 ? (
                                        <div className="py-16 px-5 text-center">
                                            <div className="text-[48px] mb-4 opacity-20">📭</div>
                                            <div className="text-muted text-[14px]">Your notification inbox is empty.</div>
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                             <div 
                                                 key={n.id} 
                                                 className={`px-5 py-4 border-b cursor-pointer flex gap-4 items-start notification-item transition-colors hover:bg-[var(--sidebar-hover)] ${n.is_read ? 'read' : 'unread'}`}
                                                 onClick={() => {
                                                     markNotificationRead(n.id);
                                                     if (n.ref_type === 'task') router.push('/tasks');
                                                     setShowNotifications(false);
                                                 }}
                                             >
                                                 <div 
                                                     className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                                                         n.is_read 
                                                             ? 'bg-[var(--sidebar-hover)] text-[var(--text-muted)]' 
                                                             : 'bg-primary/10 text-primary border border-primary/20'
                                                     }`}
                                                 >
                                                     <Bell size={16} />
                                                 </div>
                                                 <div className="flex-1 min-w-0">
                                                     <div className="flex justify-between items-baseline gap-2 mb-1">
                                                         <div className={`text-[14px] text-[var(--text-main)] truncate ${n.is_read ? 'font-medium' : 'font-semibold'}`}>
                                                             {n.title}
                                                         </div>
                                                         <div className="text-[11px] text-[var(--text-muted)] opacity-85 whitespace-nowrap">
                                                             {new Date(n.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                                                         </div>
                                                     </div>
                                                     <div className="text-[13px] text-[var(--text-muted)] leading-normal">{n.message}</div>
                                                     {!n.is_read && (
                                                         <div className="mt-2 flex items-center justify-between">
                                                             <span className="text-[10px] uppercase font-bold text-primary tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25">New Alert</span>
                                                             <button
                                                                 onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     markNotificationRead(n.id);
                                                                 }}
                                                                 style={{
                                                                     padding: '4px 8px',
                                                                     borderRadius: '4px',
                                                                     border: '1px solid var(--border)',
                                                                     background: 'var(--bg-color)',
                                                                     color: 'var(--text-muted)',
                                                                     cursor: 'pointer',
                                                                     display: 'flex',
                                                                     alignItems: 'center',
                                                                     gap: '4px',
                                                                     fontSize: '11px',
                                                                     fontWeight: '600',
                                                                     transition: 'all 0.2s',
                                                                     boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                                 }}
                                                                 onMouseEnter={(e) => {
                                                                     e.currentTarget.style.color = 'var(--success)';
                                                                     e.currentTarget.style.borderColor = 'var(--success)';
                                                                     e.currentTarget.style.backgroundColor = 'rgba(52, 211, 153, 0.1)';
                                                                 }}
                                                                 onMouseLeave={(e) => {
                                                                     e.currentTarget.style.color = 'var(--text-muted)';
                                                                     e.currentTarget.style.borderColor = 'var(--border)';
                                                                     e.currentTarget.style.backgroundColor = 'var(--bg-color)';
                                                                 }}
                                                                 title="Mark as read"
                                                             >
                                                                 <Check size={12} /> Mark Read
                                                             </button>
                                                         </div>
                                                     )}
                                                 </div>
                                             </div>
                                         ))
                                    )}
                                </div>
                                <div className="px-5 py-3 border-t bg-[var(--bg-color)] flex justify-center">
                                    <button onClick={() => setShowNotifications(false)} className="btn btn-outline w-full text-[13px] py-1.5">Close</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <nav className="nav-links flex-1 mt-4 overflow-y-auto">
                    {filteredNavItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-link relative group ${isActive ? "active" : ""}`}
                                onClick={() => setIsMobileOpen(false)}
                                title={isCollapsed ? item.label : undefined}
                            >
                                <span className="transition-transform duration-200 group-hover:scale-110 flex items-center justify-center">
                                    {item.icon}
                                </span>
                                {!isCollapsed && <span className="flex-1 ml-3">{item.label}</span>}
                                {item.badge != null && (
                                    <span style={{
                                        position: 'absolute',
                                        right: isCollapsed ? '-4px' : '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        minWidth: '18px',
                                        height: '18px',
                                        borderRadius: '9px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 4px',
                                        lineHeight: 1,
                                    }}>
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="px-4 py-4 mt-auto flex flex-col gap-1">
                    {/* Action Icons Row — Horizontal when expanded */}
                    <div className={`flex ${isCollapsed ? 'flex-col gap-1' : 'flex-row gap-2 justify-start'} items-center`}>
                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className={`border-none outline-none bg-transparent cursor-pointer flex items-center justify-center ${isCollapsed ? 'w-full' : ''} px-2 py-2 rounded-lg hover:bg-[var(--sidebar-hover)] transition-all group`}
                            title="Logout"
                        >
                            <span className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors" style={{ background: 'rgba(239,68,68,0.1)' }}>
                                <LogOut size={24} className="text-red-500 group-hover:text-red-400 transition-colors" />
                            </span>
                        </button>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className={`border-none outline-none bg-transparent cursor-pointer flex items-center justify-center ${isCollapsed ? 'w-full' : ''} px-2 py-2 rounded-lg hover:bg-[var(--sidebar-hover)] transition-all group`}
                            title={isDarkMode ? "Light Mode" : "Dark Mode"}
                        >
                            {isDarkMode ? (
                                <span className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors" style={{ background: 'rgba(251,191,36,0.12)' }}>
                                    <Sun size={24} className="text-yellow-400 group-hover:text-yellow-300 transition-colors" />
                                </span>
                            ) : (
                                <span className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors" style={{ background: 'rgba(99,102,241,0.12)' }}>
                                    <Moon size={24} className="text-indigo-500 group-hover:text-indigo-400 transition-colors" />
                                </span>
                            )}
                        </button>

                        {/* Notification Button */}
                        <button
                            onClick={() => setShowNotifications(true)}
                            className={`border-none outline-none bg-transparent cursor-pointer flex items-center justify-center ${isCollapsed ? 'w-full' : ''} px-2 py-2 rounded-lg hover:bg-[var(--sidebar-hover)] transition-all group`}
                            title="Notifications"
                        >
                            <div className="relative flex items-center justify-center">
                                <span className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors" style={{ background: 'rgba(245,158,11,0.12)' }}>
                                    <Bell size={24} className="text-amber-500 group-hover:text-amber-400 transition-colors" />
                                </span>
                                {unreadNotificationCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-[var(--sidebar-bg)]">
                                        {unreadNotificationCount}
                                    </span>
                                )}
                            </div>
                        </button>
                    </div>

                    {/* Inline Logout Confirmation */}
                    {showLogoutConfirm && (
                        <div className="mx-1 rounded-lg p-3 flex flex-col gap-2" style={{ background: 'var(--bg-color)', border: '1px solid rgba(239,68,68,0.35)' }}>
                            {!isCollapsed && (
                                <p className="text-[12px] font-semibold" style={{ color: 'var(--danger)', margin: 0 }}>Sign out of your account?</p>
                            )}
                            <div className={`flex gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
                                <button
                                    onClick={confirmLogout}
                                    className="flex-1 py-1.5 px-3 text-white text-[12px] font-semibold rounded-md transition-colors flex items-center justify-center gap-1"
                                    style={{ background: 'var(--danger)' }}
                                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                >
                                    <LogOut size={12} />
                                    {!isCollapsed && 'Sign out'}
                                </button>
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="flex-1 py-1.5 px-3 text-[12px] font-medium rounded-md transition-colors bg-transparent"
                                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    {isCollapsed ? '✕' : 'Cancel'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* User */}
                    {user && (
                        <div className={`mt-4 pt-4 border-t flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group hover:bg-[var(--sidebar-hover)] transition-all ${isCollapsed ? 'justify-center' : ''}`} style={{ borderColor: 'var(--border)' }}>
                            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white shadow-md group-hover:bg-blue-600 transition-colors">
                                <User size={26} className="transition-transform group-hover:scale-105" />
                            </div>
                            {!isCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <div className="text-[17px] font-extrabold text-[var(--text-main)] truncate transition-colors leading-tight">
                                        {user.username}
                                    </div>
                                    <div className="text-[12px] text-blue-500 font-extrabold uppercase tracking-widest mt-0.5">
                                        {user.role_name}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
