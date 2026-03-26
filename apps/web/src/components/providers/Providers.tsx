"use client";

import { useAuthStore } from "@/store/authStore";
import { useEffect, useRef } from "react";
import { sendExtensionToken } from "@/lib/extension-auth";
import { LenisProvider } from "@/components/providers/LenisProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SearchProvider } from "@/components/providers/SearchProvider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    const extensionHydrated = useRef(false);

    useEffect(() => {
        if (user) {
            // Hydrate the Chrome extension with auth token on every
            // authenticated page load.  Data hydration (CORTEX_INIT) is done
            // by useServerSync after it fetches from the API — single source
            // of truth avoids duplicate requests and race conditions.
            if (!extensionHydrated.current) {
                extensionHydrated.current = true;
                sendExtensionToken();
            }
        }
    }, [user]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
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
            }
        };
        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    return (
        <LenisProvider>
            <QueryProvider>
                <SearchProvider>
                    {children}
                    <Toaster theme="dark" position="top-right" richColors closeButton />
                </SearchProvider>
            </QueryProvider>
        </LenisProvider>
    );
}