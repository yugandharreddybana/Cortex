"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";
import { useSearchStore } from "@/store/useSearchStore";
import { useDashboardStore } from "@/store/dashboard";
import { useAuthStore } from "@/store/authStore";
import { NotificationBell } from "./NotificationBell";

interface DashboardHeaderProps {
  onOpenShortcuts?: () => void;
}

export function DashboardHeader({ onOpenShortcuts }: DashboardHeaderProps) {
  const setIsOpen           = useSearchStore((s) => s.setIsOpen);
  const newHighlightOpen    = useDashboardStore((s) => s.newHighlightDialogOpen);
  const setNewHighlightOpen = useDashboardStore((s) => s.setNewHighlightDialogOpen);
  const user                = useAuthStore((s) => s.user);

  // Scroll-aware elevation
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const handler = () => setScrolled(main.scrollTop > 4);
    main.addEventListener("scroll", handler, { passive: true });
    return () => main.removeEventListener("scroll", handler);
  }, []);

  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  React.useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const activeFolder    = useDashboardStore((s) => s.activeFolder);
  const folders         = useDashboardStore((s) => s.folders);
  const setActiveFolder = useDashboardStore((s) => s.setActiveFolder);
  const activeFolderObj = activeFolder ? folders.find(f => f.id === activeFolder) ?? null : null;

  const avatarInitial = user?.fullName
    ? user.fullName[0].toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      <motion.header
        className={cn(
          "h-14 shrink-0",
          "flex items-center justify-between gap-4",
          "px-6 lg:px-8",
          "bg-bg/70 backdrop-blur-xl",
          "border-b border-white/[0.05]",
          "sticky top-0 z-30",
          "transition-shadow duration-300",
        )}
        animate={{
          boxShadow: scrolled
            ? "inset 0 -1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.02)"
            : "inset 0 -1px 0 rgba(255,255,255,0.03)",
        }}
        transition={{ duration: 0.25 }}
      >
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Link
            href="/"
            className="text-xs text-white/25 select-none hover:text-white/50 transition-colors duration-200 ease-spatial px-1.5 py-0.5 rounded-md hover:bg-white/[0.04]"
          >
            Cortex
          </Link>
          <ChevronRightIcon />
          {activeFolderObj ? (
            <>
              <button
                onClick={() => setActiveFolder(null)}
                className="text-xs text-white/40 hover:text-white/70 transition-colors duration-200 ease-spatial px-1.5 py-0.5 rounded-md hover:bg-white/[0.04]"
              >
                Highlights
              </button>
              <ChevronRightIcon />
              <motion.span
                key={activeFolderObj.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="text-xs font-medium text-white/80 truncate max-w-[160px] px-1.5 py-0.5"
              >
                {activeFolderObj.emoji} {activeFolderObj.name}
              </motion.span>
            </>
          ) : (
            <span className="text-xs font-medium text-white/80 px-1.5 py-0.5">Highlights</span>
          )}

          {/* Online/offline animated pill */}
          <AnimatePresence mode="wait">
            <motion.span
              key={isOnline ? "online" : "offline"}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium",
                isOnline
                  ? "bg-success/8 text-success border border-success/15"
                  : "bg-danger/8 text-danger border border-danger/15",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isOnline
                    ? "bg-success shadow-[0_0_6px_rgba(74,222,128,0.5)]"
                    : "bg-danger shadow-[0_0_6px_rgba(248,113,113,0.5)] animate-pulse",
                )}
              />
              {isOnline ? "Synced" : "Offline"}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-2.5">
          {/* New Highlight */}
          <motion.button
            type="button"
            onClick={() => setNewHighlightOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "h-9 px-4 rounded-xl",
              "bg-accent text-white text-xs font-semibold",
              "shadow-[0_0_0_1px_rgba(99,102,241,0.4),0_2px_8px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]",
              "hover:bg-accent-light hover:shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_4px_16px_rgba(99,102,241,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]",
              "transition-colors duration-200 ease-spatial",
              "flex items-center gap-1.5",
              "max-md:px-2.5 max-md:w-9",
            )}
          >
            <PlusIcon />
            <span className="max-md:hidden">New Highlight</span>
          </motion.button>

          {/* Cmd+K trigger */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl",
              "text-xs text-white/35 border border-white/[0.06]",
              "bg-white/[0.03]",
              "transition-all duration-200 ease-spatial",
              "hover:border-white/[0.12] hover:text-white/60 hover:bg-white/[0.05]",
              "max-sm:hidden",
            )}
            aria-label="Open command palette (⌘K)"
          >
            <SearchIcon />
            <span className="max-md:hidden">Search</span>
            <span className="flex items-center gap-0.5 ml-1 max-md:hidden">
              <kbd className="text-[10px] bg-white/[0.05] border border-white/[0.08] rounded-md px-1.5 py-0.5 font-mono leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">⌘</kbd>
              <kbd className="text-[10px] bg-white/[0.05] border border-white/[0.08] rounded-md px-1.5 py-0.5 font-mono leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">K</kbd>
            </span>
          </button>

          {/* Mobile search */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-xl text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200 ease-spatial"
            aria-label="Search"
          >
            <SearchIcon />
          </button>

          {/* Keyboard shortcuts hint */}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl text-white/25 hover:text-white/55 hover:bg-white/[0.04] transition-all duration-200 ease-spatial"
              aria-label="Keyboard shortcuts (⌘/)"
              title="Keyboard shortcuts ⌘/"
            >
              <KeyboardIcon />
            </button>
          )}

          <NotificationBell />

          {/* Avatar */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "w-9 h-9 rounded-full overflow-hidden",
              "bg-accent/15 ring-[1.5px] ring-white/[0.10]",
              "flex items-center justify-center",
              "text-xs font-semibold text-accent-light",
              "transition-shadow duration-200 ease-spatial",
              "hover:ring-white/[0.20] hover:shadow-[0_0_12px_rgba(129,140,248,0.15)]",
            )}
            aria-label="User menu"
          >
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              avatarInitial
            )}
          </motion.button>
        </div>
      </motion.header>
    </>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function KeyboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1" y="3" width="12" height="8" rx="1.5" />
      <path d="M3.5 6h1M6.5 6h1M9.5 6h1M3.5 8.5h7" />
    </svg>
  );
}
