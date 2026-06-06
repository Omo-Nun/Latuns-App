"use client";
import { Mail } from "lucide-react";

import { useState, useEffect } from "react";
import { Mail as MailIcon, Send, Settings, RefreshCw, Inbox, Paperclip, Search, Plus, X, ChevronLeft, Loader2, CheckCircle, Folder as FolderIcon, Trash2, User, ArrowUpDown, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/Toast";
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

type Email = {
    uid: number;
    subject: string;
    from: string;
    to?: string;
    date: string;
    text: string;
    html: string;
    attachments: any; // Can be a number (old API) or array of metadata objects
    read?: boolean;
};

export default function MailPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [setupRequired, setSetupRequired] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [currentFolder, setCurrentFolder] = useState('INBOX');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [folders, setFolders] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContact, setSelectedContact] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
    const [contactFilter, setContactFilter] = useState<string | null>(null);
    const [isSystemFoldersOpen, setIsSystemFoldersOpen] = useState(false);
    const [showSortOptions, setShowSortOptions] = useState(false);
    const [showFilterOptions, setShowFilterOptions] = useState(false);

    const fetchFolderList = async () => {
        try {
            const res = await fetch('/api/mail/folders');
            if (res.ok) setFolders(await res.json());
        } catch (e) { console.error("Failed to fetch folders"); }
    };

    // Settings state
    const [mailConfig, setMailConfig] = useState({
        imap_host: '',
        imap_port: 993,
        imap_secure: true,
        smtp_host: '',
        smtp_port: 465,
        smtp_secure: true,
        email: '',
        password: ''
    });

    // Compose state
    const [composeData, setComposeData] = useState<{
        to: string;
        subject: string;
        text: string;
        attachments: File[];
    }>({
        to: '',
        subject: '',
        text: '',
        attachments: []
    });
    const [sending, setSending] = useState(false);

    useEffect(() => {
        checkSettings();
    }, []);

    const checkSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/mail/settings');
            const data = await res.json();
            if (data.setup_required) {
                setSetupRequired(true);
                setShowSettings(true);
                setLoading(false);
            } else {
                setMailConfig(data);
                fetchFolderList();
                fetchInbox();
            }
        } catch (error) {
            setLoading(false);
        }
    };

    const fetchInbox = async (isBackground = false) => {
        if (!isBackground) {
            const cached = sessionStorage.getItem(`mail_${currentFolder}`);
            if (cached) {
                setEmails(JSON.parse(cached));
                setRefreshing(true);
            } else {
                setRefreshing(true);
                setSelectedEmail(null);
            }
        } else {
            setRefreshing(true);
        }
        
        try {
            const res = await fetch(`/api/mail/fetch?folder=${encodeURIComponent(currentFolder === 'CONTACTS' ? 'INBOX' : currentFolder)}&page=1`);
            const data = await res.json();
            
            if (res.ok) {
                setEmails(data);
                sessionStorage.setItem(`mail_${currentFolder}`, JSON.stringify(data));
                setPage(1);
                setHasMore(data.length === 30);
                setSetupRequired(false);
            } else {
                console.error("Mail fetch error:", data.error);
                let msg = data.error || "Failed to connect to mail server.";
                
                if (msg.includes("Command failed")) {
                    msg = "Authentication failed (Command failed). Please verify your email, password, and port settings. If using Gmail/Outlook, ensure you are using an App Password.";
                } else if (msg.includes("ECONNREFUSED")) {
                    msg = "Connection refused. Please verify the host address and port.";
                }

                toast.error(msg);
                setSetupRequired(true);
            }
        } catch (error) {
            console.error("Failed to fetch inbox", error);
            toast.error("Network error while connecting to mail server.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadMore = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const res = await fetch(`/api/mail/fetch?folder=${encodeURIComponent(currentFolder === 'CONTACTS' ? 'INBOX' : currentFolder)}&page=${nextPage}`);
            const data = await res.json();
            if (res.ok) {
                if (data.length === 0) {
                    setHasMore(false);
                } else {
                    setEmails(prev => [...prev, ...data]);
                    setPage(nextPage);
                    setHasMore(data.length === 30);
                }
            }
        } catch (error) {
            toast.error("Failed to load older emails");
        } finally {
            setLoadingMore(false);
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic validation to prevent common mistakes (like entering email as host)
        if (mailConfig.imap_host.includes('@')) {
            toast.error("IMAP Host should be a server address (e.g. imap.gmail.com), not an email address.");
            return;
        }
        if (mailConfig.smtp_host.includes('@')) {
            toast.error("SMTP Host should be a server address (e.g. smtp.gmail.com), not an email address.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/mail/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mailConfig)
            });
            if (res.ok) {
                setShowSettings(false);
                fetchInbox();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to save settings");
                setLoading(false);
            }
        } catch (error) {
            toast.error("Error saving settings");
            setLoading(false);
        }
    };

    const handleSendMail = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        try {
            const formData = new FormData();
            formData.append('to', composeData.to);
            formData.append('subject', composeData.subject);
            formData.append('html', composeData.text);
            formData.append('text', composeData.text.replace(/<[^>]+>/g, ''));
            
            composeData.attachments.forEach(file => {
                formData.append('attachments', file);
            });

            const res = await fetch('/api/mail/send', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                toast.success("Email sent successfully!");
                setShowCompose(false);
                setComposeData({ to: '', subject: '', text: '', attachments: [] });
                if (currentFolder === 'SENT') {
                    fetchInbox();
                }
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to send email");
            }
        } catch (error) {
            toast.error("Error sending email");
        } finally {
            setSending(false);
        }
    };

    const handleEmailSelect = async (email: Email) => {
        setSelectedEmail(email);
        if (email.read === false) {
            // Optimistic update
            setEmails(prev => prev.map(e => e.uid === email.uid ? { ...e, read: true } : e));
            try {
                await fetch('/api/mail/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'read', folder: currentFolder, uid: email.uid })
                });
            } catch (err) {
                console.error("Failed to mark as read");
            }
        }
    };

    const handleDelete = async () => {
        if (!selectedEmail) return;
        const uid = selectedEmail.uid;
        
        setEmails(prev => prev.filter(e => e.uid !== uid));
        setSelectedEmail(null);
        toast.success("Message moved to trash");

        try {
            await fetch('/api/mail/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'trash', folder: currentFolder, uid })
            });
        } catch (err) {
            console.error("Failed to delete message");
        }
    };

    const handleReply = () => {
        if (!selectedEmail) return;
        const fromEmail = selectedEmail.from.match(/<([^>]+)>/)?.[1] || selectedEmail.from;
        setComposeData({
            to: fromEmail,
            subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
            text: `<br><br><br><blockquote>--- Original Message ---<br>From: ${selectedEmail.from}<br>Date: ${format(new Date(selectedEmail.date), 'PPPP p')}<br>Subject: ${selectedEmail.subject}<br><br>${selectedEmail.html || selectedEmail.text}</blockquote>`,
            attachments: []
        });
        setShowCompose(true);
    };

    const handleForward = () => {
        if (!selectedEmail) return;
        setComposeData({
            to: '',
            subject: selectedEmail.subject.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject}`,
            text: `<br><br><br><blockquote>--- Forwarded Message ---<br>From: ${selectedEmail.from}<br>Date: ${format(new Date(selectedEmail.date), 'PPPP p')}<br>Subject: ${selectedEmail.subject}<br><br>${selectedEmail.html || selectedEmail.text}</blockquote>`,
            attachments: []
        });
        setShowCompose(true);
    };

    useEffect(() => {
        if (!setupRequired && mailConfig.email) {
            fetchInbox();
        }
    }, [currentFolder]);

    const filteredAndSortedEmails = emails
        .filter(email => 
            (email.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
             email.from.toLowerCase().includes(searchQuery.toLowerCase())) &&
            (!contactFilter || email.from.includes(contactFilter) || email.to?.includes(contactFilter))
        )
        .sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
        });

    const contacts = Array.from(new Set(emails.map(e => e.from))).map(email => {
        const firstEmail = emails.find(e => e.from === email);
        return {
            email,
            name: firstEmail?.from.split('<')[0].trim() || email,
            count: emails.filter(e => e.from === email || e.to?.includes(email)).length
        };
    }).sort((a, b) => a.name.localeCompare(b.name));

    if (loading && !refreshing && emails.length === 0) {
        return (
            <div className="h-[80vh] flex items-center justify-center flex-col gap-4">
                <Loader2 size={40} className="animate-spin text-primary" />
                <p className="text-muted">Connecting to your mail server...</p>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col">
            <div className="page-header mb-4">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-cyan-500">
                          <Mail size={24} />
                      </div>
                      <div>
                          <h1 className="page-title">Webmail Integration</h1>
                          <p className="page-description">Manage your company communications without leaving the platform</p>
                      </div>
                  </div>
                <div className="flex gap-3">
                    <button className="btn btn-outline" onClick={() => setShowSettings(true)}>
                        <Settings size={16} /> Server Settings
                    </button>
                    <button className="btn btn-primary shadow-md hover:shadow-lg active:scale-95 transition-all" onClick={() => setShowCompose(true)}>
                        <Plus size={16} /> Compose Email
                    </button>
                </div>
            </div>

            <div className="card flex-1 flex p-0 overflow-hidden">
                {/* Inbox Sidebar */}
                <div className="w-[220px] border-r border-[var(--border-subtle)] flex flex-col bg-[var(--bg-color)]">
                    <div className="p-4 font-bold text-muted text-xs uppercase tracking-wider flex justify-between items-center">
                        Folders
                    </div>
                    <div className="flex flex-col px-2">
                        {folders.length === 0 ? (
                            <>
                                <button
                                    onClick={() => setCurrentFolder('INBOX')}
                                    className={`nav-link !p-2.5 !gap-2.5 hover:bg-[var(--sidebar-hover)] ${currentFolder === 'INBOX' ? 'active' : ''}`}
                                >
                                    <Inbox size={18} /> Inbox
                                </button>
                                <button
                                    onClick={() => setCurrentFolder('SENT')}
                                    className={`nav-link !p-2.5 !gap-2.5 mt-1 hover:bg-[var(--sidebar-hover)] ${currentFolder === 'SENT' ? 'active' : ''}`}
                                >
                                    <Send size={18} /> Sent
                                </button>
                            </>
                        ) : (
                            folders.filter(f => !['DRAFTS', 'TRASH', 'JUNK', 'SPAM', 'BIN', 'DELETED ITEMS'].includes(f.name.toUpperCase())).map(folder => {
                                let Icon = FolderIcon;
                                if (folder.name.toUpperCase() === 'INBOX' || folder.specialUse === '\\Inbox') Icon = Inbox;
                                else if (folder.specialUse === '\\Sent' || folder.name.toUpperCase() === 'SENT') Icon = Send;
                                
                                return (
                                    <button
                                        key={folder.path}
                                        onClick={() => setCurrentFolder(folder.path)}
                                        className={`nav-link !p-2.5 !gap-2.5 mt-1 hover:bg-[var(--sidebar-hover)] ${currentFolder === folder.path ? "active" : ""}`}
                                    >
                                        <Icon size={18} /> {folder.name}
                                    </button>
                                );
                            })
                        )}

                        {folders.some(f => ['DRAFTS', 'TRASH', 'JUNK', 'SPAM', 'BIN', 'DELETED ITEMS'].includes(f.name.toUpperCase())) && (
                            <>
                                <button
                                    onClick={() => setIsSystemFoldersOpen(!isSystemFoldersOpen)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', 
                                        borderRadius: 'var(--radius-md)', cursor: 'pointer', border: 'none',
                                        backgroundColor: 'transparent', color: 'var(--text-muted)',
                                        fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em',
                                        textAlign: 'left', transition: 'all 0.2s', marginTop: '16px', width: '100%'
                                    }}
                                >
                                    System Folders
                                    {isSystemFoldersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {isSystemFoldersOpen && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px' }}>
                                        {folders
                                            .filter(f => ['DRAFTS', 'TRASH', 'JUNK', 'SPAM', 'BIN', 'DELETED ITEMS'].includes(f.name.toUpperCase()))
                                            .map(folder => {
                                                let Icon = FolderIcon;
                                                if (folder.specialUse === '\\Trash' || folder.name.toUpperCase() === 'TRASH' || folder.name.toLowerCase() === 'deleted items') Icon = Trash2;
                                                
                                                return (
                                                    <button
                                                        key={folder.path}
                                                        onClick={() => setCurrentFolder(folder.path)}
                                                        className={`nav-link !p-2.5 !gap-2.5 mt-1 hover:bg-[var(--sidebar-hover)] ${currentFolder === folder.path ? "active" : ""}`}
                                                    >
                                                        <Icon size={16} /> {folder.name}
                                                    </button>
                                                );
                                            })
                                        }
                                    </div>
                                )}
                            </>
                        )}

                        <div style={{ padding: '16px 8px 8px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '16px' }}>
                            Contacts
                        </div>
                        <button
                            onClick={() => {
                                setCurrentFolder('CONTACTS');
                                setSelectedEmail(null);
                            }}
                            className={`nav-link !p-2.5 !gap-2.5 mt-1 hover:bg-[var(--sidebar-hover)] ${currentFolder === "CONTACTS" ? "active" : ""}`}
                        >
                            <User size={18} /> All Contacts
                        </button>
                    </div>
                </div>

                {/* Email List */}
                <div className="w-[350px] border-r border-[var(--border-subtle)] flex flex-col bg-[var(--bg-color-alt)]">
                    <div className="p-4 border-b border-[var(--border-subtle)] flex flex-col gap-3 bg-[var(--bg-color)]">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 font-bold text-primary">
                                {currentFolder === 'CONTACTS' ? <User size={18} /> : (currentFolder === 'INBOX' ? <Inbox size={18} /> : <FolderIcon size={18} />)} 
                                {currentFolder === 'CONTACTS' ? 'Contacts' : (folders.find(f => f.path === currentFolder)?.name || (currentFolder === 'INBOX' ? 'Inbox' : currentFolder))}
                            </div>
                            <div className="flex gap-2">
                                {currentFolder !== 'CONTACTS' && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <div className="relative">
                                            <button 
                                                className={`btn p-1.5 rounded ${showSortOptions ? 'btn-primary' : 'btn-outline'}`}
                                                onClick={() => { setShowSortOptions(!showSortOptions); setShowFilterOptions(false); }}
                                                title="Sort Emails"
                                            >
                                                <ArrowUpDown size={16} />
                                            </button>
                                            {showSortOptions && (
                                                <div className="card" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 10, width: '120px', padding: '8px', boxShadow: 'var(--shadow-lg)' }}>
                                                    <button 
                                                        onClick={() => { setSortBy('newest'); setShowSortOptions(false); }}
                                                        style={{ width: '100%', textAlign: 'left', padding: '8px', background: 'transparent', border: 'none', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', color: sortBy === 'newest' ? 'var(--primary)' : 'var(--text-main)', fontWeight: sortBy === 'newest' ? 600 : 400 }}
                                                    >
                                                        Newest First
                                                    </button>
                                                    <button 
                                                        onClick={() => { setSortBy('oldest'); setShowSortOptions(false); }}
                                                        style={{ width: '100%', textAlign: 'left', padding: '8px', background: 'transparent', border: 'none', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', color: sortBy === 'oldest' ? 'var(--primary)' : 'var(--text-main)', fontWeight: sortBy === 'oldest' ? 600 : 400 }}
                                                    >
                                                        Oldest First
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <button 
                                                className={`btn p-1.5 rounded ${showFilterOptions ? 'btn-primary' : 'btn-outline'}`}
                                                onClick={() => { setShowFilterOptions(!showFilterOptions); setShowSortOptions(false); }}
                                                title="Filter by Contact"
                                            >
                                                <Filter size={16} />
                                            </button>
                                            {showFilterOptions && (
                                                <div className="card" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 10, width: '200px', padding: '8px', boxShadow: 'var(--shadow-lg)', maxHeight: '300px', overflowY: 'auto' }}>
                                                    <button 
                                                        onClick={() => { setContactFilter(null); setShowFilterOptions(false); }}
                                                        style={{ width: '100%', textAlign: 'left', padding: '8px', background: 'transparent', border: 'none', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', color: !contactFilter ? 'var(--primary)' : 'var(--text-main)', fontWeight: !contactFilter ? 600 : 400 }}
                                                    >
                                                        All Contacts
                                                    </button>
                                                    {contacts.map(c => (
                                                        <button 
                                                            key={c.email}
                                                            onClick={() => { setContactFilter(c.email); setShowFilterOptions(false); }}
                                                            style={{ width: '100%', textAlign: 'left', padding: '8px', background: 'transparent', border: 'none', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', color: contactFilter === c.email ? 'var(--primary)' : 'var(--text-main)', fontWeight: contactFilter === c.email ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                        >
                                                            {c.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <button 
                                    className={`btn p-1.5 rounded btn-outline`}
                                    onClick={() => fetchInbox(true)}
                                    disabled={refreshing}
                                    title="Refresh"
                                >
                                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>
                        <div className="relative">
                            <Search size={15} className="absolute text-muted left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input 
                                type="text" 
                                className="form-control text-[13px]" style={{ paddingLeft: '42px' }} 
                                placeholder={currentFolder === 'CONTACTS' ? "Search contacts..." : "Search emails..."} 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto">
                        {refreshing && emails.length === 0 ? (
                            <div className="p-10 text-center text-muted">
                                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: 'var(--primary)' }} />
                                <div style={{ fontSize: '13px', marginTop: '12px' }}>Loading...</div>
                            </div>
                        ) : currentFolder === 'CONTACTS' ? (
                            contacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No contacts found.</div>
                            ) : (
                                contacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email.toLowerCase().includes(searchQuery.toLowerCase())).map(contact => (
                                    <div 
                                        key={contact.email}
                                        onClick={() => setSelectedContact(contact.email)}
                                        style={{ 
                                            padding: '16px', 
                                            borderBottom: '1px solid var(--border-subtle)', 
                                            cursor: 'pointer',
                                            backgroundColor: selectedContact === contact.email ? 'var(--sidebar-active-bg)' : 'transparent',
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>{contact.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{contact.email}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px', fontWeight: 500 }}>{contact.count} message{contact.count !== 1 ? 's' : ''}</div>
                                    </div>
                                ))
                            )
                        ) : filteredAndSortedEmails.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                                No messages found.
                            </div>
                        ) : (
                            filteredAndSortedEmails.map(email => (
                                <div 
                                    key={email.uid} 
                                    onClick={() => handleEmailSelect(email)}
                                    style={{ 
                                        padding: '16px', 
                                        borderBottom: '1px solid var(--border-subtle)', 
                                        cursor: 'pointer',
                                        backgroundColor: selectedEmail?.uid === email.uid && currentFolder !== 'CONTACTS' ? 'var(--sidebar-active-bg)' : 'transparent',
                                        transition: 'background-color 0.2s',
                                        position: 'relative'
                                    }}
                                >
                                    {email.read === false && (
                                        <div style={{ position: 'absolute', top: '20px', left: '6px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', paddingLeft: '4px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: email.read === false ? 800 : 700, color: email.read === false ? 'var(--primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {email.from.split('<')[0].trim()}
                                        </div>
                                        <div style={{ fontSize: '11px', color: email.read === false ? 'var(--primary)' : 'var(--text-muted)', fontWeight: email.read === false ? 700 : 400 }}>
                                            {format(new Date(email.date), 'MMM d')}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: email.read === false ? 700 : 600, color: email.read === false ? 'var(--text-main)' : 'var(--primary)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: '4px' }}>
                                        {email.subject}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: '4px' }}>
                                        {email.text?.substring(0, 60)}...
                                    </div>
                                    {(Array.isArray(email.attachments) ? email.attachments.length > 0 : email.attachments > 0) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                                            <Paperclip size={12} /> {Array.isArray(email.attachments) ? email.attachments.length : email.attachments}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        {emails.length > 0 && hasMore && (
                            <button 
                                onClick={loadMore} 
                                disabled={loadingMore}
                                style={{ width: '100%', padding: '12px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
                            >
                                {loadingMore ? 'Loading...' : 'Load Older Messages'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Email Viewer */}
                <div className="flex-1 flex flex-col bg-[var(--bg-color-alt)] overflow-hidden">
                    {currentFolder === 'CONTACTS' && selectedContact && !selectedEmail ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '30px', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
                                    {selectedContact[0].toUpperCase()}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>{contacts.find(c => c.email === selectedContact)?.name || selectedContact}</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>{selectedContact} &bull; {emails.filter(e => e.from.includes(selectedContact) || e.to?.includes(selectedContact)).length} messages</p>
                                </div>
                            </div>
                            
                            <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '24px', marginLeft: '12px' }}>
                                {emails
                                    .filter(e => e.from.includes(selectedContact) || e.to?.includes(selectedContact))
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(email => (
                                        <div key={email.uid} className="relative">
                                            <div style={{ position: 'absolute', left: '-33px', top: '20px', width: '16px', height: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-color)', border: '2px solid var(--primary)', zIndex: 1 }} />
                                            <div 
                                                onClick={() => handleEmailSelect(email)}
                                                className="card"
                                                style={{ padding: '20px', cursor: 'pointer', backgroundColor: 'var(--bg-color-alt)' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--primary)' }}>{email.subject}</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{format(new Date(email.date), 'MMM d, yyyy p')}</span>
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-main)', opacity: 0.9, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {email.text?.substring(0, 300)}...
                                                </div>
                                                {(Array.isArray(email.attachments) ? email.attachments.length > 0 : email.attachments > 0) && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                                                        <Paperclip size={14} /> {Array.isArray(email.attachments) ? email.attachments.length : email.attachments} Attachment(s)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    ) : selectedEmail ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {currentFolder === 'CONTACTS' && (
                                <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-color-alt)' }}>
                                    <button 
                                        onClick={() => setSelectedEmail(null)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                                    >
                                        <ChevronLeft size={16} /> Back to Timeline
                                    </button>
                                </div>
                            )}
                            <div style={{ padding: '24px', backgroundColor: 'var(--bg-color-alt)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', margin: 0, paddingRight: '16px' }}>{selectedEmail.subject}</h2>
                                    <div className="flex gap-2">
                                        <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleReply}>
                                            Reply
                                        </button>
                                        <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleForward}>
                                            Forward
                                        </button>
                                        <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px', color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }} onClick={handleDelete}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                            {selectedEmail.from[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 700 }}>{selectedEmail.from}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To: {mailConfig.email}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {format(new Date(selectedEmail.date), 'PPPP p')}
                                    </div>
                                </div>
                            </div>
                            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: 'var(--bg-color-alt)' }}>
                                {selectedEmail.html ? (
                                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                                ) : (
                                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '15px' }}>{selectedEmail.text?.replace(/^>+\s?/gm, '')}</pre>
                                )}
                                
                                {Array.isArray(selectedEmail.attachments) && selectedEmail.attachments.length > 0 && (
                                    <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>
                                            {selectedEmail.attachments.length} Attachment{selectedEmail.attachments.length > 1 ? 's' : ''}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                            {selectedEmail.attachments.map((att: any, idx: number) => (
                                                <a 
                                                    key={idx} 
                                                    href={`/api/mail/attachment?folder=${encodeURIComponent(currentFolder)}&uid=${selectedEmail.uid}&filename=${encodeURIComponent(att.filename)}`}
                                                    download={att.filename}
                                                    target="_blank"
                                                    style={{ 
                                                        padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                                        display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-color-alt)',
                                                        textDecoration: 'none', cursor: 'pointer', color: 'inherit'
                                                    }}
                                                >
                                                    <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--row-odd)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                                        <Paperclip size={16} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {att.filename}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                            {Math.round(att.size / 1024)} KB
                                                        </div>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: 'var(--text-muted)' }}>
                            <MailIcon size={64} style={{ opacity: 0.1 }} />
                            <p>Select an email to read</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="modal-overlay" onClick={() => !setupRequired && setShowSettings(false)}>
                    <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleSaveSettings}>
                            <div className="modal-header">
                                <div className="modal-title">Mail Server Configuration</div>
                                {!setupRequired && (
                                    <button type="button" className="btn" style={{ padding: '4px' }} onClick={() => setShowSettings(false)}>
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                            <div className="modal-body">
                                {setupRequired && (
                                    <div style={{ padding: '12px', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', border: '1px solid #bfdbfe' }}>
                                        <strong>Setup Required</strong>: Please configure your IMAP and SMTP settings to use the webmail module.
                                    </div>
                                )}
                                
                                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--primary)' }}>Account Credentials</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Email Address</label>
                                        <input type="email" className="form-control shadow-sm focus:shadow-md" value={mailConfig.email} onChange={e => setMailConfig({...mailConfig, email: e.target.value})} required />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Password / App Password</label>
                                        <input type="password" className="form-control shadow-sm focus:shadow-md" value={mailConfig.password} onChange={e => setMailConfig({...mailConfig, password: e.target.value})} required />
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Tip: Gmail/Outlook require an <strong>App Password</strong>.</p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>Incoming (IMAP)</h3>
                                        <div className="form-group">
                                            <label className="form-label">Host</label>
                                            <input type="text" className="form-control shadow-sm focus:shadow-md" value={mailConfig.imap_host} onChange={e => setMailConfig({...mailConfig, imap_host: e.target.value})} placeholder="imap.gmail.com" required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Port</label>
                                            <input type="number" className="form-control shadow-sm focus:shadow-md" value={mailConfig.imap_port} onChange={e => setMailConfig({...mailConfig, imap_port: Number(e.target.value)})} required />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>Outgoing (SMTP)</h3>
                                        <div className="form-group">
                                            <label className="form-label">Host</label>
                                            <input type="text" className="form-control shadow-sm focus:shadow-md" value={mailConfig.smtp_host} onChange={e => setMailConfig({...mailConfig, smtp_host: e.target.value})} placeholder="smtp.gmail.com" required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Port</label>
                                            <input type="number" className="form-control shadow-sm focus:shadow-md" value={mailConfig.smtp_port} onChange={e => setMailConfig({...mailConfig, smtp_port: Number(e.target.value)})} required />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                {!setupRequired && <button type="button" className="btn btn-outline" onClick={() => setShowSettings(false)}>Cancel</button>}
                                <button type="submit" className="btn btn-primary shadow-md hover:shadow-lg active:scale-95 transition-all" disabled={loading}>
                                    {loading ? 'Testing...' : 'Save & Connect'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Compose Modal */}
            {showCompose && (
                <div className="modal-overlay" onClick={() => setShowCompose(false)}>
                    <div className="modal-content" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleSendMail}>
                            <div className="modal-header" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                                <div className="modal-title">New Message</div>
                                <button type="button" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} onClick={() => setShowCompose(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body" style={{ padding: 0 }}>
                                <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', width: '60px' }}>To:</span>
                                    <input type="email" className="form-control shadow-sm focus:shadow-md" style={{ border: 'none', boxShadow: 'none' }} value={composeData.to} onChange={e => setComposeData({...composeData, to: e.target.value})} required />
                                </div>
                                <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', width: '60px' }}>Subject:</span>
                                    <input type="text" className="form-control shadow-sm focus:shadow-md" style={{ border: 'none', boxShadow: 'none' }} value={composeData.subject} onChange={e => setComposeData({...composeData, subject: e.target.value})} required />
                                </div>
                                <div style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
                                    <ReactQuill 
                                        theme="snow"
                                        value={composeData.text} 
                                        onChange={(val) => setComposeData({...composeData, text: val})} 
                                        style={{ flex: 1, border: 'none', height: 'calc(100% - 42px)' }} 
                                    />
                                </div>
                                <div style={{ padding: '8px 24px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}><Paperclip size={16} /> Attachments:</span>
                                    <input type="file" multiple onChange={e => {
                                        if (e.target.files) {
                                            setComposeData({...composeData, attachments: [...composeData.attachments, ...Array.from(e.target.files)]});
                                        }
                                    }} style={{ fontSize: '13px' }} />
                                    {composeData.attachments.length > 0 && (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', marginTop: '8px' }}>
                                            {composeData.attachments.map((file, idx) => (
                                                <div key={idx} style={{ padding: '4px 8px', backgroundColor: 'var(--row-odd)', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {file.name}
                                                    <button type="button" onClick={() => setComposeData({...composeData, attachments: composeData.attachments.filter((_, i) => i !== idx)})} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)' }}><X size={12} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer" style={{ backgroundColor: 'var(--bg-color-alt)' }}>
                                <button type="button" className="btn btn-outline" onClick={() => {
                                    setShowCompose(false);
                                    setComposeData({ to: '', subject: '', text: '', attachments: [] });
                                }}>Discard</button>
                                <button type="submit" className="btn btn-primary shadow-md hover:shadow-lg active:scale-95 transition-all" disabled={sending} style={{ padding: '10px 24px' }}>
                                    {sending ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> Send Message</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
