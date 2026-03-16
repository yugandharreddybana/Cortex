"use client";

import * as React from "react";
import { cn } from "@cortex/ui";
import { Sidebar } from "./Sidebar";
import { HighlightsGrid } from "./HighlightsGrid";
import { CommandPalette } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";


const NewTagDialog = React.lazy(() => import("./NewTagDialog").then(module => ({ default: module.NewTagDialog })));

export function DashboardLayout() {
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);

  // Command Palette items, including Create Tag
  const CMD_ITEMS = React.useMemo(() => [
    { id: "1", label: "New Folder",       group: "Create",   shortcut: ["⌘", "⇧", "N"] },
    { id: "2", label: "New Highlight",    group: "Create",   shortcut: ["⌘", "N"]       },
    { id: "create-tag", label: "Create Tag", group: "Create", shortcut: ["T"], onSelect: () => setTagDialogOpen(true) },
    { id: "3", label: "All Highlights",   group: "Navigate", shortcut: ["G", "H"]       },
    { id: "4", label: "Settings",         group: "Navigate", shortcut: ["⌘", ","]       },
    { id: "5", label: "Export Library",   group: "Actions"                              },
    { id: "6", label: "Keyboard Shortcuts", group: "Help",   shortcut: ["⌘", "/"]      },
  ], []);

  // Global Cmd+K
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-primary">
      {/* ── Sidebar ── */}
      <Sidebar onCmdK={() => setCmdOpen(true)} />

      {/* ── Main ── */}
      <main
        className={cn(
          "flex-1 overflow-y-auto",
          "bg-[#121212]",
        )}
      >
        {/* Header */}
        <DashboardHeader />

        {/* Content */}
        <div className="p-6 lg:p-8">
          <HighlightsGrid />
        </div>
      </main>

      {/* ── Cmd+K ── */}
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={CMD_ITEMS}
        placeholder="Search highlights, folders, actions..."
      />

      {/* NewTagDialog for Command Palette */}
      <React.Suspense fallback={null}>
        <NewTagDialog open={tagDialogOpen} onOpenChange={setTagDialogOpen} />
      </React.Suspense>
    </div>
  );
}

// ─── Top header bar ───────────────────────────────────────────────────────────
function DashboardHeader() {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3",
        "h-14 px-6 lg:px-8",
        "bg-[#121212]/90 backdrop-blur-lg",
        "border-b border-white/[0.06]",
      )}
    >
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        <span className="text-muted">Library</span>
        <span className="text-muted/40">/</span>
        <span className="text-secondary">All Highlights</span>
      </nav>

      <div className="flex-1" />

      {/* Sort / filter pills */}
      <div className="flex items-center gap-2">
        {(["Recent", "Oldest", "Site"] as const).map((label) => (
          <button
            key={label}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium",
              "text-muted border border-white/[0.06]",
              "transition-all duration-200 ease-snappy",
              "hover:text-secondary hover:bg-white/[0.04] hover:border-white/[0.10]",
              label === "Recent" && "text-primary bg-white/[0.07] border-white/[0.12]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}
