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
                if (!response.ok && typeof args[0] === 'string' && args[0].startsWith('/api/')) {
                    // Ignore expected 401s from the auth check endpoint
                    if (args[0] === '/api/auth/me' && response.status === 401) {
                        return response;
                    }
                    const clone = response.clone();
                    try {
                        const data = await clone.json();
                        if (data?.message && data.message !== "No message available") {
                            import("sonner").then(m => m.toast.error(data.message));
                        } else if (data?.error) {
                            import("sonner").then(m => m.toast.error(data.error));
                        } else {
                            import("sonner").then(m => m.toast.error(`Error: ${response.status} ${response.statusText}`));
                        }
                    } catch {
                        import("sonner").then(m => m.toast.error(`Error: ${response.status} ${response.statusText}`));
                    }
                }
                return response;
            } catch (err: any) {
                if (typeof args[0] === 'string' && args[0].startsWith('/api/')) {
                    import("sonner").then(m => m.toast.error(err?.message || "Network error: Could not reach the server."));
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
                    <Toaster theme="dark" position="bottom-right" richColors />
                </SearchProvider>
            </QueryProvider>
        </LenisProvider>
    );
}