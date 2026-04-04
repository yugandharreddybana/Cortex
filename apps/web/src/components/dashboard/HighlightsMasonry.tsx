"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { Badge } from "@cortex/ui";
import { useHotkeys } from "@/hooks/useHotkeys";
import { BulkActionBar } from "./BulkActionBar";
import { EmptyState } from "./EmptyState";
import { ShareDialog, ShareIcon } from "./ShareDialog";
import { HighlightAIPanel } from "./HighlightAIPanel";
import { useDashboardStore } from "@/store/dashboard";
import { LoadingSkeleton } from "./LoadingSkeleton";
import type { Highlight, Folder, Tag } from "@/store/dashboard";
import { DevilsAdvocate } from "./DevilsAdvocate";
import { RequestAccessModal } from "./RequestAccessModal";
import { Lock, ShieldAlert } from "lucide-react";
import { formatSourceUrl } from "@/lib/url";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVideoTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
  } catch { /* invalid url */ }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function HighlightsMasonry({ filterFn }: { filterFn?: (h: Highlight) => boolean } = {}) {
  const router                = useRouter();
  const allHighlights         = useDashboardStore((s) => s.highlights);
  const tags                  = useDashboardStore((s) => s.tags);
  const viewMode              = useDashboardStore((s) => s.viewMode);
  const selectedHighlightIds  = useDashboardStore((s) => s.selectedHighlightIds);
  const toggleHighlightSelect = useDashboardStore((s) => s.toggleHighlightSelect);
  const deleteHighlight       = useDashboardStore((s) => s.deleteHighlight);
  const restoreHighlight      = useDashboardStore((s) => s.restoreHighlight);
  const toggleFavorite        = useDashboardStore((s) => s.toggleFavorite);
  const toggleArchive         = useDashboardStore((s) => s.toggleArchive);
  const togglePinHighlight    = useDashboardStore((s) => s.togglePinHighlight);
  const moveHighlight         = useDashboardStore((s) => s.moveHighlight);
  const folders               = useDashboardStore((s) => s.folders);
  const isLoading             = useDashboardStore((s) => s.isLoading);
  const focusedIdx            = useDashboardStore((s) => s.focusedHighlightIdx);
  const searchQuery           = useDashboardStore((s) => s.searchQuery);
  const sortOrder             = useDashboardStore((s) => s.sortOrder);
  const activeTagFilters      = useDashboardStore((s) => s.activeTagFilters);
  const updateHighlight       = useDashboardStore((s) => s.updateHighlight);
  const activeFolder          = useDashboardStore((s) => s.activeFolder);
  const setNewHighlightOpen   = useDashboardStore((s) => s.setNewHighlightDialogOpen);
  const searchHighlights      = useDashboardStore((s) => s.searchHighlights);
  const isSearching           = useDashboardStore((s) => s.isSearching);

  // Server-side search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchHighlights(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchHighlights]);

  // Apply filters (excluding search which is now server-side)
  const highlights = React.useMemo(() => {
    let list = allHighlights;

    // External filter (favorites/archive pages)
    if (filterFn) list = list.filter(filterFn);

    // Hide archived in main view (when no filterFn)
    if (!filterFn) list = list.filter((h) => !h.isArchived);

    // Tags (intersection — highlight must have ALL selected tags)
    if (activeTagFilters.length > 0) {
      list = list.filter((h) =>
        activeTagFilters.every((t) => h.tags?.some((ht) => String(ht.id) === String(t))) ?? false,
      );
    }

    // Sort: pinned first, then by sortOrder
    list = [...list].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (sortOrder === "recent" || sortOrder === "oldest") {
        const ta = new Date(a.savedAt).getTime() || 0;
        const tb = new Date(b.savedAt).getTime() || 0;
        return sortOrder === "recent" ? tb - ta : ta - tb;
      }
      if (sortOrder === "site") {
        const da = (() => { try { return new URL(a.url).hostname; } catch { return ""; } })();
        const db = (() => { try { return new URL(b.url).hostname; } catch { return ""; } })();
        return da.localeCompare(db);
      }
      return 0;
    });

    return list;
  }, [allHighlights, filterFn, activeTagFilters, sortOrder]);

  const [activeHighlight, setActiveHighlight] = React.useState<Highlight | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<Highlight | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(20);

  const hasMore = highlights.length > visibleCount;
  const displayedHighlights = highlights.slice(0, visibleCount);

  const handleLoadMore = React.useCallback(() => {
    setVisibleCount((prev) => prev + 50);
  }, []);

  const handleDelete = React.useCallback((id: string) => {
    deleteHighlight(id);
    toast.success("Moved to trash", {
      description: "The highlight has been relocated to the trash for 30 days.",
      action: { label: "Undo", onClick: () => restoreHighlight(id) },
      duration: 5000,
    });
  }, [deleteHighlight, restoreHighlight]);

  useHotkeys(handleDelete);

  if (isLoading || isSearching) return <LoadingSkeleton />;

  return (
    <>
      {highlights.length === 0 ? (() => {
        // If we're searching, show a "No results" state
        if (searchQuery.trim()) {
          return (
            <EmptyState 
              title="No matches found"
              body={`We couldn't find any highlights for "${searchQuery}". Try a different keyword or check your filters.`}
              icon={<SearchXIcon />}
            />
          );
        }

        // If we're filtering by tags, show a "No tags match" state
        if (activeTagFilters.length > 0) {
          return (
            <EmptyState 
              title="No highlights with these tags"
              body="There are no highlights that have all the selected tags. Try removing some filters."
              icon={<FilterXIcon />}
            />
          );
        }

        // Specific folder empty state (already existed, but now consistent)
        if (activeFolder) {
          const folderObj = folders.find(f => f.id === activeFolder);
          const folderRole = folderObj?.effectiveRole || "OWNER";
          const canEditInFolder = folderRole === "OWNER" || folderRole === "EDITOR";

          return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <span className="text-4xl">📂</span>
              <p className="text-sm font-medium text-white/50">This folder is empty</p>
              <p className="text-xs text-white/30 text-center max-w-xs">
                {canEditInFolder 
                  ? "Organize your knowledge by moving highlights here or creating new ones directly."
                  : "There are no highlights shared in this folder yet."}
              </p>
              {canEditInFolder && (
                <button
                  onClick={() => setNewHighlightOpen(true)}
                  className="mt-2 px-4 py-2 rounded-xl text-sm font-medium bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
                >
                  Add Highlight
                </button>
              )}
            </div>
          );
        }

        // Default empty state (No highlights at all)
        return <EmptyState />;
      })() : (
        <>
          <AnimatePresence mode="wait" initial={false}>
        {viewMode === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="columns-1 md:columns-2 xl:columns-3 gap-4"
          >
            {displayedHighlights.map((h, i) => (
              <HighlightCard
                key={h.id}
                highlight={h}
                index={i}
                // ... props same ...
                isSelected={selectedHighlightIds.includes(h.id)}
                isFocused={i === focusedIdx}
                folders={folders}
                tags={tags}
                onSelect={() => toggleHighlightSelect(h.id)}
                onOpen={() => router.push(`/dashboard/read/${h.id}`)}
                onDelete={handleDelete}
                onToggleFavorite={() => toggleFavorite(h.id)}
                onToggleArchive={() => toggleArchive(h.id)}
                onTogglePin={() => togglePinHighlight(h.id)}
                onRename={() => setRenameTarget(h)}
                onMove={(folderId, folderName) => {
                  if (!folderId || folders.some((f) => f.id === folderId)) {
                    moveHighlight(h.id, folderId, folderName);
                    toast.success("Highlight moved", { description: `Relocated to the "${folderName}" folder successfully.` });
                  } else {
                    toast.error("Move failed", { description: "The target folder could not be found." });
                  }
                }}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col divide-y divide-white/[0.05]"
          >
            {displayedHighlights.map((h, i) => (
              <HighlightListRow
                key={h.id}
                highlight={h}
                index={i}
                // ... props same ...
                isSelected={selectedHighlightIds.includes(h.id)}
                isFocused={i === focusedIdx}
                folders={folders}
                tags={tags}
                onSelect={() => toggleHighlightSelect(h.id)}
                onOpen={() => router.push(`/dashboard/read/${h.id}`)}
                onDelete={handleDelete}
                onToggleFavorite={() => toggleFavorite(h.id)}
                onToggleArchive={() => toggleArchive(h.id)}
                onTogglePin={() => togglePinHighlight(h.id)}
                onMove={(folderId, folderName) => {
                  moveHighlight(h.id, folderId, folderName);
                  toast.success("Highlight moved", { description: `Relocated to the "${folderName}" folder successfully.` });
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {hasMore && (
        <div className="flex justify-center py-12">
          <button
            onClick={handleLoadMore}
            className={cn(
              "group relative px-8 py-3 rounded-2xl",
              "bg-surface border border-white/[0.06]",
              "text-sm font-medium text-white/50 hover:text-white",
              "transition-all duration-300 ease-snappy",
              "hover:border-white/20 hover:shadow-glass",
              "overflow-hidden transform-gpu active:scale-[0.98]"
            )}
          >
            <div className="relative z-10 flex items-center gap-2">
              <span>Load {Math.min(50, highlights.length - visibleCount)} more</span>
              <svg 
                className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-y-0.5" 
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {/* Shimmer effect */}
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:animate-shimmer" />
          </button>
        </div>
      )}
        </>
      )}

      <RenameHighlightDialog
        highlight={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSave={(id, newName) => {
          updateHighlight(id, { source: newName });
          setRenameTarget(null);
          toast.success("Highlight renamed", {
            description: `The source name has been updated to "${newName}".`,
          });
        }}
      />

      <BulkActionBar />
    </>
  );
}
// ─── Empty state icons ────────────────────────────────────────────────────────
function SearchXIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="m13.5 8.5-5 5" />
      <path d="m8.5 8.5 5 5" />
    </svg>
  );
}

function FilterXIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
      <path d="M4 4h16v2.172a2 2 0 0 1-.586 1.414L15 12V20l-6-3V12L4.586 7.586A2 2 0 0 1 4 6.172V4z" />
      <path d="m14 10-4 4" />
      <path d="m10 10 4 4" />
    </svg>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────────────
function HighlightCard({
  highlight: h,
  index,
  isSelected,
  isFocused,
  folders,
  tags,
  onSelect,
  onOpen,
  onDelete,
  onToggleFavorite,
  onToggleArchive,
  onTogglePin,
  onRename,
  onMove,
}: {
  highlight:        Highlight;
  index:            number;
  isSelected:       boolean;
  isFocused:        boolean;
  folders:          Folder[];
  tags:             Tag[];
  onSelect:         () => void;
  onOpen:           () => void;
  onDelete:         (id: string) => void;
  onToggleFavorite: () => void;
  onToggleArchive:  () => void;
  onTogglePin:      () => void;
  onRename:         () => void;
  onMove:           (folderId: string, folderName: string) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const router = useRouter();
  const updateHighlight = useDashboardStore((s) => s.updateHighlight);
  const [requestAccessOpen, setRequestAccessOpen] = React.useState(false);

  // Find effective role from folder
  const folder = folders.find((f) => f.id === String(h.folderId));
  const effectiveRole = folder?.effectiveRole || "OWNER";
  const isViewer = effectiveRole === "VIEWER";
  const isCommenter = effectiveRole === "COMMENTER";
  const canEdit = effectiveRole === "OWNER" || effectiveRole === "EDITOR";
  const canRequestHigherAccess = isViewer || isCommenter;

  const hasPendingRequest = useDashboardStore((s) =>
    folder ? s.pendingAccessRequests[folder.id] === true : false
  );

  // Removed redundant useEffect to prevent N+1 API calls. 
  // Access status is lazy-loaded or handled at the page level.

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay:    index * 0.07,
        ease:     [0.16, 1, 0.3, 1],
      }}
      className={cn(
        // Masonry break
        "break-inside-avoid mb-4",
        // Card surface
        "relative group/card overflow-hidden",
        "bg-surface rounded-xl",
        "p-5",
        // Border — dynamic on selection
        "border transition-colors duration-150",
        isSelected ? "border-white/70" : "border-white/[0.06] hover:border-white/[0.14]",
        isFocused && "ring-2 ring-white/50",
        // Pinned glow top border
        h.isPinned && "border-t-2 border-t-accent/50",
        // Interaction
        "cursor-pointer",
        "transition-all duration-250 ease-snappy",
        "hover:shadow-glass",
        "active:scale-[0.99] transform-gpu will-change-transform",
      )}
      onClick={onOpen}
    >
      {/* Checkbox (top-left, hidden until hover or selected) */}
      <div
        className={cn(
          "absolute top-2.5 left-2.5 z-10 transition-opacity duration-150",
          isSelected ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
        )}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <div
          className={cn(
            "w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all duration-150",
            isSelected
              ? "bg-accent border-accent"
              : "bg-black/50 border-white/20 hover:border-white/40",
          )}
        >
          {isSelected && (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <path d="M1.5 4.5l2.5 2.5L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Pin badge (top-right corner, visible when pinned) */}
      {h.isPinned && (
        <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
          <PinBadgeIcon />
        </div>
      )}
      {/* Radial accent on hover */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit]",
          "opacity-0 group-hover/card:opacity-100",
          "transition-opacity duration-300 ease-snappy",
        )}
        style={{
          background:
            "radial-gradient(280px circle at 50% -10%, rgba(108,99,255,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Rim light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      />

      {/* YouTube video thumbnail for VIDEO highlights */}
      {h.resourceType === "VIDEO" && (() => {
        const vid = extractYouTubeId(h.url);
        if (!vid) return null;
        return (
          <div className="relative rounded-lg overflow-hidden mb-3 -mx-1 -mt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${vid}/maxresdefault.jpg`}
              alt="Video thumbnail"
              className="w-full h-32 object-cover"
            />
            {h.videoTimestamp != null && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums">
                {formatVideoTime(h.videoTimestamp)}
              </span>
            )}
          </div>
        );
      })()}

      {/* Topic badge + time + 3-dot menu */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <Badge className={cn("text-[10px] font-medium border-0", h.topicColor)}>
          {h.topic}
        </Badge>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-white/30">{h.savedAt}</span>

          {/* Pin toggle */}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              if (canEdit) onTogglePin(); 
              else setRequestAccessOpen(true);
            }}
            className={cn(
              "w-5 h-5 rounded flex items-center justify-center",
              "transition-all duration-150",
              h.isPinned
                ? "text-accent opacity-100"
                : "text-white/40 hover:text-accent opacity-0 group-hover/card:opacity-100",
              !canEdit && h.isPinned && "cursor-default opacity-60",
              !canEdit && !h.isPinned && "hidden", // Only show pinned state to viewers
            )}
            aria-label={h.isPinned ? "Unpin" : "Pin"}
            title={!canEdit ? "Only editors can pin highlights" : h.isPinned ? "Unpin" : "Pin"}
          >
            <PinIcon filled={!!h.isPinned} />
          </button>

          {/* Star / favorite toggle */}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              if (canEdit) onToggleFavorite(); 
              else setRequestAccessOpen(true);
            }}
            className={cn(
              "w-5 h-5 rounded flex items-center justify-center",
              "transition-all duration-150",
              h.isFavorite
                ? "text-yellow-400 opacity-100"
                : "text-white/40 hover:text-yellow-400 opacity-0 group-hover/card:opacity-100",
              !canEdit && h.isFavorite && "cursor-default opacity-60",
              !canEdit && !h.isFavorite && "hidden", // Only show fav state to viewers
            )}
            aria-label={h.isFavorite ? "Remove from favorites" : "Add to favorites"}
            title={!canEdit ? "Only editors can favorite highlights" : h.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <StarSmallIcon filled={h.isFavorite} />
          </button>

          {/* Archive toggle */}
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleArchive(); }}
              className={cn(
                "w-5 h-5 rounded flex items-center justify-center",
                "transition-all duration-150",
                h.isArchived
                  ? "text-white/60 opacity-100"
                  : "text-white/40 hover:text-white/60 opacity-0 group-hover/card:opacity-100",
              )}
              aria-label={h.isArchived ? "Unarchive" : "Archive"}
            >
              <ArchiveSmallIcon />
            </button>
          )}

          {/* 3-dot menu */}
          <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenu.Trigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "w-5 h-5 rounded flex items-center justify-center",
                  "text-white/40 hover:text-white/80",
                  "bg-transparent hover:bg-white/[0.08]",
                  "transition-all duration-150",
                  "opacity-0 group-hover/card:opacity-100",
                  menuOpen && "opacity-100 bg-white/[0.08]",
                )}
                aria-label="Highlight actions"
              >
                <DotsIcon />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                onClick={(e) => e.stopPropagation()}
                sideOffset={4}
                align="end"
                className={cn(
                  "z-50 min-w-[160px] rounded-xl overflow-hidden",
                  "bg-[#1c1c1c] border border-white/[0.09]",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                  "p-1",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out",
                  "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
                )}
              >
                {canEdit && (
                  <DropdownMenu.Item
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                      "text-[12px] text-white/70 hover:text-white",
                      "hover:bg-white/[0.06] cursor-pointer",
                      "outline-none transition-colors duration-100",
                    )}
                    onSelect={() => onRename()}
                  >
                    <PencilIcon />
                    Rename
                  </DropdownMenu.Item>
                )}
                {canRequestHigherAccess && (
                  <DropdownMenu.Item
                    disabled={hasPendingRequest}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                      "text-[12px] text-accent hover:text-accent/80",
                      hasPendingRequest ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/[0.08] cursor-pointer outline-none transition-colors duration-100",
                    )}
                    onSelect={(e) => {
                      if (hasPendingRequest) {
                        e.preventDefault();
                      } else {
                        setRequestAccessOpen(true);
                      }
                    }}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {hasPendingRequest ? "Request Raised" : "Request Higher Access"}
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                    "text-[12px] text-white/70 hover:text-white",
                    "hover:bg-white/[0.06] cursor-pointer",
                    "outline-none transition-colors duration-100",
                  )}
                  onSelect={() => {
                    navigator.clipboard.writeText(h.text).then(() => {
                      toast("Copied to clipboard");
                    }).catch(() => {
                      try {
                        const el = document.createElement("textarea");
                        el.value = h.text;
                        document.body.appendChild(el);
                        el.select();
                        const ok = document.execCommand("copy");
                        document.body.removeChild(el);
                        if (ok) toast("Copied to clipboard");
                        else toast.error("Failed to copy");
                      } catch {
                        toast.error("Failed to copy");
                      }
                    });
                  }}
                >
                  <CopyIcon />
                  Copy text
                </DropdownMenu.Item>
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger
                    disabled={!canEdit}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                      "text-[12px] text-white/70 hover:text-white",
                      "hover:bg-white/[0.06] cursor-pointer",
                      "outline-none transition-colors duration-100",
                      "data-[state=open]:bg-white/[0.06]",
                    )}
                  >
                    <FolderMoveIcon />
                    Move to…
                    <span className="ml-auto text-white/30 text-[10px]">▸</span>
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      sideOffset={4}
                      className={cn(
                        "z-50 min-w-[160px] max-h-[280px] overflow-y-auto rounded-xl",
                        "bg-[#1c1c1c] border border-white/[0.09]",
                        "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                        "p-1",
                        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                      )}
                    >
                      <FolderTreeMenu folders={folders} onSelect={onMove} />
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
                <DropdownMenu.Item
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                    "text-[12px] text-white/70 hover:text-white",
                    "hover:bg-white/[0.06] cursor-pointer",
                    "outline-none transition-colors duration-100",
                  )}
                  onSelect={() => setShareOpen(true)}
                >
                  <ShareIcon />
                  Share
                </DropdownMenu.Item>

                {canEdit && (
                  <DropdownMenu.Item
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                      "text-[12px] text-white/70 hover:text-white",
                      "hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100",
                    )}
                    onSelect={onToggleArchive}
                  >
                    <ArchiveSmallIcon />
                    {h.isArchived ? "Unarchive" : "Archive"}
                  </DropdownMenu.Item>
                )}

                {canEdit && (
                  <>
                    <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />
                    <DropdownMenu.Item
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                        "text-[12px] text-red-400 hover:text-red-300",
                        "hover:bg-red-500/[0.08] cursor-pointer outline-none transition-colors duration-100",
                      )}
                      onSelect={() => onDelete(h.id)}
                    >
                      <TrashIcon />
                      Delete
                    </DropdownMenu.Item>
                  </>
                )}
                {canRequestHigherAccess && (
                  <>
                    <DropdownMenu.Item
                      disabled={hasPendingRequest}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                        "text-[12px] text-accent hover:text-accent/80",
                        hasPendingRequest ? "opacity-50 cursor-not-allowed bg-accent/[0.02]" : "hover:bg-accent/[0.08] cursor-pointer outline-none transition-colors duration-100",
                      )}
                      onSelect={(e) => {
                        if (hasPendingRequest) {
                          e.preventDefault();
                        } else {
                          setRequestAccessOpen(true);
                        }
                      }}
                    >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {hasPendingRequest ? "Request Raised" : "Request Higher Access"}
                  </DropdownMenu.Item>
                    <div className="px-2.5 py-2 text-[10px] text-white/30 italic max-w-[180px] leading-relaxed border-t border-white/[0.06] mt-1">
                      {isViewer
                        ? "Ask the owner for Commenter or Editor access."
                        : "Ask the owner for Editor access to edit or delete."}
                    </div>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Highlight text */}
      {h.isCode ? (
        <pre className="font-mono text-sm whitespace-pre-wrap bg-white/[0.05] p-3 rounded-lg overflow-x-auto text-white/65 border border-white/[0.07] line-clamp-4">
          {h.text}
        </pre>
      ) : h.isTruncated ? (
        <blockquote
          className={cn(
            "text-sm text-white/75 leading-relaxed",
            "border-l-2 border-accent/40 pl-3",
            "line-clamp-4",
            "relative group"
          )}
        >
          &ldquo;{h.text}...&rdquo;
          <span
            className="ml-1 underline cursor-pointer text-accent/80 group-hover:text-accent"
            tabIndex={0}
            title={h.fullText}
            style={{ textDecoration: "underline dotted" }}
          >
            (hover to read more)
          </span>
          <div className="text-amber-400 text-xs mt-2">
            This highlight is very large. Visit the source to read it entirely.
          </div>
        </blockquote>
      ) : (
        <blockquote
          className={cn(
            "text-sm text-white/75 leading-relaxed",
            "border-l-2 border-accent/40 pl-3",
            "line-clamp-4",
          )}
        >
          &ldquo;{h.text}&rdquo;
        </blockquote>
      )}

      <HighlightAIPanel
        highlight={h}
        onResultSaved={(patch) => updateHighlight(h.id, patch)}
      />

      {/* Tags */}
      {h.tags && h.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {h.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: tag.color.startsWith("#") ? `${tag.color}15` : `color-mix(in srgb, ${tag.color} 15%, transparent)`,
                  color: tag.color,
                  border: `1px solid ${tag.color.startsWith("#") ? `${tag.color}30` : `color-mix(in srgb, ${tag.color} 30%, transparent)`}`,
                }}
              >
                {tag.name}
              </span>
            ))}
        </div>
      )}

      {/* Source + folder metadata */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {h.resourceType === "VIDEO" ? (
          <a
            href={formatSourceUrl(h.url, h.text)}
            onClick={(e) => e.stopPropagation()}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5",
              "text-[11px] text-red-400/80",
              "hover:text-red-400 transition-colors duration-200",
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.67 31.67 0 0 0 0 12a31.67 31.67 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.67 31.67 0 0 0 24 12a31.67 31.67 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
            </svg>
            <span className="truncate max-w-[160px]">
              YouTube{h.videoTimestamp != null ? ` · ${formatVideoTime(h.videoTimestamp)}` : ""}
            </span>
          </a>
        ) : (
        <a
          href={formatSourceUrl(h.url, h.text)}
          onClick={(e) => e.stopPropagation()}
          target="_blank"
          rel="noopener noreferrer"
          title={h.url}
          className={cn(
            "inline-flex items-center gap-1.5",
            "text-[11px] text-white/35",
            "hover:text-accent transition-all duration-200",
            "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-md px-2 py-0.5"
          )}
        >
          <LinkIcon className="w-3 h-3" />
          <span className="truncate max-w-[140px]">{h.source || "Source"}</span>
        </a>
        )}

        {h.folder && (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              "text-[10px] text-white/50",
              "bg-white/[0.05] border border-white/[0.10] rounded px-2 py-0.5",
            )}
          >
            <FolderTinyIcon />
            {h.folder}
          </span>
        )}

        <span className="ml-auto text-[10px] text-white/30 shrink-0">{h.savedAt}</span>
      </div>

      {/* Optional note */}
      {h.note && (
        <p
          className={cn(
            "mt-3 text-[11px] text-white/40 italic",
            "border-t border-white/[0.06] pt-3",
          )}
        >
          {h.note}
        </p>
      )}

      {/* Fade gradient cue */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 h-10",
          "bg-gradient-to-t from-surface to-transparent",
          "rounded-b-xl pointer-events-none",
        )}
      />
    </motion.div>

    <ShareDialog open={shareOpen} onOpenChange={setShareOpen} type="h" id={h.id} title={h.text.slice(0, 60)} />
    <RequestAccessModal 
      open={requestAccessOpen} 
      onOpenChange={(open) => {
        setRequestAccessOpen(open);
      }}
      folderId={folder?.id || ""}
      folderName={folder?.name || ""}
      currentRole={effectiveRole !== "OWNER" ? effectiveRole : undefined}
    />
    </>
  );
}

// ─── Micro-icons ──────────────────────────────────────────────────────────────
function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6L9.5 2.5Z" />
      <path d="M3 13L6 10" />
    </svg>
  );
}

function PinBadgeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-accent drop-shadow-sm" aria-hidden="true">
      <path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6L9.5 2.5Z" />
      <path d="M3 13L6 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function StarSmallIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 1l1.3 2.6 2.9.4-2.1 2.1.5 2.9L6 7.6 3.4 9l.5-2.9L1.8 4l2.9-.4z" />
    </svg>
  );
}

function ArchiveSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 3.5h9M2.5 3.5v6a1 1 0 001 1h5a1 1 0 001-1v-6M4 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5 6h2" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6M6 1h3m0 0v3m0-3L5 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="6" r="1" />
      <circle cx="6"   cy="6" r="1" />
      <circle cx="9.5" cy="6" r="1" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 1.5l2 2L4 10H2v-2l6.5-6.5z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <path d="M2 8H1.5A1.5 1.5 0 010 6.5v-5A1.5 1.5 0 011.5 0h5A1.5 1.5 0 018 1.5V2" />
    </svg>
  );
}

// ─── Folder Tree Sub-Menu (recursive for nested folders) ──────────────────────
function FolderTreeMenu({
  folders,
  onSelect,
  parentId,
  depth = 0,
}: {
  folders:   Folder[];
  onSelect:  (folderId: string, folderName: string) => void;
  parentId?: string;
  depth?:    number;
}) {
  const seen = new Set<string>();
  const items = folders.filter((f) => {
    if (parentId ? f.parentId !== parentId : !!f.parentId) return false;
    const sid = String(f.id);
    if (seen.has(sid)) return false;
    seen.add(sid);
    return true;
  });

  if (items.length === 0) {
    if (depth === 0) {
      return (
        <div className="px-3 py-2 text-[11px] text-white/30">No folders</div>
      );
    }
    return null;
  }

  return (
    <>
      {items.map((folder) => {
        const children = folders.filter((f) => f.parentId === folder.id);
        const hasChildren = children.length > 0;

        if (hasChildren) {
          return (
            <DropdownMenu.Sub key={folder.id}>
              <DropdownMenu.SubTrigger
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-full",
                  "text-[12px] text-white/70 hover:text-white",
                  "hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100",
                  "data-[state=open]:bg-white/[0.06]",
                )}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(folder.id, folder.name);
                }}
              >
                <span className="text-sm leading-none shrink-0">{folder.emoji}</span>
                <span className="flex-1 truncate">{folder.name}</span>
                <span className="text-white/30 text-[10px]">▸</span>
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={4}
                  className={cn(
                    "z-50 min-w-[140px] max-h-[240px] overflow-y-auto rounded-xl",
                    "bg-[#1c1c1c] border border-white/[0.09]",
                    "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                    "p-1",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                  )}
                >
                  {/* Option to move to this parent folder itself */}
                  <DropdownMenu.Item
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
                      "text-[12px] text-accent hover:text-white",
                      "hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100",
                    )}
                    onSelect={() => onSelect(folder.id, folder.name)}
                  >
                    <span className="text-sm leading-none shrink-0">{folder.emoji}</span>
                    {folder.name}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />
                  <FolderTreeMenu folders={folders} onSelect={onSelect} parentId={folder.id} depth={depth + 1} />
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          );
        }

        return (
          <DropdownMenu.Item
            key={folder.id}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
              "text-[12px] text-white/70 hover:text-white",
              "hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100",
            )}
            onSelect={() => onSelect(folder.id, folder.name)}
          >
            <span className="text-sm leading-none shrink-0">{folder.emoji}</span>
            <span className="truncate">{folder.name}</span>
          </DropdownMenu.Item>
        );
      })}
    </>
  );
}

function FolderMoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h2l1.5 1.5H10A1.5 1.5 0 0111 5v4a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 011 9V3.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h8M4 3V2h4v1M5 5.5v3M7 5.5v3M3 3l.5 7h5L9 3" />
    </svg>
  );
}

function FolderTinyIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 2.5A1 1 0 012 1.5h1.5l1 1H7A1 1 0 018 3.5v3A1 1 0 017 7.5H2A1 1 0 011 6.5v-4z" />
    </svg>
  );
}

function ReadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 2h8v8H2zM4 5h4M4 7h3" />
    </svg>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────────
function HighlightListRow({
  highlight: h,
  index,
  isSelected,
  isFocused,
  folders,
  tags,
  onSelect,
  onOpen,
  onDelete,
  onToggleFavorite,
  onToggleArchive,
  onTogglePin,
  onMove,
}: {
  highlight:        Highlight;
  index:            number;
  isSelected:       boolean;
  isFocused:        boolean;
  folders:          Folder[];
  tags:             Tag[];
  onSelect:         () => void;
  onOpen:           () => void;
  onDelete:         (id: string) => void;
  onToggleFavorite: () => void;
  onToggleArchive:  () => void;
  onTogglePin:      () => void;
  onMove:           (folderId: string, folderName: string) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = React.useState(false);

  // Find effective role from folder
  const folder = folders.find((f) => f.id === String(h.folderId));
  const effectiveRole = folder?.effectiveRole || "OWNER";
  const isViewer = effectiveRole === "VIEWER";
  const isCommenter = effectiveRole === "COMMENTER";
  const canEdit = effectiveRole === "OWNER" || effectiveRole === "EDITOR";
  const canRequestHigherAccess = isViewer || isCommenter;

  const hasPendingRequest = useDashboardStore((s) =>
    folder ? s.pendingAccessRequests[folder.id] === true : false
  );

  // Removed redundant useEffect to prevent N+1 API calls.

  return (
    <>
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group/row flex items-center gap-3 py-2.5 px-2 rounded-lg",
        "cursor-pointer transition-all duration-150",
        isSelected
          ? "bg-white/[0.05] border border-white/20"
          : "border border-transparent hover:bg-white/[0.03]",
        isFocused && "ring-2 ring-white/50",
      )}
      onClick={onOpen}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "shrink-0 transition-opacity duration-150",
          isSelected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100",
        )}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <div
          className={cn(
            "w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all duration-150",
            isSelected
              ? "bg-accent border-accent"
              : "bg-transparent border-white/20 hover:border-white/40",
          )}
        >
          {isSelected && (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <path d="M1.5 4.5l2.5 2.5L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Topic badge */}
      <Badge className={cn("text-[10px] font-medium border-0 shrink-0", h.topicColor)}>
        {h.topic}
      </Badge>

      {/* Tags */}
      {h.tags && h.tags.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          {h.tags.map(tag => (
              <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: tag.color.startsWith("#") ? `${tag.color}15` : `color-mix(in srgb, ${tag.color} 15%, transparent)`,
                    color: tag.color,
                    border: `1px solid ${tag.color.startsWith("#") ? `${tag.color}30` : `color-mix(in srgb, ${tag.color} 30%, transparent)`}`,
                  }}
                >
                {tag.name}
              </span>
            ))}
        </div>
      )}

      {/* Text (single line, truncated) */}
      <p className="flex-1 min-w-0 text-sm text-white/70 truncate">
        {h.text}
      </p>

      {/* Right side: folder + date + menu */}
      <div className="shrink-0 flex items-center gap-3 ml-auto">
        {h.folder && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-white/40">
            <FolderTinyIcon />
            {h.folder}
          </span>
        )}
        <span className="text-[11px] text-white/30 tabular-nums">{h.savedAt}</span>

        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={cn(
            "w-5 h-5 rounded flex items-center justify-center transition-all duration-150",
            h.isPinned
              ? "text-accent opacity-100"
              : "text-white/30 hover:text-accent opacity-0 group-hover/row:opacity-100",
          )}
          aria-label={h.isPinned ? "Unpin" : "Pin"}
        >
          <PinIcon filled={!!h.isPinned} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={cn(
            "w-5 h-5 rounded flex items-center justify-center transition-all duration-150",
            h.isFavorite
              ? "text-yellow-400 opacity-100"
              : "text-white/30 hover:text-yellow-400 opacity-0 group-hover/row:opacity-100",
          )}
          aria-label={h.isFavorite ? "Unstar" : "Star"}
        >
          <StarSmallIcon filled={h.isFavorite} />
        </button>

        <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-5 h-5 rounded flex items-center justify-center",
                "text-white/30 hover:text-white/70",
                "bg-transparent hover:bg-white/[0.08]",
                "transition-all duration-150",
                "opacity-0 group-hover/row:opacity-100",
                menuOpen && "opacity-100",
              )}
              aria-label="Highlight actions"
            >
              <DotsIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              onClick={(e) => e.stopPropagation()}
              sideOffset={4}
              align="end"
              className={cn(
                "z-50 min-w-[160px] rounded-xl overflow-hidden",
                "bg-[#1c1c1c] border border-white/[0.09]",
                "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                "p-1",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
              )}
            >
              {canRequestHigherAccess && (
                <DropdownMenu.Item
                  disabled={hasPendingRequest}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                    "text-[12px] text-accent hover:text-accent/80",
                    hasPendingRequest ? "opacity-50 cursor-not-allowed bg-accent/[0.02]" : "hover:bg-accent/[0.08] cursor-pointer outline-none transition-colors duration-100",
                  )}
                  onSelect={(e) => {
                    if (hasPendingRequest) {
                      e.preventDefault();
                    } else {
                      setRequestAccessOpen(true);
                    }
                  }}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {hasPendingRequest ? "Requested access" : "Request Higher Access"}
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger
                  disabled={!canEdit}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                    "text-[12px] text-white/70 hover:text-white",
                    "hover:bg-white/[0.06] cursor-pointer",
                    "outline-none transition-colors duration-100",
                    "data-[state=open]:bg-white/[0.06]",
                  )}
                >
                  <FolderMoveIcon />
                  Move to…
                  <span className="ml-auto text-white/30 text-[10px]">▸</span>
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    sideOffset={4}
                    className={cn(
                      "z-50 min-w-[160px] max-h-[280px] overflow-y-auto rounded-xl",
                      "bg-[#1c1c1c] border border-white/[0.09]",
                      "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                      "p-1",
                      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                    )}
                  >
                    <FolderTreeMenu folders={folders} onSelect={onMove} />
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
              <DropdownMenu.Item
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                  "text-[12px] text-white/70 hover:text-white",
                  "hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100",
                )}
                onSelect={() => setShareOpen(true)}
              >
                <ShareIcon />
                Share
              </DropdownMenu.Item>
              {canEdit && (
                <DropdownMenu.Item
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                    "text-[12px] text-white/70 hover:text-white",
                    "hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100",
                  )}
                  onSelect={onToggleArchive}
                >
                  <ArchiveSmallIcon />
                  {h.isArchived ? "Unarchive" : "Archive"}
                </DropdownMenu.Item>
              )}
              {canEdit && (
                <>
                  <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />
                  <DropdownMenu.Item
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                      "text-[12px] text-red-400 hover:text-red-300",
                      "hover:bg-red-500/[0.08] cursor-pointer outline-none transition-colors duration-100",
                    )}
                    onSelect={() => onDelete(h.id)}
                  >
                    <TrashIcon />
                    Delete
                  </DropdownMenu.Item>
                </>
              )}
              {canRequestHigherAccess && (
                <div className="px-2.5 py-2 text-[10px] text-white/30 italic max-w-[180px] leading-relaxed border-t border-white/[0.06] mt-1">
                  {isViewer
                    ? "Ask the owner for Commenter or Editor access."
                    : "Ask the owner for Editor access to edit/delete."}
                </div>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

    </motion.div>

    <ShareDialog open={shareOpen} onOpenChange={setShareOpen} type="h" id={h.id} title={h.text.slice(0, 60)} />
    <RequestAccessModal 
      open={requestAccessOpen} 
      onOpenChange={(open) => {
        setRequestAccessOpen(open);
      }}
      folderId={folder?.id || ""}
      folderName={folder?.name || ""}
      currentRole={effectiveRole !== "OWNER" ? effectiveRole : undefined}
    />
    </>
  );
}

// ─── Rename Highlight Dialog ──────────────────────────────────────────────────
function RenameHighlightDialog({
  highlight,
  onClose,
  onSave,
}: {
  highlight: Highlight | null;
  onClose:   () => void;
  onSave:    (id: string, newName: string) => void;
}) {
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    if (highlight) setValue(highlight.source);
  }, [highlight]);

  function handleSave() {
    if (highlight && value.trim()) {
      onSave(highlight.id, value.trim());
    }
  }

  return (
    <Dialog.Root open={!!highlight} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-sm rounded-2xl p-6",
            "bg-[#1a1a1a] border border-white/[0.09]",
            "shadow-[0_24px_64px_rgba(0,0,0,0.6)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          )}
        >
          <Dialog.Title className="text-sm font-semibold text-white/90 mb-1">
            Rename highlight
          </Dialog.Title>
          <Dialog.Description className="text-xs text-white/40 mb-4">
            Edit the source name for this highlight.
          </Dialog.Description>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
            placeholder="Source name…"
            className={cn(
              "w-full rounded-xl px-3 py-2 text-sm",
              "bg-white/[0.06] border border-white/[0.10]",
              "text-white placeholder:text-white/30",
              "outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/40",
              "transition-all duration-150",
            )}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!value.trim()}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-medium transition-colors",
                "bg-accent/90 text-white hover:bg-accent",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
