"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

// ─── Component ────────────────────────────────────────────────────────────────
export function BulkActionBar() {
  const selectedIds         = useDashboardStore((s) => s.selectedHighlightIds);
  const clearSelection      = useDashboardStore((s) => s.clearHighlightSelection);
  const deleteHighlight     = useDashboardStore((s) => s.deleteHighlight);
  const restoreHighlight    = useDashboardStore((s) => s.restoreHighlight);
  const moveHighlight       = useDashboardStore((s) => s.moveHighlight);
  const toggleFavorite      = useDashboardStore((s) => s.toggleFavorite);
  const toggleArchive       = useDashboardStore((s) => s.toggleArchive);
  const togglePinHighlight  = useDashboardStore((s) => s.togglePinHighlight);
  const updateHighlight     = useDashboardStore((s) => s.updateHighlight);
  const folders             = useDashboardStore((s) => s.folders);
  const highlights          = useDashboardStore((s) => s.highlights);
  const tags                = useDashboardStore((s) => s.tags);
  const count               = selectedIds.length;

  // Determine if all selected highlights are editable
  const allEditable = React.useMemo(() => {
    const selectedHighlights = highlights.filter((h) => selectedIds.includes(h.id));
    return selectedHighlights.every((h) => {
      const folder = folders.find((f) => f.id === String(h.folderId));
      const role = folder?.effectiveRole || "OWNER";
      return role === "OWNER" || role === "EDITOR";
    });
  }, [selectedIds, highlights, folders]);

  // Deduplicate by string id — safety net against any sync path inserting duplicates
  const uniqueFolders = React.useMemo(() => {
    const seen = new Set<string>();
    return folders.filter((f) => { const sid = String(f.id); if (seen.has(sid)) return false; seen.add(sid); return true; });
  }, [folders]);

  const handleBulkDelete = React.useCallback(() => {
    const ids = [...selectedIds];
    ids.forEach((id) => deleteHighlight(id));
    clearSelection();
    toast.success(`${ids.length} highlight${ids.length > 1 ? "s" : ""} deleted`, {
      description: "Items have been moved to your trash.",
      action: {
        label: "Undo",
        onClick: () => ids.forEach((id) => restoreHighlight(id)),
      },
      duration: 5000,
    });
  }, [selectedIds, deleteHighlight, restoreHighlight, clearSelection]);

  const handleBulkMove = React.useCallback((folderId: string, folderName: string) => {
    const ids = [...selectedIds];
    ids.forEach((id) => moveHighlight(id, folderId, folderName));
    clearSelection();
    toast.success(`Moved ${ids.length} highlights`, {
      description: `Successfully relocated to the "${folderName}" folder.`,
    });
  }, [selectedIds, moveHighlight, clearSelection]);

  const handleBulkFavorite = React.useCallback(() => {
    const ids = [...selectedIds];
    ids.forEach((id) => toggleFavorite(id));
    toast.success("Favorites updated", {
      description: `Toggled favorite status for ${ids.length} highlights.`,
    });
  }, [selectedIds, toggleFavorite]);

  const handleBulkArchive = React.useCallback(() => {
    const ids = [...selectedIds];
    ids.forEach((id) => toggleArchive(id));
    clearSelection();
    toast.success("Highlights archived", {
      description: `Moved ${ids.length} highlights to your archive.`,
    });
  }, [selectedIds, toggleArchive, clearSelection]);

  const handleBulkPin = React.useCallback(() => {
    const ids = [...selectedIds];
    ids.forEach((id) => togglePinHighlight(id));
    toast.success("Pinned highlights updated", {
      description: `Toggled pin status for ${ids.length} highlights.`,
    });
  }, [selectedIds, togglePinHighlight]);

  const handleBulkTag = React.useCallback((tagId: string) => {
    // If ALL selected highlights have this tag → remove it. Otherwise → add it.
    const selectedHighlights = highlights.filter((h) => selectedIds.includes(h.id));
    const allHaveTag = selectedHighlights.every((h) => h.tags?.some(t => t.id === tagId));
    selectedHighlights.forEach((h) => {
      const currentTags = h.tags ?? [];
      const newTags = allHaveTag
        ? currentTags.filter((t) => t.id !== tagId)
        : currentTags.some(t => t.id === tagId) ? currentTags : [...currentTags, tags.find(t => t.id === tagId)!].filter(Boolean);
      updateHighlight(h.id, { tags: newTags.map(t => t.id) } as any);
    });
    const tag = tags.find((t) => t.id === tagId);
    if (allHaveTag) {
      toast.success("Tag removed", {
        description: `"${tag?.name}" was removed from ${selectedHighlights.length} highlights.`,
      });
    } else {
      toast.success("Tag added", {
        description: `"${tag?.name}" was added to ${selectedHighlights.length} highlights.`,
      });
    }
  }, [selectedIds, highlights, tags, updateHighlight]);

  const handleExport = React.useCallback(() => {
    const selected = highlights.filter((h) => selectedIds.includes(h.id));
    const json = JSON.stringify(selected, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cortex-highlights-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    clearSelection();
    toast.success(`Export complete`, {
      description: `Successfully exported ${selected.length} highlight${selected.length > 1 ? "s" : ""}.`,
    });
  }, [selectedIds, highlights, clearSelection]);

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="bulk-bar"
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 500, damping: 32, mass: 0.6 }}
          className={cn(
            "fixed bottom-8 left-1/2 -translate-x-1/2 z-50",
            "bg-[#1a1a1a]/90 backdrop-blur-xl",
            "border border-white/10 rounded-full shadow-2xl",
            "px-4 py-2 flex items-center gap-4",
          )}
        >
          {/* Selection count */}
          <span className="text-[13px] font-medium text-white/80 whitespace-nowrap">
            {count} selected
          </span>

          <div className="w-px h-4 bg-white/10 shrink-0" />

          {!allEditable && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 text-red-400 text-[11px] font-medium border border-red-500/20 shrink-0">
              <LockIcon className="w-3 h-3" />
              Some items are read-only
            </div>
          )}

          {/* Move to Folder (dropdown) */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                disabled={!allEditable}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[12px] font-medium",
                  "px-2.5 py-1 rounded-full transition-all duration-150",
                  "text-white/65 hover:text-white/90 hover:bg-white/[0.07]",
                  !allEditable && "opacity-40 cursor-not-allowed grayscale",
                )}
              >
                <FolderMoveIcon />
                Move
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={8}
                align="center"
                side="top"
                className={cn(
                  "z-50 min-w-[160px] max-h-[240px] overflow-y-auto rounded-xl",
                  "bg-[#1c1c1c] border border-white/[0.09]",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                  "p-1",
                  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                )}
              >
                {uniqueFolders.map((f) => (
                  <DropdownMenu.Item
                    key={f.id}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
                      "text-[12px] text-white/70 hover:text-white",
                      "hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100",
                    )}
                    onSelect={() => handleBulkMove(f.id, f.name)}
                  >
                    <span className="text-sm leading-none shrink-0">{f.emoji}</span>
                    <span className="truncate">{f.name}</span>
                  </DropdownMenu.Item>
                ))}
                {uniqueFolders.length === 0 && (
                  <div className="px-3 py-2 text-[11px] text-white/30">No folders</div>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Pin */}
          <BulkButton onClick={handleBulkPin} disabled={!allEditable}>
            <BulkPinIcon />
            Pin
          </BulkButton>

          {/* Favorite */}
          <BulkButton onClick={handleBulkFavorite} disabled={!allEditable}>
            <BulkStarIcon />
            Favorite
          </BulkButton>

          {/* Archive */}
          <BulkButton onClick={handleBulkArchive} disabled={!allEditable}>
            <BulkArchiveIcon />
            Archive
          </BulkButton>

          {/* Tag */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                disabled={!allEditable}
                aria-label="Tag selected highlights"
                className={cn(
                  "inline-flex items-center gap-1.5 text-[12px] font-medium",
                  "px-2.5 py-1 rounded-full transition-all duration-150",
                  "text-white/65 hover:text-white/90 hover:bg-white/[0.07]",
                  !allEditable && "opacity-40 cursor-not-allowed grayscale",
                )}
              >
                <TagIcon />
                Tag
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={8}
                side="top"
                align="center"
                className={cn(
                  "z-50 w-44 rounded-xl p-1.5",
                  "bg-[#1c1c1c] border border-white/[0.09]",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.55)]",
                  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                )}
              >
                {tags.length === 0 ? (
                  <p className="text-xs text-white/30 px-2 py-1.5">No tags yet</p>
                ) : (
                  tags.map((tag) => {
                    const selectedHighlights = highlights.filter((h) => selectedIds.includes(h.id));
                    const allHave = selectedHighlights.every((h) => h.tags?.some(t => t.id === tag.id));
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleBulkTag(tag.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg",
                          "text-[12px] hover:bg-white/[0.06] transition-colors",
                          allHave ? "text-white/90" : "text-white/55",
                        )}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: tag.color }}
                        />
                        <span className="truncate flex-1 text-left">{tag.name}</span>
                        {allHave && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                            <path d="M2 5l2.5 2.5L8 2.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* Export */}
          <BulkButton onClick={handleExport}>
            <ExportIcon />
            Export
          </BulkButton>

          <div className="w-px h-4 bg-white/10 shrink-0" />

          {/* Delete */}
          <BulkButton variant="danger" onClick={handleBulkDelete} disabled={!allEditable}>
            <TrashIcon />
          </BulkButton>

          {/* Clear selection */}
          <button
            onClick={clearSelection}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              "text-white/40 hover:text-white/80",
              "hover:bg-white/[0.08] transition-all duration-150",
            )}
            aria-label="Clear selection"
          >
            <CloseIcon />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── BulkButton ───────────────────────────────────────────────────────────────
function BulkButton({
  children,
  onClick,
  variant = "default",
  disabled = false,
}: {
  children:  React.ReactNode;
  onClick:   () => void;
  variant?:  "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium",
        "px-2.5 py-1 rounded-full transition-all duration-150",
        variant === "danger"
          ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
          : "text-white/65 hover:text-white/90 hover:bg-white/[0.07]",
        disabled && "opacity-40 cursor-not-allowed grayscale",
      )}
    >
      {children}
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function LockIcon({ className }: { className?: string }) {
  return (
    <svg 
      width="12" 
      height="12" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function FolderMoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h2l1.5 1.5H10A1.5 1.5 0 0111 5v4a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 011 9V3.5z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 1.5h3.88l5.12 5.12a1 1 0 010 1.42L8.04 10.5a1 1 0 01-1.42 0L1.5 5.38V1.5z" />
      <circle cx="4" cy="4" r="0.7" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 3.5h8M5 3.5V2.5h3v1M5.5 6v3.5M7.5 6v3.5M3.5 3.5l.5 7.5h5l.5-7.5" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2v6M3.5 4.5L6 2l2.5 2.5M2 8.5v1a1 1 0 001 1h6a1 1 0 001-1v-1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2l6 6M8 2L2 8" />
    </svg>
  );
}

function BulkPinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6L9.5 2.5Z" />
      <path d="M3 13L6 10" />
    </svg>
  );
}

function BulkStarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 1l1.3 2.6 2.9.4-2.1 2.1.5 2.9L6 7.6 3.4 9l.5-2.9L1.8 4l2.9-.4z" />
    </svg>
  );
}

function BulkArchiveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="1.5" width="10" height="3" rx="0.5" />
      <path d="M2 4.5v5.5a1 1 0 001 1h6a1 1 0 001-1V4.5" />
      <path d="M4.5 7h3" />
    </svg>
  );
}
