"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@cortex/ui";
import { useSearchStore } from "@/store/useSearchStore";
import { useDashboardStore } from "@/store/dashboard";
import { useAuthStore } from "@/store/authStore";
import { NotificationBell } from "./NotificationBell";

// (Cmd+K items are now centralised in SearchProvider)

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * DashboardHeader — sticky 56px topbar for the main content area.
 *
 * Left  : breadcrumb / page title (passed via context in the future)
 * Right : Cmd+K search trigger + avatar
 */
export function DashboardHeader() {
  const setIsOpen           = useSearchStore((s) => s.setIsOpen);
  const newHighlightOpen    = useDashboardStore((s) => s.newHighlightDialogOpen);
  const setNewHighlightOpen = useDashboardStore((s) => s.setNewHighlightDialogOpen);
  const user                = useAuthStore((s) => s.user);

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

  const activeFolderObj = activeFolder
    ? folders.find((f) => f.id === activeFolder) ?? null
    : null;

  const avatarInitial = user?.fullName
    ? user.fullName[0].toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      <header
        className={cn(
          "h-14 shrink-0",
          "flex items-center justify-between gap-4",
          "px-6 border-b border-white/[0.06]",
          "bg-[#121212]/80 backdrop-blur-md",
          "sticky top-0 z-30",
        )}
      >
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="text-xs text-white/30 select-none hover:text-white/50 transition-colors">
            Cortex
          </Link>
          <ChevronRightIcon />
          {activeFolderObj ? (
            <>
              <button
                onClick={() => setActiveFolder(null)}
                className="text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                Highlights
              </button>
              <ChevronRightIcon />
              <span className="text-xs font-medium text-white/80 truncate">
                {activeFolderObj.emoji} {activeFolderObj.name}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-white/80 truncate">Highlights</span>
          )}

          {/* Online indicator */}
          <span
            className={cn(
              "ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-300",
              isOnline
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20",
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-400" : "bg-red-400")} />
            {isOnline ? "Synced" : "Offline"}
          </span>
        </div>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-3">
          {/* New Highlight */}
          <button
            type="button"
            onClick={() => setNewHighlightOpen(true)}
            className={cn(
              "h-8 px-3.5 rounded-lg",
              "bg-white text-black text-xs font-medium",
              "hover:bg-gray-200 active:scale-95",
              "transition-all duration-150",
              "flex items-center gap-1.5",
            )}
          >
            <PlusIcon />
            New Highlight
          </button>

          {/* Cmd+K trigger */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg",
              "text-xs text-white/40 border border-white/[0.07]",
              "bg-white/[0.03]",
              "transition-all duration-200 ease-snappy",
              "hover:border-white/[0.14] hover:text-white/70",
            )}
            aria-label="Open command palette (⌘K)"
          >
            <SearchIcon />
            <span>Search</span>
            <span className="flex items-center gap-0.5 ml-1">
              <kbd className="text-[10px] bg-white/[0.07] border border-white/10 rounded px-1 py-0.5 font-mono leading-none">⌘</kbd>
              <kbd className="text-[10px] bg-white/[0.07] border border-white/10 rounded px-1 py-0.5 font-mono leading-none">K</kbd>
            </span>
          </button>

          {/* Notifications */}
          <NotificationBell />

          {/* Avatar */}
          <button
            type="button"
            className={cn(
              "w-8 h-8 rounded-full overflow-hidden",
              "bg-accent/20 border border-accent/30",
              "flex items-center justify-center",
              "text-xs font-semibold text-accent",
              "transition-opacity duration-200 hover:opacity-80",
            )}
            aria-label="User menu"
          >
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              avatarInitial
            )}
          </button>
        </div>
      </header>

      {/* NewHighlightDialog is rendered globally by SearchProvider */}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
