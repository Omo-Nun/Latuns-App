"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                setError(data.error || 'Invalid credentials');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f6f8fb] to-[#e2e8f0] p-5">
            <div className="dark-theme-provider w-full max-w-[420px]">
                <div className="card p-10 shadow-xl border-none rounded-3xl bg-white">
                    <div className="text-center mb-8">
                        <Image 
                            src="/Logo 2026.svg" 
                            alt="Latuns Logo" 
                            width={180} 
                            height={60} 
                            className="object-contain mb-4 mx-auto"
                            priority
                        />
                        <h1 className="text-2xl font-extrabold text-[#1e293b] mb-2">Welcome Back</h1>
                        <p className="text-[#64748b] text-sm">Please enter your details to sign in</p>
                    </div>

                    {error && (
                        <div className="bg-red-100 text-red-700 p-3 rounded-xl text-sm mb-6 text-center font-medium border border-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group mb-5">
                            <label className="form-label text-[#475569]">Username</label>
                            <div className="relative">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    className="form-control pl-11 h-[50px] rounded-xl border-[#e2e8f0]"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group mb-8">
                            <label className="form-label text-[#475569]">Password</label>
                            <div className="relative">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-control pl-11 pr-11 h-[50px] rounded-xl border-[#e2e8f0]"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] bg-transparent border-none cursor-pointer p-0"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn w-full h-[50px] rounded-xl text-base font-bold text-white bg-[#2325A1] hover:bg-[#1a1c7a] shadow-md transition-colors" 
                            disabled={loading}
                        >
                            {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-[#94a3b8] text-[13px]">
                            &copy; 2026 Latuns Roofing System. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
