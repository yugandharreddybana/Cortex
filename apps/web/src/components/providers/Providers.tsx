"use client";

import { useAuthStore } from "@/store/authStore";
import { useEffect, useRef } from "react";
import { sendExtensionToken } from "@/lib/extension-auth";
import { LenisProvider } from "@/components/providers/LenisProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SearchProvider } from "@/components/providers/SearchProvider";
import { Toaster } from "sonner";
import { useDashboardStore } from "@/store/dashboard";
import { GlobalLoader } from "@/components/ui/GlobalLoader";

// ─── Eager Global Fetch Interceptor ──────────────────────────────────────────
// Registering in module scope ensures 100% coverage from the very first request
if (typeof window !== "undefined") {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        // Start global loader
        useDashboardStore.getState().startLoading();
        try {
            const response = await originalFetch(...args);
            const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;

            if (!response.ok && url.includes('/api/')) {
                // Ignore expected 401s from the auth check endpoint
                if (url.endsWith('/api/auth/me') && response.status === 401) {
                    return response;
                }

                const clone = response.clone();
                try {
                    const data = await clone.json();
                    const { premiumToast } = await import("@/lib/premium-feedback");

                    if (response.status === 401) {
                        premiumToast.sessionExpired();
                    } else if (response.status === 403) {
                        premiumToast.unauthorized();
                    } else if (response.status === 409) {
                        if (url.includes('/folders')) premiumToast.folderExists(data.name || "Unknown");
                        else if (url.includes('/tags')) premiumToast.tagExists(data.name || "Unknown");
                        else premiumToast.genericError("Conflict", "This item already exists.");
                    } else if (data?.message && data.message !== "No message available") {
                        premiumToast.genericError(data.message);
                    } else {
                        premiumToast.serverError();
                    }
                } catch {
                    const { premiumToast } = await import("@/lib/premium-feedback");
                    premiumToast.serverError();
                }
            }
            return response;
        } catch (err: any) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
            if (url.includes('/api/')) {
                import("@/lib/premium-feedback").then(m => m.premiumToast.networkError());
            }
            throw err;
        } finally {
            // Stop global loader
            useDashboardStore.getState().stopLoading();
        }
    };
}

export function Providers({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    const extensionHydrated = useRef(false);

    useEffect(() => {
        if (user) {
            if (!extensionHydrated.current) {
                extensionHydrated.current = true;
                sendExtensionToken();
            }
        }
    }, [user]);

    return (
        <LenisProvider>
            <QueryProvider>
                <SearchProvider>
                    {children}
                    <GlobalLoader />
                    <Toaster theme="dark" position="top-right" richColors closeButton />
                </SearchProvider>
            </QueryProvider>
        </LenisProvider>
    );
}