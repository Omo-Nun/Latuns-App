"use client";
import { Settings } from "lucide-react";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, Trash2, Shield, Settings as SettingsIcon, Check, X, ChevronDown, ChevronRight, User, Key, Eye, EyeOff, History as HistoryIcon, ShieldAlert, Server } from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import NodeManagementPanel from "./components/NodeManagementPanel";

export default function SettingsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("general");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [settings, setSettings] = useState({
        bankName: "",
        accountName: "",
        accountNumber: "",
        companyPhone: "",
        companyAddress: "",
        companyWebsite: "",
        companyEmail: "",
        companyTagline: "",
        liveTileInterval: "3000",
    });

    // Roles & Permissions state
    const [roles, setRoles] = useState<any[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
    const [expandedRoles, setExpandedRoles] = useState<Set<number>>(new Set());
    const [rolePermissions, setRolePermissions] = useState<any[]>([]);
    const [roleSubPermissions, setRoleSubPermissions] = useState<any[]>([]);
    const [userSubPermissions, setUserSubPermissions] = useState<any[]>([]);
    const [permissionLoading, setPermissionLoading] = useState(false);
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

    // Credential Setup state
    const [credFormData, setCredFormData] = useState({ username: "", password: "" });
    const [savingCreds, setSavingCreds] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Subsidiaries
    const [subsidiaries, setSubsidiaries] = useState<string[]>([]);
    const [newSubsidiary, setNewSubsidiary] = useState("");

    // Password Change state
    const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [changingPassword, setChangingPassword] = useState(false);
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [settingsRes, authRes, rolesRes] = await Promise.all([
                fetch("/api/settings"),
                fetch("/api/auth/me"),
                fetch("/api/staff/grouped")
            ]);

            const settingsData = await settingsRes.json();
            const authData = await authRes.json();
            const rolesData = await rolesRes.json();

            if (!settingsRes.ok) throw new Error();

            setSettings({
                bankName: settingsData.bankName || "",
                accountName: settingsData.accountName || "",
                accountNumber: settingsData.accountNumber || "",
                companyPhone: settingsData.companyPhone || "",
                companyAddress: settingsData.companyAddress || "",
                companyWebsite: settingsData.companyWebsite || "",
                companyEmail: settingsData.companyEmail || "",
                companyTagline: settingsData.companyTagline || "",
                liveTileInterval: settingsData.liveTileInterval || "3000",
            });

            if (settingsData.subsidiaries) {
                try { setSubsidiaries(JSON.parse(settingsData.subsidiaries)); } catch { }
            } else {
                setSubsidiaries(['LATUNS ROOFING SYSTEM', 'LATUNS ESTATE DEVELOPERS']);
            }

            setUser(authData.user);
            if (Array.isArray(rolesData)) {
                setRoles(rolesData);
            } else {
                setRoles([]);
            }

            if (authData.user && authData.user.role_name !== 'Admin') {
                const sRes = await fetch(`/api/staff/roles/${authData.user.role_id}/sub-permissions`);
                if (sRes.ok) {
                    const perms = await sRes.json();
                    const settingsPerms = perms.filter((p: any) => p.module === 'Settings');
                    setUserSubPermissions(settingsPerms);
                    
                    // Check if current tab is allowed
                    const tabMap: any = { 'security': 'Staff', 'general': 'General', 'cluster': 'Node Management' };
                    const subName = tabMap[activeTab];
                    if (subName) {
                        const p = settingsPerms.find((sp: any) => sp.sub_module === subName);
                        if (p && !p.allowed) setActiveTab('account');
                    }
                }
            }
            
            if (rolesData.length > 0) {
                const firstRole = rolesData[0];
                setSelectedRoleId(firstRole.id);
                fetchPermissions(firstRole.id);
                fetchSubPermissions(firstRole.id);
                setExpandedRoles(new Set([firstRole.id]));
            }
        } catch {
            toast.error("Failed to load settings data");
        } finally {
            setLoading(false);
        }
    };

    const fetchPermissions = async (roleId: number) => {
        setPermissionLoading(true);
        try {
            const res = await fetch(`/api/staff/roles/${roleId}/permissions`);
            if (res.ok) {
                setRolePermissions(await res.json());
            }
        } catch {
            toast.error("Failed to fetch permissions");
        } finally {
            setPermissionLoading(false);
        }
    };

    const fetchSubPermissions = async (roleId: number) => {
        try {
            const res = await fetch(`/api/staff/roles/${roleId}/sub-permissions`);
            if (res.ok) {
                setRoleSubPermissions(await res.json());
            }
        } catch { /* silent */ }
    };

    const toggleSubPermission = async (module: string, sub_module: string, currentVal: number) => {
        if (!selectedRoleId) return;
        
        const newVal = currentVal ? 0 : 1;

        // Optimistic update
        setRoleSubPermissions(prev => prev.map(p => 
            (p.module === module && p.sub_module === sub_module) ? { ...p, allowed: newVal } : p
        ));

        try {
            const res = await fetch(`/api/staff/roles/${selectedRoleId}/sub-permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module,
                    sub_module,
                    allowed: !!newVal
                })
            });
            if (!res.ok) throw new Error();
        } catch {
            fetchSubPermissions(selectedRoleId);
            toast.error("Failed to update sub-permission");
        }
    };

    const togglePermission = async (module: string, field: 'can_view' | 'can_edit' | 'can_delete', currentVal: number) => {
        if (!selectedRoleId) return;
        
        const newVal = currentVal ? 0 : 1;

        // Optimistic update
        setRolePermissions(prev => prev.map(p => 
            p.module === module ? { ...p, [field]: newVal } : p
        ));

        try {
            const res = await fetch(`/api/staff/roles/${selectedRoleId}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module,
                    [field]: newVal
                })
            });
            if (!res.ok) throw new Error();
        } catch {
            fetchPermissions(selectedRoleId);
            toast.error("Failed to update permission");
        }
    };

    const handleCredSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStaff || !selectedRoleId) return;
        setSavingCreds(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...credFormData,
                    staffId: selectedStaff.id,
                    roleId: selectedRoleId
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Credentials updated successfully");
                // Refresh staff list to show updated username
                const rolesRes = await fetch("/api/staff/grouped");
                if (rolesRes.ok) setRoles(await rolesRes.json());
                setCredFormData(prev => ({ ...prev, password: "" }));
            } else {
                toast.error(data.error || "Failed to save credentials");
            }
        } catch {
            toast.error("Error saving credentials");
        } finally {
            setSavingCreds(false);
        }
    };

    const toggleRoleExpand = (roleId: number) => {
        const newExpanded = new Set(expandedRoles);
        if (newExpanded.has(roleId)) newExpanded.delete(roleId);
        else newExpanded.add(roleId);
        setExpandedRoles(newExpanded);
    };

    const toggleModuleExpand = (moduleName: string) => {
        const newExpanded = new Set(expandedModules);
        if (newExpanded.has(moduleName)) newExpanded.delete(moduleName);
        else newExpanded.add(moduleName);
        setExpandedModules(newExpanded);
    };

    const selectRole = (roleId: number) => {
        setSelectedRoleId(roleId);
        setSelectedStaff(null);
        fetchPermissions(roleId);
        fetchSubPermissions(roleId);
    };

    const selectStaff = (staff: any, roleId: number) => {
        setSelectedStaff(staff);
        setSelectedRoleId(roleId);
        setCredFormData({ username: staff.username || "", password: "" });
        setShowPassword(false);
        fetchPermissions(roleId);
        fetchSubPermissions(roleId);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...settings,
                subsidiaries: JSON.stringify(subsidiaries),
            };
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) toast.success("Settings saved successfully!");
            else toast.error("Failed to save settings.");
        } catch {
            toast.error("An error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    const addSubsidiary = () => {
        const trimmed = newSubsidiary.trim().toUpperCase();
        if (trimmed && !subsidiaries.includes(trimmed)) {
            setSubsidiaries([...subsidiaries, trimmed]);
            setNewSubsidiary("");
        }
    };

    const removeSubsidiary = (sub: string) => setSubsidiaries(subsidiaries.filter(s => s !== sub));

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error("New passwords do not match");
            return;
        }
        if (passwordForm.newPassword.length < 4) {
            toast.error("Password must be at least 4 characters");
            return;
        }

        setChangingPassword(true);
        try {
            const res = await fetch("/api/auth/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Password changed successfully!");
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            } else {
                toast.error(data.error || "Failed to change password");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setChangingPassword(false);
        }
    };

    const modules = ['Dashboard', 'Inventory', 'People', 'Quotations', 'Finances', 'Insights', 'Settings', 'Tasks', 'Mail'];

    return (
        <div>
            <div className="page-header">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-slate-500">
                        <Settings size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">Settings</h1>
                        <p className="page-description">Manage your company, bank details, and security roles</p>
                    </div>
                    <div className="tab-bar">
                        {(user?.role_name === 'Admin' || !!userSubPermissions.find(p => p.sub_module === 'General')?.allowed) && (
                            <button 
                                onClick={() => setActiveTab("general")}
                                className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
                            >
                                <SettingsIcon size={18} /> General Settings
                            </button>
                        )}
                        <button 
                            onClick={() => setActiveTab("account")}
                            className={`tab-btn ${activeTab === 'account' ? 'active' : ''}`}
                        >
                            <User size={18} /> My Account
                        </button>
                        {(user?.role_name === 'Admin' || !!userSubPermissions.find(p => p.sub_module === 'Staff')?.allowed) && (
                            <button 
                                onClick={() => setActiveTab("security")}
                                className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                            >
                                <Shield size={18} /> Roles & Permissions Matrix
                            </button>
                        )}
                        {(user?.role_name === 'Admin' || !!userSubPermissions.find(p => p.sub_module === 'Node Management')?.allowed) && (
                            <button 
                                onClick={() => setActiveTab("cluster")}
                                className={`tab-btn ${activeTab === 'cluster' ? 'active' : ''}`}
                            >
                                <Server size={18} /> Node Management
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className={`${activeTab === 'general' ? 'max-w-full' : 'max-w-full'}`}>
                {loading ? (
                    <div className="p-8 text-center text-muted">Loading...</div>
                ) : activeTab === 'general' ? (
                    <form onSubmit={handleSave} className="flex flex-col gap-6">

                        {/* Top Row: Company Details (left) | Bank Details + Subsidiaries (right) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Company Details */}
                            <div className="card">
                                <h2 className="mb-4 text-lg border-b pb-3">Company Details</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-group mb-0">
                                        <label className="form-label">Company Phone</label>
                                        <input type="text" name="companyPhone" value={settings.companyPhone} onChange={handleChange} className="form-control" placeholder="e.g. +234 800 000 0000" />
                                    </div>
                                    <div className="form-group mb-0">
                                        <label className="form-label">Company Email</label>
                                        <input type="email" name="companyEmail" value={settings.companyEmail} onChange={handleChange} className="form-control" placeholder="e.g. info@latuns.com" />
                                    </div>
                                    <div className="form-group mb-0">
                                        <label className="form-label">Company Website</label>
                                        <input type="text" name="companyWebsite" value={settings.companyWebsite} onChange={handleChange} className="form-control" placeholder="e.g. www.latuns.com" />
                                    </div>
                                    <div className="form-group mb-0">
                                        <label className="form-label">Live Tile Interval (ms)</label>
                                        <input type="number" min="1000" step="500" name="liveTileInterval" value={settings.liveTileInterval} onChange={handleChange} className="form-control" placeholder="e.g. 3000" />
                                    </div>
                                    <div className="form-group mb-0 col-span-2">
                                        <label className="form-label">Company Tagline (Invoices/Quotes)</label>
                                        <input type="text" name="companyTagline" value={settings.companyTagline} onChange={handleChange} className="form-control" placeholder="e.g. Quality Roofing for Generations" />
                                    </div>
                                    <div className="form-group mb-0 col-span-2">
                                        <label className="form-label">Company Address</label>
                                        <textarea name="companyAddress" value={settings.companyAddress} onChange={handleChange} className="form-control" placeholder="e.g. 123 Main St, City" rows={2} />
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Bank Details + Subsidiaries stacked */}
                            <div className="flex flex-col gap-6">
                                {/* Bank Details */}
                                <div className="card">
                                    <h2 className="mb-4 text-lg border-b pb-3">Bank Details</h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Bank Name</label>
                                            <input type="text" name="bankName" value={settings.bankName} onChange={handleChange} className="form-control" placeholder="e.g. Zenith Bank" />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Account Name</label>
                                            <input type="text" name="accountName" value={settings.accountName} onChange={handleChange} className="form-control" placeholder="e.g. Latuns Office" />
                                        </div>
                                        <div className="form-group mb-0 col-span-2">
                                            <label className="form-label">Account Number</label>
                                            <input type="text" name="accountNumber" value={settings.accountNumber} onChange={handleChange} className="form-control" placeholder="e.g. 1012345678" />
                                        </div>
                                    </div>
                                </div>

                                {/* Subsidiaries */}
                                <div className="card">
                                    <h2 className="mb-1 text-lg border-b pb-3">Subsidiary Companies</h2>
                                    <p className="text-sm text-muted mb-4">These appear as selectable options when creating or editing quotations.</p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                                        {subsidiaries.map(sub => (
                                            <div key={sub} style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--row-odd)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: "20px", fontSize: "13px" }}>
                                                <span style={{ fontWeight: 600 }}>{sub}</span>
                                                <button type="button" onClick={() => removeSubsidiary(sub)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <input type="text" className="form-control" value={newSubsidiary} onChange={e => setNewSubsidiary(e.target.value)} placeholder="New subsidiary name" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubsidiary())} style={{ maxWidth: "320px" }} />
                                        <button type="button" className="btn btn-outline" onClick={addSubsidiary}><Plus size={16} /> Add</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Row: Quotation Builder + Audit Log side-by-side */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="card flex justify-between items-center">
                                <div>
                                    <h2 className="text-base mb-1 font-semibold">Quotation Template Builder</h2>
                                    <p className="text-sm text-muted m-0">Customise colors, sections, and layout of exported/printed quotations.</p>
                                </div>
                                <Link href="/settings/quotation-template" className="btn btn-outline" style={{ textDecoration: 'none', flexShrink: 0, borderColor: "var(--primary)", color: "var(--primary)" }}>
                                    Open Template Builder
                                </Link>
                            </div>

                            {user?.role_name === 'Admin' && (
                                <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <h2 style={{ fontSize: "16px", marginBottom: "4px", fontWeight: 600 }}>System Audit Log</h2>
                                        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>View a detailed history of all significant system activities and mutations.</p>
                                    </div>
                                    <button type="button" className="btn btn-outline" onClick={() => router.push('/settings/audit-log')}>
                                        <HistoryIcon size={16} /> View Audit Log
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <Save size={16} />
                                {saving ? "Saving..." : "Save Settings"}
                            </button>
                        </div>
                    </form>
                ) : activeTab === 'account' ? (
                    <div style={{ maxWidth: '600px' }}>
                        <div className="card">
                            <h2 style={{ marginBottom: "20px", fontSize: "18px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Key size={20} /> Change Password
                            </h2>
                            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div className="form-group">
                                    <label className="form-label">Current Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type={showPasswords.current ? "text" : "password"} 
                                            className="form-control" 
                                            style={{ paddingRight: '40px' }}
                                            value={passwordForm.currentPassword} 
                                            onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} 
                                            required 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 flex text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer p-0"
                                        >
                                            {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">New Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type={showPasswords.new ? "text" : "password"} 
                                            className="form-control" 
                                            style={{ paddingRight: '40px' }}
                                            value={passwordForm.newPassword} 
                                            onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} 
                                            required 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 flex text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer p-0"
                                        >
                                            {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Confirm New Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type={showPasswords.confirm ? "text" : "password"} 
                                            className="form-control" 
                                            style={{ paddingRight: '40px' }}
                                            value={passwordForm.confirmPassword} 
                                            onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} 
                                            required 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 flex text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer p-0"
                                        >
                                            {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="submit" className="btn btn-primary" disabled={changingPassword}>
                                        {changingPassword ? "Updating..." : "Update Password"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                ) : activeTab === 'cluster' ? (
                    <NodeManagementPanel />
                ) : (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="flex min-h-[600px]">
                            {/* Roles Sidebar (Accordion) */}
                            <div className="w-[280px] border-r border-[var(--border-subtle)] bg-[var(--bg-color)] flex flex-col">
                                <div className="p-4 font-bold text-sm text-muted uppercase tracking-wider border-b border-[var(--border-subtle)]">
                                    Roles & Staff
                                </div>
                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                    {roles.map(role => (
                                        <div key={role.id} className="border-b border-[var(--border-subtle)]">
                                            <button
                                                onClick={() => {
                                                    toggleRoleExpand(role.id);
                                                    selectRole(role.id);
                                                }}
                                                className={`w-full p-3 px-4 text-left border-none cursor-pointer flex items-center justify-between font-semibold ${selectedRoleId === role.id && !selectedStaff ? 'bg-[var(--bg-color-alt)] text-primary' : 'bg-transparent text-[var(--text-muted)]'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {expandedRoles.has(role.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    {role.name}
                                                </span>
                                                <span className="text-[11px] bg-[var(--border)] px-1.5 py-0.5 rounded-full">{role.staff.length}</span>
                                            </button>
                                            
                                            {expandedRoles.has(role.id) && (
                                                <div style={{ backgroundColor: 'var(--bg-color-alt)', padding: '4px 0' }}>
                                                    {role.staff.length === 0 ? (
                                                        <div style={{ padding: '8px 40px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No staff members</div>
                                                    ) : role.staff.map((staff: any) => (
                                                        <div 
                                                            key={staff.id}
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px 16px 8px 40px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                background: selectedStaff?.id === staff.id ? 'var(--accent-light)' : 'transparent',
                                                            }}
                                                        >
                                                            <div 
                                                                onClick={() => selectStaff(staff, role.id)}
                                                                style={{
                                                                    flex: 1,
                                                                    cursor: 'pointer',
                                                                    fontSize: '13px',
                                                                    color: selectedStaff?.id === staff.id ? 'var(--accent)' : 'var(--text-muted)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px'
                                                                }}
                                                            >
                                                                <User size={14} />
                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                    <span>{staff.name}</span>
                                                                    {staff.username && <span style={{ fontSize: '10px', opacity: 0.7 }}>@{staff.username}</span>}
                                                                </div>
                                                            </div>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    selectStaff(staff, role.id);
                                                                }}
                                                                className="btn-icon"
                                                                style={{ padding: '4px', color: 'var(--text-muted)', borderRadius: '4px' }}
                                                                title="Manage Credentials"
                                                            >
                                                                <Key size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Matrix Content */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                {selectedStaff && (
                                    <div className="card" style={{ marginBottom: '24px', backgroundColor: 'var(--row-odd)', borderColor: 'var(--accent)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Key size={20} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Account Credentials for {selectedStaff.name}</h3>
                                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Setup login access for this staff member as a <strong>{roles.find(r => r.id === selectedRoleId)?.name}</strong>.</p>
                                            </div>
                                        </div>
                                        <form onSubmit={handleCredSubmit} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                                            <div style={{ flex: 1 }}>
                                                <label className="form-label" style={{ fontSize: '12px' }}>Username</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    value={credFormData.username} 
                                                    onChange={e => setCredFormData({...credFormData, username: e.target.value})} 
                                                    placeholder="e.g. john.doe"
                                                    required
                                                />
                                            </div>
                                            <div style={{ flex: 1, position: 'relative' }}>
                                                <label className="form-label" style={{ fontSize: '12px' }}>Password</label>
                                                <div style={{ position: 'relative' }}>
                                                    <input 
                                                        key={'pass_' + selectedStaff.id}
                                                        type={showPassword ? "text" : "password"} 
                                                        className="form-control" 
                                                        style={{ paddingRight: '40px' }}
                                                        value={credFormData.password} 
                                                        onChange={e => setCredFormData({...credFormData, password: e.target.value})} 
                                                        placeholder={selectedStaff.username ? "Leave blank to keep unchanged" : "Enter password"}
                                                        required={!selectedStaff.username}
                                                    />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setShowPassword(prev => !prev)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 flex text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer p-0"
                                                    >
                                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <button type="submit" className="btn btn-accent" disabled={savingCreds}>
                                                {savingCreds ? "Saving..." : selectedStaff.username ? "Update Account" : "Create Account"}
                                            </button>
                                            <button type="button" onClick={() => setSelectedStaff(null)} className="btn btn-outline">Cancel</button>
                                        </form>
                                    </div>
                                )}

                                <div style={{ marginBottom: '24px' }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
                                        Permission Matrix: {roles.find(r => r.id === selectedRoleId)?.name}
                                    </h2>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {selectedStaff 
                                            ? `This matrix defines what ${selectedStaff.name} can access based on their role.`
                                            : "Configure what this role can see and do across the system."
                                        } Changes are saved automatically.
                                    </p>
                                </div>

                                {permissionLoading ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading permissions...</div>
                                ) : (
                                    <div className="table-wrapper">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Module</th>
                                                    <th style={{ textAlign: 'center', width: '100px' }}>View</th>
                                                    <th style={{ textAlign: 'center', width: '100px' }}>Edit</th>
                                                    <th style={{ textAlign: 'center', width: '100px' }}>Delete</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {modules.map(moduleName => {
                                                    const perm = rolePermissions.find(p => p.module === moduleName) || { can_view: 0, can_edit: 0, can_delete: 0 };
                                                    const isAdminRole = roles.find(r => r.id === selectedRoleId)?.name === 'Admin';
                                                    const hasSubs = roleSubPermissions.some(p => p.module === moduleName);
                                                    const isExpanded = expandedModules.has(moduleName);
                                                    
                                                    return (
                                                        <React.Fragment key={moduleName}>
                                                            <tr style={{ backgroundColor: isExpanded ? 'var(--row-odd)' : 'transparent' }}>
                                                                <td style={{ fontWeight: 600 }}>
                                                                    <div className="flex items-center gap-2">
                                                                        {hasSubs && (
                                                                            <button 
                                                                                onClick={() => toggleModuleExpand(moduleName)}
                                                                                style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer', color: 'var(--text-muted)' }}
                                                                            >
                                                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                            </button>
                                                                        )}
                                                                        {moduleName}
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <button 
                                                                        onClick={() => !isAdminRole && togglePermission(moduleName, 'can_view', perm.can_view)}
                                                                        disabled={isAdminRole}
                                                                        style={{ 
                                                                            width: '24px', height: '24px', 
                                                                            borderRadius: '6px', 
                                                                            border: '1px solid var(--border)',
                                                                            backgroundColor: perm.can_view ? 'var(--primary)' : 'var(--bg-color)',
                                                                            color: 'white',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            cursor: isAdminRole ? 'not-allowed' : 'pointer',
                                                                            margin: '0 auto'
                                                                        }}
                                                                    >
                                                                        {perm.can_view ? <Check size={16} /> : <X size={16} style={{ color: 'var(--text-muted)' }} />}
                                                                    </button>
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <button 
                                                                        onClick={() => !isAdminRole && togglePermission(moduleName, 'can_edit', perm.can_edit)}
                                                                        disabled={isAdminRole}
                                                                        style={{ 
                                                                            width: '24px', height: '24px', 
                                                                            borderRadius: '6px', 
                                                                            border: '1px solid var(--border)',
                                                                            backgroundColor: perm.can_edit ? 'var(--primary)' : 'var(--bg-color)',
                                                                            color: 'white',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            cursor: isAdminRole ? 'not-allowed' : 'pointer',
                                                                            margin: '0 auto'
                                                                        }}
                                                                    >
                                                                        {perm.can_edit ? <Check size={16} /> : <X size={16} style={{ color: 'var(--text-muted)' }} />}
                                                                    </button>
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <button 
                                                                        onClick={() => !isAdminRole && togglePermission(moduleName, 'can_delete', perm.can_delete)}
                                                                        disabled={isAdminRole}
                                                                        style={{ 
                                                                            width: '24px', height: '24px', 
                                                                            borderRadius: '6px', 
                                                                            border: '1px solid var(--border)',
                                                                            backgroundColor: perm.can_delete ? 'var(--primary)' : 'var(--bg-color)',
                                                                            color: 'white',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            cursor: isAdminRole ? 'not-allowed' : 'pointer',
                                                                            margin: '0 auto'
                                                                        }}
                                                                    >
                                                                        {perm.can_delete ? <Check size={16} /> : <X size={16} style={{ color: 'var(--text-muted)' }} />}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && roleSubPermissions.filter(p => p.module === moduleName).map(sub => (
                                                                <tr key={`${moduleName}-${sub.sub_module}`} style={{ backgroundColor: 'var(--bg-color-alt)' }}>
                                                                    <td style={{ paddingLeft: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                                        <div className="flex items-center gap-2">
                                                                            <div style={{ width: '8px', height: '1px', backgroundColor: 'var(--border)' }}></div>
                                                                            {sub.sub_module}
                                                                        </div>
                                                                    </td>
                                                                    <td colSpan={3} style={{ textAlign: 'center' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                            <label className="switch" style={{ transform: 'scale(0.8)' }}>
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    checked={!!sub.allowed} 
                                                                                    onChange={() => toggleSubPermission(moduleName, sub.sub_module, sub.allowed)}
                                                                                    disabled={isAdminRole}
                                                                                />
                                                                                <span className="slider"></span>
                                                                            </label>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}


                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
