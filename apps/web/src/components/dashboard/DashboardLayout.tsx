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
  const fetchFolders        = useDashboardStore((s) => s.fetchFolders);
  const fetchTags           = useDashboardStore((s) => s.fetchTags);

  // Initial data fetch with error handling (FIX 43)
  const doFetch = React.useCallback(async () => {
    try {
      await Promise.all([fetchFolders(), fetchTags()]);
      setInitError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setInitError(msg);
      toast.error("Failed to load your data. Please retry.");
    }
  }, [fetchFolders, fetchTags]);

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
      {/* ── Sidebar ── */}
      <Sidebar onCmdK={() => setCmdOpen(true)} />

      {/* ── Main ── */}
      <main
        className={cn(
          "flex-1 overflow-y-auto flex flex-col",
          "bg-[#121212]",
        )}
      >
        {/* Header */}
        <DashboardHeader />

        {/* Sort pills (FIX 2) */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-2">
          {(["recent", "oldest", "site"] as const).map((key) => {
            const labels: Record<typeof key, string> = SORT_LABELS;
            return (
              <button
                key={key}
                onClick={() => setSortOrder(key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium",
                  "transition-all duration-200 ease-snappy",
                  sortOrder === key
                    ? "text-primary bg-white/[0.07] border border-white/[0.12]"
                    : "text-muted border border-white/[0.06] hover:text-secondary hover:bg-white/[0.04] hover:border-white/[0.10]",
                )}
              >
                {labels[key]}
              </button>
            );
          })}
        </div>

        {/* Init error banner (FIX 43) */}
        {initError && (
          <div className="mx-6 mb-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-4">
            <p className="text-sm text-red-400">{initError}</p>
            <button
              onClick={async () => {
                setRetrying(true);
                await doFetch();
                setRetrying(false);
              }}
              disabled={retrying}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {retrying ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}

        {/* ViewControlBar */}
        <ViewControlBar />

        {/* Content */}
        <div className="flex-1 p-6 lg:p-8">
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
