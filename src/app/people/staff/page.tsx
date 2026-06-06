"use client";
import { Users } from "lucide-react";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, X, Upload, Camera, User } from "lucide-react";
import Image from "next/image";

type Staff = {
    id: number;
    name: string;
    phone: string;
    role: string;
    image_url: string | null;
};

type Role = {
    id: number;
    name: string;
};

export default function StaffPage() {
    const router = useRouter();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState({ name: "", phone: "", role: "Roof Estimator", image_url: "" as string | null });
    const [saving, setSaving] = useState(false);

    // Role modal
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");

    useEffect(() => {
        checkPermissions();
        fetchData();
    }, []);

    const checkPermissions = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const userData = await res.json();
                if (userData.user && userData.user.role_name !== 'Admin') {
                    const sRes = await fetch(`/api/staff/roles/${userData.user.role_id}/sub-permissions`);
                    if (sRes.ok) {
                        const perms = await sRes.json();
                        const clientPerm = perms.find((p: any) => p.module === 'People' && p.sub_module === 'Clients');
                        const staffPerm = perms.find((p: any) => p.module === 'People' && p.sub_module === 'Staff');
                        
                        if (staffPerm && !staffPerm.allowed) {
                            if (clientPerm && clientPerm.allowed) {
                                router.push('/people/clients');
                            } else {
                                router.push('/');
                            }
                        }
                        setClientsAllowed(!!clientPerm?.allowed || userData.user.role_name === 'Admin');
                    }
                } else {
                    setClientsAllowed(true);
                }
            }
        } catch { /* silent */ }
    };

    const [clientsAllowed, setClientsAllowed] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [staffRes, rolesRes] = await Promise.all([
                fetch("/api/agents"), // Keeping /api/agents as the base for now
                fetch("/api/staff/roles")
            ]);
            const staffData = await staffRes.json();
            const rolesData = await rolesRes.json();
            setStaff(staffData);
            setRoles(rolesData);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (member?: Staff) => {
        if (member) {
            setEditingStaff(member);
            setFormData({ name: member.name, phone: member.phone || "", role: member.role || "Roof Estimator", image_url: member.image_url });
        } else {
            setEditingStaff(null);
            setFormData({ name: "", phone: "", role: roles[0]?.name || "Roof Estimator", image_url: null });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingStaff(null);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: uploadData
            });
            const data = await res.json();
            if (data.url) {
                setFormData(prev => ({ ...prev, image_url: data.url }));
            }
        } catch (error) {
            alert("Failed to upload image");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const isEdit = !!editingStaff;
            const url = isEdit ? `/api/agents/${editingStaff.id}` : "/api/agents";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                await fetchData();
                closeModal();
            } else {
                alert("Failed to save staff member");
            }
        } catch (error) {
            alert("Error saving staff member");
        } finally {
            setSaving(false);
        }
    };

    const handleAddRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoleName) return;
        try {
            const res = await fetch("/api/staff/roles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newRoleName }),
            });
            if (res.ok) {
                const newRole = await res.json();
                setRoles(prev => [...prev, newRole].sort((a, b) => a.name.localeCompare(b.name)));
                setNewRoleName("");
                setIsRoleModalOpen(false);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to add role");
            }
        } catch (error) {
            alert("Error adding role");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this staff member?")) return;

        try {
            const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
            if (res.ok) {
                await fetchData();
            } else {
                alert("Failed to delete member");
            }
        } catch (error) {
            alert("Error deleting member");
        }
    };

    const filteredStaff = staff.filter(s => !selectedRole || s.role === selectedRole);

    return (
        <div>
            <div className="page-header mb-4">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-pink-500">
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">People & Directory</h1>
                        <p className="page-description">Manage client profiles and company staff directory</p>
                    </div>
                    <div className="tab-bar">
                        {clientsAllowed && <Link href="/people/clients" className="tab-btn">Client Profiles</Link>}
                        <div className="tab-btn active">Staff Directory</div>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    <Plus size={16} /> Add Staff Member
                </button>
            </div>

            <div className="mb-6 flex flex-wrap gap-2 items-center">
                <button 
                    onClick={() => setSelectedRole(null)}
                    className={`btn rounded-full px-3 py-1 text-sm ${selectedRole === null ? 'btn-primary' : 'btn-outline'}`}
                >
                    All Staff
                </button>
                {roles.map(role => (
                    <button 
                        key={role.id}
                        onClick={() => setSelectedRole(role.name)}
                        className={`btn rounded-full px-3 py-1 text-sm ${selectedRole === role.name ? 'btn-primary' : 'btn-outline'}`}
                    >
                        {role.name}
                    </button>
                ))}
                <button 
                    onClick={() => setIsRoleModalOpen(true)}
                    className="btn btn-outline rounded-full px-3 py-1 text-sm border-dashed"
                >
                    <Plus size={14} /> Add Role
                </button>
            </div>

            <div className="table-wrapper">
                <table className="table">
                    <thead>
                        <tr>
                            <th className="w-[60px]"></th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Phone Number</th>
                            <th className="w-[120px] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="text-center p-8">
                                    Loading staff...
                                </td>
                            </tr>
                        ) : filteredStaff.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center p-8 text-muted">
                                    No staff members found for this role.
                                </td>
                            </tr>
                        ) : (
                            filteredStaff.map((member) => (
                                <tr key={member.id}>
                                    <td>
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-color-alt)] flex items-center justify-center">
                                            {member.image_url ? (
                                                <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={20} className="text-muted" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="font-semibold">
                                        <Link href={`/people/estimators/${member.id}`} className="no-underline text-primary">
                                            {member.name}
                                        </Link>
                                    </td>
                                    <td>
                                        <span className="bg-[var(--bg-color-alt)] px-2 py-0.5 rounded text-xs">
                                            {member.role || "Staff"}
                                        </span>
                                    </td>
                                    <td className="text-muted">{member.phone || "-"}</td>
                                    <td className="text-right flex gap-2 justify-end pt-3">
                                        <button
                                            className="btn btn-outline p-1.5"
                                            onClick={() => openModal(member)}
                                            title="Edit Staff"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="btn btn-danger p-1.5"
                                            onClick={() => handleDelete(member.id)}
                                            title="Delete Staff"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Staff Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-header">
                                <div className="modal-title">{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</div>
                                <button type="button" className="btn p-1 bg-transparent" onClick={closeModal}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="flex justify-center mb-5">
                                    <div className="relative w-[100px] h-[100px]">
                                        <div className="w-full h-full rounded-full overflow-hidden bg-[var(--bg-color-alt)] flex items-center justify-center border-2">
                                            {formData.image_url ? (
                                                <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={40} className="text-muted" />
                                            )}
                                        </div>
                                        <label className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full cursor-pointer flex items-center justify-center shadow-md">
                                            <Camera size={16} />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                        </label>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Full Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. John Doe"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select 
                                        className="form-control"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        {roles.map(r => (
                                            <option key={r.id} value={r.name}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group mb-0">
                                    <label className="form-label">Phone Number (Optional)</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="e.g. 0800 000 0000"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? "Saving..." : "Save Member"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Role Modal */}
            {isRoleModalOpen && (
                <div className="modal-overlay" onClick={() => setIsRoleModalOpen(false)}>
                    <div className="modal-content max-w-[400px]" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleAddRole}>
                            <div className="modal-header">
                                <div className="modal-title">Add New Role</div>
                                <button type="button" className="btn p-1 bg-transparent" onClick={() => setIsRoleModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group mb-0">
                                    <label className="form-label">Role Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={newRoleName}
                                        onChange={e => setNewRoleName(e.target.value)}
                                        placeholder="e.g. Driver"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setIsRoleModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Add Role
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
}
