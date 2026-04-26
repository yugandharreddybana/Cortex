"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/Header";
import { BottomTabBar } from "@/components/dashboard/BottomTabBar";
import { useExtensionSync } from "@/hooks/useExtensionSync";
import { useServerSync } from "@/hooks/useServerSync";
import { useWebSocket } from "@/hooks/useWebSocket";
import { SessionGuard } from "@/components/providers/SessionGuard";
import { useAuthStore } from "@/store/authStore";
import { sendExtensionToken } from "@/lib/extension-auth";
import { SelectionBookmarkPlugin } from "@/components/dashboard/SelectionBookmarkPlugin";

/**
 * Dashboard Route Layout — responsive
 *
 * Desktop (md+):
 *  ┌──────────┬────────────────────────────────────────┐
 *  │ Sidebar  │  Header (sticky top)                   │
 *  │ w-64     ├────────────────────────────────────────┤
 *  │          │  <page content>                        │
 *  └──────────┴────────────────────────────────────────┘
 *
 * Mobile (<md):
 *  Fixed h-14 mobile header with hamburger → Radix Dialog sheet from left
 *
 * SelectionBookmarkPlugin is mounted here (once) so bookmark selection
 * and navigation works across every dashboard page — highlights, AI chat,
 * folders, read view, settings, etc. — without per-page wiring.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for highlights synced from the Cortex Chrome Extension
  useExtensionSync();

  // Real-time sync via WebSocket (STOMP)
  useWebSocket();
  
  // Auth state used for synchronization gating
  const { user, hasFetched: authFetched, fetchUser } = useAuthStore();

  // Sync local store with backend API (fetch on mount)
  useServerSync(user, authFetched);

  // Fetch authenticated user profile (fetchUser has internal guard to prevent duplicate fetches)
  React.useEffect(() => {
    fetchUser();
  }, [fetchUser]); // Stable from store

  // Refresh extension token on every dashboard mount so the extension
  // always has a valid token (fire-and-forget, non-blocking)
  React.useEffect(() => {
    void sendExtensionToken();
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <SessionGuard>
      {/* SelectionBookmarkPlugin — global bookmark capture + navigation.
          Mounted once here so it covers every dashboard page: highlights,
          AI chat, folders, read view, settings, etc. */}
      <SelectionBookmarkPlugin />

      <div className="h-screen overflow-hidden flex bg-bg">

        {/* Ambient light source */}
        <div className="pointer-events-none fixed top-0 left-1/3 w-[600px] h-[400px] bg-accent/[0.03] blur-[120px] rounded-full -translate-y-1/2 z-0" aria-hidden="true" />

        {/* ── Desktop sidebar (hidden on mobile) ── */}
        <aside className="hidden md:flex w-64 shrink-0 border-r border-white/[0.06] bg-bg flex-col overflow-hidden">
          <Sidebar />
        </aside>

        {/* ── Mobile sidebar sheet ── */}
        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <AnimatePresence>
            {mobileOpen && (
              <Dialog.Portal forceMount>
                <Dialog.Overlay asChild>
                  <motion.div
                    key="mobile-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                  />
                </Dialog.Overlay>
                <Dialog.Content asChild>
                  <motion.div
                    key="mobile-sidebar"
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.9 }}
                    className="fixed left-0 top-0 z-50 h-screen w-72 bg-bg border-r border-white/[0.06] md:hidden focus:outline-none"
                  >
                    <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                    <Dialog.Description className="sr-only">Main navigation sidebar</Dialog.Description>
                    <Sidebar onCmdK={() => setMobileOpen(false)} />
                  </motion.div>
                </Dialog.Content>
              </Dialog.Portal>
            )}
          </AnimatePresence>
        </Dialog.Root>

        {/* ── Main area ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-bg">
          {/* Mobile top bar (visible only on mobile) */}
          <header className="flex md:hidden h-14 items-center justify-between px-4 border-b border-white/[0.04] bg-bg/80 backdrop-blur-xl shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shadow-[0_0_12px_rgba(129,140,248,0.3)]">
                <CortexMark />
              </span>
              <span className="font-semibold text-sm tracking-tight">Cortex</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.07] transition-all duration-200 ease-spatial"
              aria-label="Open navigation"
            >
              <HamburgerIcon />
            </button>
          </header>

          {/* Desktop header (hidden on mobile) */}
          <div className="hidden md:block">
            <DashboardHeader />
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto pb-14 md:pb-0">
            {children}
          </main>

          {/* Mobile bottom tab bar */}
          <BottomTabBar />
        </div>
      </div>
    </SessionGuard>
  );
}

// Icon components (inline SVG for better control and performance)
function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 5h12M3 9h12M3 13h12" />
    </svg>
  );
}

function CortexMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="6" r="4" />
      <path d="M6 4v2l1.5 1.5" />
    </svg>
  );
}
