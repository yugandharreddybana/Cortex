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
          "px-6 lg:px-8",
          // Glass frosted bar
          "bg-bg/70 backdrop-blur-xl",
          "border-b border-white/[0.05]",
          "shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)]",
          "sticky top-0 z-30",
        )}
      >
        {/* ── Breadcrumb — glass pill chain ── */}
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
              <span className="text-xs font-medium text-white/80 truncate max-w-[160px] px-1.5 py-0.5">
                {activeFolderObj.emoji} {activeFolderObj.name}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-white/80 px-1.5 py-0.5">Highlights</span>
          )}

          {/* Online indicator — luminous orb */}
          <span
            className={cn(
              "ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all duration-300 ease-spatial",
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
                  : "bg-danger shadow-[0_0_6px_rgba(248,113,113,0.5)]",
              )}
            />
            {isOnline ? "Synced" : "Offline"}
          </span>
        </div>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-2.5">
          {/* New Highlight — primary glass glow */}
          <button
            type="button"
            onClick={() => setNewHighlightOpen(true)}
            className={cn(
              "h-9 px-4 rounded-xl",
              "bg-accent text-white text-xs font-semibold",
              "shadow-[0_0_0_1px_rgba(99,102,241,0.4),0_2px_8px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]",
              "hover:bg-accent-light hover:shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_4px_16px_rgba(99,102,241,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]",
              "active:scale-[0.97] transform-gpu",
              "transition-all duration-200 ease-spatial",
              "flex items-center gap-1.5",
              // Hide text on mobile, show icon only
              "max-md:px-2.5 max-md:w-9",
            )}
          >
            <PlusIcon />
            <span className="max-md:hidden">New Highlight</span>
          </button>

          {/* Cmd+K trigger — glass pill */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl",
              "text-xs text-white/35 border border-white/[0.06]",
              "bg-white/[0.03]",
              "transition-all duration-200 ease-spatial",
              "hover:border-white/[0.12] hover:text-white/60 hover:bg-white/[0.05]",
              // Hide full button on mobile, show only icon
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

          {/* Mobile search — icon only */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-xl text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200 ease-spatial"
            aria-label="Search"
          >
            <SearchIcon />
          </button>

          {/* Notifications */}
          <NotificationBell />

          {/* Avatar — glass ring */}
          <button
            type="button"
            className={cn(
              "w-9 h-9 rounded-full overflow-hidden",
              "bg-accent/15 ring-[1.5px] ring-white/[0.10]",
              "flex items-center justify-center",
              "text-xs font-semibold text-accent-light",
              "transition-all duration-200 ease-spatial",
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
