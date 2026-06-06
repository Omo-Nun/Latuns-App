"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import ToastContainer from "@/components/Toast";
import { Server, ArrowRight } from "lucide-react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === "/login";

    const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(10);

    // Global Poller for Handover Redirection
    useEffect(() => {
        if (isLoginPage) return; // Don't redirect from login if possible, or maybe we should? Let's leave it active everywhere but mostly inside app.

        const checkStatus = async () => {
            try {
                const res = await fetch('/api/cluster/status');
                if (res.ok) {
                    const data = await res.json();
                    if (data.nodeRole === 'Standby' && data.handover_redirect_url) {
                        setRedirectUrl(data.handover_redirect_url);
                    }
                }
            } catch (err) {
                // Ignore network errors silently for poller
            }
        };

        const interval = setInterval(checkStatus, 10000);
        checkStatus(); // Check immediately on mount
        return () => clearInterval(interval);
    }, [isLoginPage]);

    // Countdown effect
    useEffect(() => {
        if (redirectUrl && countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        } else if (redirectUrl && countdown === 0) {
            window.location.href = redirectUrl;
        }
    }, [redirectUrl, countdown]);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                document.body.classList.add("header-scrolled");
            } else {
                document.body.classList.remove("header-scrolled");
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    useEffect(() => {
        document.body.classList.remove("header-scrolled");
    }, [pathname]);

    return (
        <div className={`app-layout ${isLoginPage ? "no-sidebar" : ""}`}>
            {redirectUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Server size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Node Handover</h2>
                        <p className="text-gray-600 mb-6">
                            This node is stepping down to Standby mode. You are being redirected to the new Primary node automatically.
                        </p>
                        <div className="text-4xl font-black text-amber-500 mb-6">
                            {countdown}s
                        </div>
                        <a href={redirectUrl} className="btn btn-primary w-full flex items-center justify-center gap-2 py-3 text-lg">
                            Go to New Node Now <ArrowRight size={20} />
                        </a>
                    </div>
                </div>
            )}
            {!isLoginPage && <Sidebar />}
            <main className="main-content">
                {children}
            </main>
            <ToastContainer />
        </div>
    );
}
