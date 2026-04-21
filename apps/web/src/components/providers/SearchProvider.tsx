"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CommandPalette, type MentionSource } from "@cortex/ui";
import { useSearchStore } from "@/store/useSearchStore";
import { useDashboardStore } from "@/store/dashboard";
import { FolderCreateDialog } from "@/components/dashboard/FolderCreateDialog";
import { NewHighlightDialog } from "@/components/dashboard/NewHighlightDialog";

/**
 * SearchProvider — renders a SINGLE CommandPalette and attaches
 * the global Cmd+K / Ctrl+K keyboard shortcut. Mount once at root layout.
 *
 * CMD_ITEMS are built inside the component so `router.push` is available.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const router    = useRouter();
  const isOpen    = useSearchStore((s) => s.isOpen);
  const setIsOpen = useSearchStore((s) => s.setIsOpen);
  const toggle    = useSearchStore((s) => s.toggle);

  const setViewMode          = useDashboardStore((s) => s.setViewMode);
  const setNewFolderOpen     = useDashboardStore((s) => s.setNewFolderDialogOpen);
  const newFolderOpen        = useDashboardStore((s) => s.newFolderDialogOpen);
  const setNewHighlightOpen  = useDashboardStore((s) => s.setNewHighlightDialogOpen);
  const newHighlightOpen     = useDashboardStore((s) => s.newHighlightDialogOpen);
  const folders              = useDashboardStore((s) => s.folders);
  const highlights           = useDashboardStore((s) => s.highlights);

  // Build mentionable sources: all folders + 20 most recent highlights
  const mentionSources = React.useMemo<MentionSource[]>(() => {
    const folderSources: MentionSource[] = folders.map((f) => ({
      id:    f.id,
      label: `${f.emoji} ${f.name}`,
      type:  "folder" as const,
      text:  highlights
        .filter((h) => h.folderId === f.id)
        .map((h) => h.text)
        .join(" "),
    }));
    const highlightSources: MentionSource[] = highlights.slice(0, 20).map((h) => ({
      id:    h.id,
      label: h.text.slice(0, 60) + (h.text.length > 60 ? "…" : ""),
      type:  "highlight" as const,
      text:  h.text,
    }));
    return [...folderSources, ...highlightSources];
  }, [folders, highlights]);

  const CMD_ITEMS = React.useMemo(() => [
    // ── Folders (dynamic) ────────────────────────────────────────────
    ...folders.map((f) => ({
      id:    `folder-${f.id}`,
      label: `${f.emoji} ${f.name}`.trim(),
      group: "Folders",
      onSelect: () => { router.push(`/dashboard/folders/${f.id}`); setIsOpen(false); },
    })),
    // ── Actions ──────────────────────────────────────────────────────
    {
      id: "action-new-folder",
      label: "Create New Folder",
      group: "Actions",
      shortcut: ["⌘", "⇧", "N"],
      onSelect: () => { setNewFolderOpen(true); setIsOpen(false); },
    },
    {
      id: "action-new-highlight",
      label: "Create New Highlight",
      description: "Manually add a highlight",
      group: "Actions",
      shortcut: ["C"],
      onSelect: () => { setNewHighlightOpen(true); setIsOpen(false); },
    },
    {
      id: "action-list-view",
      label: "Switch to List View",
      group: "Actions",
      onSelect: () => { setViewMode("list"); setIsOpen(false); },
    },
    {
      id: "action-grid-view",
      label: "Switch to Grid View",
      group: "Actions",
      onSelect: () => { setViewMode("grid"); setIsOpen(false); },
    },
    // ── Navigation ───────────────────────────────────────────────────
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      description: "View all your saved highlights",
      group: "Navigate",
      shortcut: ["G", "D"],
      onSelect: () => { router.push("/dashboard"); setIsOpen(false); },
    },
    {
      id: "nav-favorites",
      label: "Go to Favorites",
      description: "View starred highlights",
      group: "Navigate",
      shortcut: ["G", "V"],
      onSelect: () => { router.push("/dashboard/favorites"); setIsOpen(false); },
    },
    {
      id: "nav-archive",
      label: "Go to Archive",
      group: "Navigate",
      onSelect: () => { router.push("/dashboard/archive"); setIsOpen(false); },
    },
    {
      id: "nav-settings",
      label: "Settings",
      description: "Profile, billing, preferences",
      group: "Navigate",
      shortcut: ["⌘", ","],
      onSelect: () => { router.push("/dashboard/settings/profile"); setIsOpen(false); },
    },
    {
      id: "nav-billing",
      label: "Billing & Subscription",
      group: "Navigate",
      onSelect: () => { router.push("/dashboard/settings/billing"); setIsOpen(false); },
    },
    {
      id: "nav-pricing",
      label: "View Pricing",
      group: "Navigate",
      onSelect: () => { router.push("/pricing"); setIsOpen(false); },
    },
    {
      id: "ext-download",
      label: "Download Extension",
      description: "Install the Cortex Chrome extension",
      group: "Actions",
      shortcut: ["⌘", "E"],
      onSelect: () => {
        const a = document.createElement("a");
        a.href     = "/cortex-extension.zip";
        a.download = "cortex-extension.zip";
        a.click();
      },
    },
    {
      id: "export-md",
      label: "Export to Markdown",
      description: "Download all highlights as .md",
      group: "Export",
      onSelect: () => {
        const lines = highlights.map((h) => {
          const meta = [h.source, h.topic].filter(Boolean).join(" · ");
          return `## ${meta || "Highlight"}\n\n> ${h.text}\n`;
        });
        const blob = new Blob(["# Cortex Highlights\n\n", lines.join("\n")], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cortex-highlights.md";
        a.click();
        URL.revokeObjectURL(url);
        setIsOpen(false);
      },
    },
  ], [router, folders, highlights, setIsOpen, setNewFolderOpen, setNewHighlightOpen, setViewMode]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggle]);

  return (
    <>
      {children}
      <CommandPalette
        open={isOpen}
        onOpenChange={setIsOpen}
        items={CMD_ITEMS}
        mentionSources={mentionSources}
        placeholder="Search highlights, navigate, run commands…"
      />
      <FolderCreateDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
      />
      <NewHighlightDialog
        open={newHighlightOpen}
        onOpenChange={setNewHighlightOpen}
      />
    </>
  );
}

