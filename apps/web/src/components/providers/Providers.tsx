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