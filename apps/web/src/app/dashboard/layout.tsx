"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/Header";
import { useExtensionSync } from "@/hooks/useExtensionSync";
import { useServerSync } from "@/hooks/useServerSync";
import { useWebSocket } from "@/hooks/useWebSocket";
import { SessionGuard } from "@/components/providers/SessionGuard";
import { useAuthStore } from "@/store/authStore";
import { sendExtensionToken } from "@/lib/extension-auth";
import { PremiumLoader } from "@/components/ui/PremiumLoader";

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

  // Sync local store with backend API (fetch on mount)
  useServerSync();

  // Real-time sync via WebSocket (STOMP)
  useWebSocket();

  // Fetch authenticated user profile (fetchUser has internal guard to prevent duplicate fetches)
  const fetchUser = useAuthStore((s) => s.fetchUser);
  React.useEffect(() => {
    fetchUser();
  }, []); // Empty deps — fetchUser has internal hasFetched guard

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
      <PremiumLoader />
      <div className="h-screen overflow-hidden flex bg-bg">

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-white/[0.06] bg-[#0A0A0A] flex-col">
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
                  className="fixed left-0 top-0 z-50 h-screen w-72 bg-[#0A0A0A] border-r border-white/[0.06] md:hidden focus:outline-none"
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
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#121212]">

        {/* Mobile top bar (visible only on mobile) */}
        <header className="flex md:hidden h-14 items-center justify-between px-4 border-b border-white/[0.06] bg-[#0A0A0A] shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shadow-glow-sm">
              <CortexMark />
            </span>
            <span className="font-semibold text-sm tracking-tight">Cortex</span>
          </Link>
          <button
            onClick={() => setMobileOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.07] transition-all duration-150"
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
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
    </SessionGuard>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
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

