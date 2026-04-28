"use client";

import { useAuthStore } from "@/store/authStore";
import { useEffect, useRef } from "react";
import { sendExtensionToken } from "@/lib/extension-auth";
import { LenisProvider } from "@/components/providers/LenisProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SearchProvider } from "@/components/providers/SearchProvider";
import { Toaster } from "sonner";
import { useDashboardStore } from "@/store/dashboard";
import { GlobalLoaderHost } from "@/components/ui/Loader";

// ─── Eager Global Fetch Interceptor ──────────────────────────────────────────
// Registered in module scope for 100% coverage from the very first request.

// These endpoints are polled silently in the background.
// They must NOT trigger the global spinner or error toasts.
const SILENT_URL_PATTERNS = [
    "/api/notifications",
    "/api/notifications/unread-count",
    "/api/notifications/read-all",
    "/api/auth/me",       // 401 on this is expected when unauthenticated
    "/api/auth/ws-token",
    "/api/auth/refresh",
    "/api/highlights",
    "/api/folders",
    "/api/tags",
    "/api/smart-collections",
    "/api/api-keys",
];

if (typeof window !== "undefined") {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
        const input = args[0];
        const url =
            input instanceof Request
                ? input.url
                : typeof input === "string"
                ? input
                : (input as any)?.toString?.() ?? String(input);

        const isApiCall = url.includes("/api/");
        const isSilent = SILENT_URL_PATTERNS.some((p) => url.includes(p));
        const showLoader = isApiCall && !isSilent;

        if (showLoader) useDashboardStore.getState().startLoading();

        try {
            const response = await originalFetch(...args);

            // Silent endpoints: return as-is, no toasts, no spinner interference
            if (isSilent) return response;

            // 405 is an internal Next.js routing artefact — never surface to users
            if (!response.ok && response.status === 405) return response;

            if (!response.ok && isApiCall) {
                const clone = response.clone();
                try {
                    const data = await clone.json();
                    const { premiumToast } = await import("@/lib/premium-feedback");

                    if (response.status === 401) {
                        premiumToast.sessionExpired();
                    } else if (response.status === 403) {
                        premiumToast.unauthorized();
                    } else if (response.status === 409) {
                        if (
                            url.includes("/folders") &&
                            !url.includes("/request-access") &&
                            !url.includes("/access-requests")
                        ) {
                            premiumToast.folderExists(data.name || "Unknown");
                        } else if (url.includes("/tags")) {
                            premiumToast.tagExists(data.name || "Unknown");
                        }
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
            if (isApiCall && !isSilent) {
                import("@/lib/premium-feedback").then((m) =>
                    m.premiumToast.networkError()
                );
            }
            throw err;
        } finally {
            if (showLoader) useDashboardStore.getState().stopLoading();
        }
    };
}

export function Providers({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    const extensionHydrated = useRef(false);

    useEffect(() => {
        if (user && !extensionHydrated.current) {
            extensionHydrated.current = true;
            sendExtensionToken();
        }
    }, [user]);

    return (
        <LenisProvider>
            <QueryProvider>
                <SearchProvider>
                    {children}
                    <GlobalLoaderHost />
                    <Toaster theme="dark" position="top-right" richColors closeButton />
                </SearchProvider>
            </QueryProvider>
        </LenisProvider>
    );
}