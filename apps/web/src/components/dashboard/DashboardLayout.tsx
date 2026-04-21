"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@cortex/ui";
import { Sidebar } from "./Sidebar";
import { HighlightsMasonry } from "./HighlightsMasonry";
import { ViewControlBar } from "./ViewControlBar";
import { DashboardHeader } from "./Header";
import { CommandPalette } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { toast } from "sonner";

const NewTagDialog = React.lazy(() => import("./NewTagDialog").then(module => ({ default: module.NewTagDialog })));
const NewHighlightDialog = React.lazy(() => import("./NewHighlightDialog").then(module => ({ default: module.NewHighlightDialog })));
const FolderCreateDialog = React.lazy(() => import("./FolderCreateDialog").then(module => ({ default: module.FolderCreateDialog })));

const SORT_LABELS: Record<"recent" | "oldest" | "site", string> = {
  recent: "Recent",
  oldest: "Oldest",
  site:   "Site",
};

export function DashboardLayout() {
  const router = useRouter();
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false);
  const [initError, setInitError] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState(false);

  const highlights          = useDashboardStore((s) => s.highlights);
  const sortOrder           = useDashboardStore((s) => s.sortOrder);
  const setSortOrder        = useDashboardStore((s) => s.setSortOrder);
  const newHighlightOpen    = useDashboardStore((s) => s.newHighlightDialogOpen);
  const setNewHighlightOpen = useDashboardStore((s) => s.setNewHighlightDialogOpen);
  const fetchFolders            = useDashboardStore((s) => s.fetchFolders);
  const fetchTags               = useDashboardStore((s) => s.fetchTags);
  const fetchSmartCollections   = useDashboardStore((s) => s.fetchSmartCollections);

  // Initial data fetch with error handling (FIX 43)
  const doFetch = React.useCallback(async () => {
    try {
      await Promise.all([fetchFolders(), fetchTags(), fetchSmartCollections()]);
      setInitError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setInitError(msg);
      toast.error("Failed to load your data. Please retry.");
    }
  }, [fetchFolders, fetchTags, fetchSmartCollections]);

  React.useEffect(() => {
    void doFetch();
  }, [doFetch]);

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

  // FIX 44 — Keyboard shortcut "N" for New Highlight
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" || e.key === "N") {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.hasAttribute("contenteditable"))) return;
        setNewHighlightOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setNewHighlightOpen]);

  // Export library as JSON (for CMD_ITEMS)
  const handleExportLibrary = React.useCallback(() => {
    const data = JSON.stringify(highlights, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `cortex-library-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Library exported");
  }, [highlights]);

  // Command Palette items (FIX 3)
  const CMD_ITEMS = React.useMemo(() => [
    {
      id: "create-highlight",
      label: "New Highlight",
      group: "Create",
      shortcut: ["⌘", "N"],
      onSelect: () => setNewHighlightOpen(true),
    },
    {
      id: "create-folder",
      label: "New Folder",
      group: "Create",
      shortcut: ["⌘", "⇧", "N"],
      onSelect: () => setFolderDialogOpen(true),
    },
    {
      id: "create-tag",
      label: "Create Tag",
      group: "Create",
      shortcut: ["T"],
      onSelect: () => setTagDialogOpen(true),
    },
    {
      id: "go-favorites",
      label: "Favorites",
      group: "Navigate",
      shortcut: ["G", "F"],
      onSelect: () => router.push("/dashboard/favorites"),
    },
    {
      id: "go-archive",
      label: "Archive",
      group: "Navigate",
      shortcut: ["G", "A"],
      onSelect: () => router.push("/dashboard/archive"),
    },
    {
      id: "go-trash",
      label: "Trash",
      group: "Navigate",
      shortcut: ["G", "T"],
      onSelect: () => router.push("/dashboard/trash"),
    },
    {
      id: "export-library",
      label: "Export Library",
      group: "Actions",
      onSelect: handleExportLibrary,
    },
    {
      id: "keyboard-shortcuts",
      label: "Keyboard Shortcuts",
      group: "Help",
      shortcut: ["⌘", "/"],
    },
  ], [setNewHighlightOpen, setFolderDialogOpen, router, handleExportLibrary]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-primary">
      {/* ── Ambient background light source ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-ambient-light opacity-60"
      />

      {/* ── Sidebar ── */}
      <Sidebar onCmdK={() => setCmdOpen(true)} />

      {/* ── Main ── */}
      <main
        className={cn(
          "flex-1 overflow-y-auto flex flex-col relative z-[1]",
          "bg-bg",
        )}
      >
        {/* Header */}
        <DashboardHeader />

        {/* Sort pills — glass pill design */}
        <div className="flex items-center gap-2 px-6 lg:px-8 pt-4 pb-2">
          {(["recent", "oldest", "site"] as const).map((key) => {
            const labels: Record<typeof key, string> = SORT_LABELS;
            return (
              <button
                key={key}
                onClick={() => setSortOrder(key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-medium",
                  "transition-all duration-200 ease-spatial",
                  sortOrder === key
                    ? "text-primary bg-white/[0.08] border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_12px_rgba(129,140,248,0.08)]"
                    : "text-muted border border-transparent hover:text-secondary hover:bg-white/[0.04] hover:border-white/[0.06]",
                )}
              >
                {labels[key]}
              </button>
            );
          })}
        </div>

        {/* Init error banner — glass card with icon */}
        {initError && (
          <div className="mx-6 lg:mx-8 mb-2 px-4 py-3 rounded-2xl glass border-danger/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-danger/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-danger" aria-hidden>
                  <path d="M8 5v3.5M8 10.5h.01M14 8A6 6 0 112 8a6 6 0 0112 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm text-danger/80 truncate">{initError}</p>
            </div>
            <button
              onClick={async () => {
                setRetrying(true);
                await doFetch();
                setRetrying(false);
              }}
              disabled={retrying}
              className="shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-xl bg-white/[0.06] text-secondary hover:bg-white/[0.10] hover:text-primary transition-all duration-200 ease-spatial disabled:opacity-50"
            >
              {retrying ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}

        {/* ViewControlBar */}
        <ViewControlBar />

        {/* Content */}
        <div className="flex-1 px-6 lg:px-8 pb-6 lg:pb-8">
          <HighlightsMasonry />
        </div>
      </main>

      {/* ── Cmd+K ── */}
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={CMD_ITEMS}
        placeholder="Search highlights, folders, actions..."
      />

      {/* Dialogs */}
      <React.Suspense fallback={null}>
        <NewTagDialog open={tagDialogOpen} onOpenChange={setTagDialogOpen} />
      </React.Suspense>
      <React.Suspense fallback={null}>
        <NewHighlightDialog open={newHighlightOpen} onOpenChange={setNewHighlightOpen} />
      </React.Suspense>
      <React.Suspense fallback={null}>
        <FolderCreateDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen} />
      </React.Suspense>
    </div>
  );
}
