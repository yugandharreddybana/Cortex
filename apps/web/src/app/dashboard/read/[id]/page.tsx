"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useScroll, useSpring } from "framer-motion";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { useAuthStore } from "@/store/authStore";
import { FolderCreateDialog } from "@/components/dashboard/FolderCreateDialog";
import { NewTagDialog } from "@/components/dashboard/NewTagDialog";
import { Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { formatSourceUrl } from "@/lib/url";
import { useResourceSync } from "@/hooks/useResourceSync";

export interface CommentType {
  id: number;
  highlightId: number;
  authorId: number;
  authorEmail: string;
  authorFullName: string | null;
  text: string;
  createdAt: string;
  reactions: ReactionType[];
}
 
export interface ReactionType {
  userId: number;
  userName: string;
  emoji: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getYouTubeVideoId(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
  } catch { /* invalid URL */ }
  return null;
}

function formatVideoTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatRelativeDate(value: string | undefined): string {
  if (!value) return "Unknown date";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: "System", value: "system-ui, -apple-system, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'JetBrains Mono', 'SF Mono', monospace" },
];

const SIZE_OPTIONS = [
  { label: "S", value: "text-sm leading-relaxed" },
  { label: "M", value: "text-base leading-relaxed" },
  { label: "L", value: "text-lg leading-loose" },
  { label: "XL", value: "text-xl leading-loose" },
];

const THEME_OPTIONS = [
  { label: "Dark", bg: "bg-[#0a0a0a]", text: "text-white/80" },
  { label: "Sepia", bg: "bg-[#1a1712]", text: "text-[#d4c5a0]" },
  { label: "Light", bg: "bg-[#fafaf9]", text: "text-[#1a1a1a]" },
];

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20" },
};

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
 
function TagPill({ name, color, onRemove }: { name: string; color: string; onRemove?: () => void }) {
  const isHex = color?.startsWith("#");
  const c = isHex ? null : (TAG_COLORS[color] ?? TAG_COLORS.blue);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
        c ? `${c.bg} ${c.text} border ${c.border}` : "border border-white/[0.06]",
      )}
      style={isHex ? { background: `${color}20`, color, borderColor: `${color}40` } : undefined}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M2 2l6 6M8 2L2 8" />
          </svg>
        </button>
      )}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReadingModePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const highlight = useDashboardStore((s) => s.highlights.find((h) => String(h.id) === id));


  if (!highlight) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-sm text-white/40">Highlight not found</p>
          <button
            onClick={() => router.back()}
            className="mt-3 text-xs text-accent hover:underline"
          >
            ← Back to previous page
          </button>
        </div>
      </div>
    );
  }

  return <ReadingModeContent highlight={highlight} />;
}

function ReadingModeContent({ highlight }: { highlight: any }) {
  const router = useRouter();
  const tags = useDashboardStore((s) => s.tags);
  const folders = useDashboardStore((s) => s.folders);
  const toggleFavorite = useDashboardStore((s) => s.toggleFavorite);
  const updateHighlight = useDashboardStore((s) => s.updateHighlight);
  const moveHighlight = useDashboardStore((s) => s.moveHighlight);
  const deleteHighlight = useDashboardStore((s) => s.deleteHighlight);
  const currentUser = useAuthStore((s) => s.user);

  // Permissions
  const currentFolder = React.useMemo(() => folders.find((f) => f.id === highlight.folderId), [folders, highlight.folderId]);
  const role = currentFolder?.effectiveRole || "OWNER";
  const isViewer = role === "VIEWER";
  const canEdit = role === "OWNER" || role === "EDITOR";

  // Comments State
  const [comments, setComments] = React.useState<CommentType[]>([]);
  const [isFetchingComments, setIsFetchingComments] = React.useState(true);
  const [newComment, setNewComment] = React.useState("");
  const [isAddingComment, setIsAddingComment] = React.useState(false);
  const [editingCommentId, setEditingCommentId] = React.useState<number | null>(null);
  const [editCommentText, setEditCommentText] = React.useState("");

  React.useEffect(() => {
    if (highlight?.id) {
      setIsFetchingComments(true);
      fetch(`/api/v1/highlights/${highlight.id}/comments`, { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          setComments(Array.isArray(data) ? data : []);
          setIsFetchingComments(false);
        })
        .catch((e) => {
          console.error(e);
          setIsFetchingComments(false);
        });
    }
  }, [highlight?.id]);

  // ── Real-time Sync ──────────────────────────────────────────────────────────
  const handleResourceEvent = React.useCallback((event: any) => {
    const { type, data } = event;
    
    switch (type) {
      case "COMMENT_ADDED":
        setComments(prev => {
          // Avoid duplicate if we were the sender
          if (prev.some(c => c.id === data.id)) return prev;
          return [...prev, data];
        });
        break;
      case "COMMENT_UPDATED":
        setComments(prev => prev.map(c => c.id === data.id ? data : c));
        break;
      case "COMMENT_DELETED":
        setComments(prev => prev.filter(c => c.id !== data.id));
        break;
      case "COMMENT_REACTION_UPDATED":
        setComments(prev => prev.map(c => {
          if (c.id === data.commentId) {
            return { ...c, reactions: data.reactions };
          }
          return c;
        }));
        break;
      case "HIGHLIGHT_DELETED":
        toast.error("This highlight has been deleted by its owner.");
        router.push("/dashboard");
        break;
      case "HIGHLIGHT_UPDATED":
        // The global useWebSocket hook usually handles store sync,
        // but if we're on a shared folder, we might need to nudge the store
        // or the local view. The component re-renders when the store changes.
        break;
      case "HIGHLIGHT_RESTORED":
        // Similar to UPDATED, the store will be updated and this component will re-render.
        // We log it for debugging and to ensure the path is covered.
        console.log("Highlight restored via real-time sync", data.id);
        break;
    }
  }, [router]);

  useResourceSync("highlight", highlight?.id, handleResourceEvent);

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await fetch(`/api/v1/highlights/${highlight.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment }),
        credentials: "include",
      });
      if (res.ok) {
        const added = await res.json();
        setComments([...comments, added]);
        setNewComment("");
        setIsAddingComment(false);
      } else {
        toast.error("Failed to add comment.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editCommentText.trim()) return;
    try {
      const res = await fetch(`/api/v1/highlights/${highlight.id}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editCommentText }),
        credentials: "include",
      });
      if (res.ok) {
        const updated = await res.json();
        setComments(comments.map(c => c.id === commentId ? updated : c));
        setEditingCommentId(null);
      } else {
        toast.error("Failed to update comment.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const handleToggleReaction = async (commentId: number, emoji: string) => {
    try {
      const res = await fetch(`/api/v1/highlights/${highlight.id}/comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
        credentials: "include",
      });
      if (res.ok) {
        const updatedReactions = await res.json();
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, reactions: updatedReactions } : c));
      }
    } catch {
      toast.error("Failed to update reaction.");
    }
  };
 
  // Layout State
  const [fontIdx, setFontIdx] = React.useState(0);
  const [sizeIdx, setSizeIdx] = React.useState(1);
  const [themeIdx, setThemeIdx] = React.useState(0);

  // Edit Modal State
  const [editOpen, setEditOpen] = React.useState(false);
  const [isTagOnly, setIsTagOnly] = React.useState(false);
  const [editFolderId, setEditFolderId] = React.useState<string | null>(highlight?.folderId ?? null);
  const [editTags, setEditTags] = React.useState<string[]>(highlight?.tags?.map((t: any) => String(t.id)) ?? []);


  const [tagQuery, setTagQuery] = React.useState("");
  const [tagPopoverOpen, setTagPopoverOpen] = React.useState(false);
  const [folderPopoverOpen, setFolderPopoverOpen] = React.useState(false);

  // Dialog State
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false);
  const [subfolderParentId, setSubfolderParentId] = React.useState<string | undefined>(undefined);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);

  // Sync state when modal opens
  React.useEffect(() => {
    if (editOpen && highlight) {
      setEditFolderId(highlight.folderId ?? null);
      setEditTags(highlight.tags?.map((t: any) => String(t.id)) ?? []);
    }
  }, [editOpen, highlight]);



  const handleSaveEdit = () => {
    if (!highlight) return;
    const folder = folders.find(f => String(f.id) === String(editFolderId));

    const patch: any = {
      tagIds: editTags
    };

    // Only include folderId if it actually changed to avoid redundant backend activity
    if (String(editFolderId) !== String(highlight.folderId ?? "null")) {
      patch.folderId = editFolderId ?? null;
      patch.folder = folder ? folder.name : null;
    }

    updateHighlight(highlight.id, patch);
    setEditOpen(false);
    toast.success("Highlight updated successfully");
  };


  const [isDeleting, setIsDeleting] = React.useState(false);
  const handleDelete = async () => {
    if (role === "VIEWER") {
      toast.error("You do not have permission to delete this highlight.");
      return;
    }

    if (!confirm("Are you sure you want to delete this highlight?")) return;

    setIsDeleting(true);
    try {
      deleteHighlight(highlight.id);
      toast.success("Highlight deleted");
      router.push("/dashboard");
    } catch (err) {
      toast.error("Failed to delete highlight");
      setIsDeleting(false);
    }
  };

  // Build recursive folder hierarchy matching the sidebar exact UI
  const renderFolderList = (allFolders: typeof folders, parentId: string | null = null, depth = 0): React.ReactNode[] => {
    return allFolders
      .filter(f => (f as any).parentId === parentId || (!parentId && !(f as any).parentId))
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap(f => [
        <div key={f.id} className="group flex items-center w-full mb-0.5 relative">
          {/* Depth indentation */}
          <div style={{ width: depth * 16, flexShrink: 0 }} />

          {/* Depth left border indicator */}
          {depth > 0 && (
            <div
              className="absolute top-[-4px] bottom-[-4px] w-px bg-white/[0.06]"
              style={{ left: depth * 16 - 8 }}
            />
          )}

          <button
            onClick={() => {
              setEditFolderId(f.id);
              setFolderPopoverOpen(false);
            }}
            className={cn(
              "flex-1 flex items-center justify-start gap-2.5 px-3 py-1.5 rounded-xl",
              "text-sm transition-all duration-150 ease-spatial min-w-0 text-left",
              editFolderId === f.id
                ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                : "text-white/60 hover:bg-white/[0.05] hover:text-white"
            )}
          >
            <span className="text-base leading-none shrink-0">{f.emoji || "📁"}</span>
            <span className="flex-1 truncate">{f.name}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setSubfolderParentId(f.id);
              setFolderDialogOpen(true);
              setFolderPopoverOpen(false);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 mx-1 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-md transition-all shrink-0"
            title="Create Subfolder"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2v8M2 6h8" strokeLinecap="round" />
            </svg>
          </button>
        </div>,
        ...renderFolderList(allFolders, f.id, depth + 1)
      ]);
  };

  // Layout Scroll Progress - Callback Ref pattern for definitive hydration
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ container: container ? { current: container } : undefined });
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  const theme = THEME_OPTIONS[themeIdx];
  const font = FONT_OPTIONS[fontIdx];
  const size = SIZE_OPTIONS[sizeIdx];

  const filteredTags = tags.filter(
    (t: any) =>
      t.name.toLowerCase().includes(tagQuery.toLowerCase()) &&
      !editTags.some(id => String(id) === String(t.id)),
  );

  return (
    <div className={cn("h-screen flex flex-col", theme.bg)}>
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-0.5 bg-accent z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Top toolbar */}
      <div className={cn(
        "sticky top-0 z-40 shrink-0",
        "h-14 flex items-center justify-between px-6",
        "border-b border-white/[0.06]",
        theme.bg,
      )}>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.06] hover:bg-white/[0.06]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M9 3L5 7l4 4" />
          </svg>
          Back
        </button>

        {/* Source info (Optional visual balance) */}
        <div className="text-center min-w-0 hidden md:block">
          <p className="text-xs text-white/50 truncate max-w-[300px]">{highlight.source}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Source Link Shortcut */}
          {highlight.url && highlight.url !== "#" && (
            <a
              href={formatSourceUrl(highlight.url, highlight.text)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "h-9 px-3 rounded-lg flex items-center gap-2 transition-all duration-150",
                "bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20",
                "font-medium text-xs whitespace-nowrap"
              )}
              title="Open Original Source"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span className="hidden sm:inline">Source</span>
            </a>
          )}

          {/* Edit Button */}
          <button
            onClick={() => {
              if (!canEdit) return;
              setIsTagOnly(false);
              setEditOpen(true);
            }}
            disabled={!canEdit}
            title={!canEdit ? "You must have editor access to edit this highlight." : undefined}
            aria-label="Edit Highlight"
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              "bg-white/[0.03] border border-white/[0.06]",
              "transition-all duration-150",
              canEdit
                ? "text-white/70 hover:text-white hover:bg-white/[0.08]"
                : "text-white/30 cursor-not-allowed"
            )}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2l2 2-8 8H2v-2l8-8z" />
            </svg>
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            disabled={isDeleting || !canEdit}
            title={!canEdit ? "You must have editor access to delete this highlight." : undefined}
            aria-label="Delete Highlight"
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              "bg-red-500/5 border border-red-500/10",
              "transition-all duration-150",
              !canEdit
                ? "text-red-400/30 cursor-not-allowed"
                : "text-red-400 hover:text-red-300 hover:bg-red-500/10",
              isDeleting && "opacity-50 cursor-not-allowed"
            )}>
            {isDeleting ? (
              <Spinner size="xs" variant="accent" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Typography controls */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center",
                "bg-white/[0.03] border border-white/[0.06]",
                "text-white/70 hover:text-white hover:bg-white/[0.08]",
                "transition-all duration-150",
              )}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 11h10M4 3h6M7 3v8" />
                </svg>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={8}
                align="end"
                className={cn(
                  "z-50 w-64 rounded-xl p-4",
                  "bg-elevated/90 backdrop-blur-2xl border border-white/[0.06]",
                  "shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
                  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                )}
              >
                {/* Font */}
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Font</p>
                <div className="flex gap-1 mb-4">
                  {FONT_OPTIONS.map((f, i) => (
                    <button
                      key={f.label}
                      onClick={() => setFontIdx(i)}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150",
                        fontIdx === i
                          ? "bg-white/[0.10] text-white border border-white/[0.06]"
                          : "text-white/40 hover:text-white/70 hover:bg-white/[0.05] border border-transparent",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Size */}
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Size</p>
                <div className="flex gap-1 mb-4">
                  {SIZE_OPTIONS.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => setSizeIdx(i)}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150",
                        sizeIdx === i
                          ? "bg-white/[0.10] text-white border border-white/[0.06]"
                          : "text-white/40 hover:text-white/70 hover:bg-white/[0.05] border border-transparent",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Theme */}
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Theme</p>
                <div className="flex gap-1">
                  {THEME_OPTIONS.map((t, i) => (
                    <button
                      key={t.label}
                      onClick={() => setThemeIdx(i)}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150",
                        themeIdx === i
                          ? "bg-white/[0.10] text-white border border-white/[0.06]"
                          : "text-white/40 hover:text-white/70 hover:bg-white/[0.05] border border-transparent",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>

      {/* Main Content Column */}
      <div
        ref={setContainer}
        className="flex-1 overflow-y-auto"
      >
        <article
          className="max-w-3xl mx-auto px-6 py-12"
          style={{ fontFamily: font.value }}
        >
          {/* Viewer Banner */}
          {isViewer && (
            <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/[0.08] border border-blue-500/20 text-blue-200/80 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-blue-400">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>This is a shared highlight with <strong>View-only</strong> access. You cannot edit it or add new comments.</span>
            </div>
          )}

          {/* Topic badge */}
          <div className="mb-6">
            <span className={cn("inline-block px-2.5 py-1 rounded-md text-[11px] font-medium", highlight.topicColor)}>
              {highlight.topic}
            </span>
          </div>

          {/* Highlight Content & Context */}
          <div className="mb-10">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className={cn("text-2xl font-bold tracking-tight leading-snug", theme.text)}>
                {highlight.fullText || highlight.text}
              </h1>
              {/* Favorite toggle */}
              <button
                onClick={() => toggleFavorite(highlight.id)}
                className="shrink-0 p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
                aria-label={highlight.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill={highlight.isFavorite ? "#F59E0B" : "none"}
                  stroke={highlight.isFavorite ? "#F59E0B" : "currentColor"}
                  strokeWidth="1.5"
                  className={highlight.isFavorite ? "" : "text-white/30"}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-white/40 flex-wrap">
              {/* Source name link (Primary shortcut) */}
              {highlight.url && highlight.url !== "#" ? (
                <a
                  href={formatSourceUrl(highlight.url, highlight.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-bold text-accent transition-all hover:text-accent-foreground hover:underline decoration-accent/30 underline-offset-4"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {highlight.source}
                </a>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-white/30">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                    <circle cx="6" cy="6" r="5" strokeWidth="1"/>
                  </svg>
                  {highlight.source}
                </span>
              )}

              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                  <circle cx="6" cy="6" r="4.5" /><path d="M6 3.5v3l2 1" />
                </svg>
                {formatRelativeDate(highlight.savedAt)}
              </span>
              
              {highlight.folder && (
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                    <path d="M1.5 3.5V9.5C1.5 10.05 1.95 10.5 2.5 10.5H9.5C10.05 10.5 10.5 10.05 10.5 9.5V4.5C10.5 3.95 10.05 3.5 9.5 3.5H6L5 2H2.5C1.95 2 1.5 2.45 1.5 3V3.5Z" />
                  </svg>
                  {highlight.folder}
                </span>
              )}
            </div>

            {/* Display Tags cleanly on the page */}
            {highlight.tags && highlight.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {highlight.tags.map((tagRef: any) => {
                  // Handle both string IDs (legacy/demo) and full TagDTO objects (shared highlights)
                  const isObject = typeof tagRef === "object" && tagRef !== null;
                  const tagId = isObject ? String(tagRef.id) : String(tagRef);
                  
                  // Try to find in local store first for most up-to-date name/color or if we only have an ID
                  const localTag = tags.find((x: any) => String(x.id) === tagId);
                  
                  // Use local tag if found, else use the object from the highlight itself
                  const t = localTag || (isObject ? tagRef : null);
                  
                  if (!t) return null;
                  return (
                    <TagPill key={tagId} name={t.name} color={t.color} />
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08] flex items-center justify-between group transition-all hover:bg-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center border border-white/[0.06]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
                      <path d="M12 2v20M2 12h20" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] text-white/40 font-medium uppercase tracking-widest leading-none">Metadata</p>
                    <p className="text-xs text-white/30 mt-1">No tags assigned to this highlight</p>
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      setIsTagOnly(true);
                      setEditOpen(true);
                    }}
                    className="text-[11px] font-semibold text-accent hover:text-accent/80 transition-colors px-3 py-1.5 rounded-lg bg-accent/5 hover:bg-accent/10 border border-accent/10"
                  >
                    + Assign Tag
                  </button>
                )}
              </div>
            )}
          </div>

          {/* YouTube video embed */}
          {highlight.resourceType === "VIDEO" && (() => {
            const videoId = getYouTubeVideoId(highlight.url);
            if (!videoId) return null;
            const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}${highlight.videoTimestamp ? `?start=${Math.floor(highlight.videoTimestamp)}` : ""}`;
            return (
              <div className="mb-10">
                <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.08] shadow-spatial-lg" style={{ aspectRatio: "16/9" }}>
                  <iframe
                    src={src}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube video"
                  />
                </div>
                {highlight.videoTimestamp != null && (
                  <p className="mt-2 text-[11px] text-white/40 flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-red-400">
                      <circle cx="6" cy="6" r="4.5" /><path d="M6 3.5v3l2 1" />
                    </svg>
                    Captured at {formatVideoTime(highlight.videoTimestamp)}
                  </p>
                )}
              </div>
            );
          })()}


          {/* Comments Section */}
          <div className="pt-8 border-t border-white/[0.08]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Comments</h3>
              {(() => {
                if (isViewer) {
                  return (
                    <span className="text-xs text-white/40 italic">
                      Viewers can only view comments
                    </span>
                  );
                }

                if (!isAddingComment) {
                  return (
                    <button
                      onClick={() => setIsAddingComment(true)}
                      className="text-xs text-accent hover:text-accent/80 font-medium"
                    >
                      + Add Comment
                    </button>
                  );
                }

                return null;
              })()}
            </div>

            <div className="space-y-4">
              {isFetchingComments ? (
                <div className="flex justify-center py-6">
                  <Spinner size="md" variant="accent" />
                </div>
              ) : comments.map((comment) => {
                const isMyComment = currentUser && String(currentUser.id) === String(comment.authorId);
                const isEditingThis = editingCommentId === comment.id;
                const authorName = isMyComment ? "You" : (comment.authorFullName || comment.authorEmail.split("@")[0]);
                const avatarInitial = authorName.charAt(0).toUpperCase();

                return (
                  <div key={comment.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                      <span className="text-accent text-sm font-bold">{avatarInitial}</span>
                    </div>
                    <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl rounded-tl-sm p-4">
                      <div className="flex items-baseline justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white/80">{authorName}</span>
                          <span className="text-[10px] text-white/30">{formatRelativeDate(comment.createdAt)}</span>
                        </div>
                        {isMyComment && !isEditingThis && (
                          <button
                            onClick={() => {
                              setEditCommentText(comment.text);
                              setEditingCommentId(comment.id);
                            }}
                            aria-label="Edit Comment"
                            className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 2l2 2-8 8H2v-2l8-8z" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {isEditingThis ? (
                        <div className="mt-2 text-right">
                          <textarea
                            autoFocus
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleUpdateComment(comment.id);
                              } else if (e.key === "Escape") {
                                setEditingCommentId(null);
                              }
                            }}
                            className={cn(
                              "w-full text-sm bg-black/40 border border-white/[0.06] rounded-md p-3",
                              "text-white/90 placeholder:text-white/20 focus:outline-none focus:border-accent/40",
                              "resize-none overflow-hidden transition-all duration-200"
                            )}
                            rows={3}
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              onClick={() => setEditingCommentId(null)}
                              className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white/90 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleUpdateComment(comment.id)}
                              className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 text-white/90 rounded border border-white/[0.05] transition-all"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className={cn("text-sm whitespace-pre-wrap", themeIdx === 0 ? "text-white/70" : themeIdx === 1 ? "text-[#E8E6E3]/70" : "text-white/70", "opacity-90")}>
                          {comment.text}
                        </p>
                      )}
 
                      {/* Reactions Display */}
                      {comment.reactions && comment.reactions.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {Array.from(new Set(comment.reactions.map(r => r.emoji))).map(emoji => {
                            const count = comment.reactions.filter(r => r.emoji === emoji).length;
                            const users = comment.reactions.filter(r => r.emoji === emoji).map(r => r.userName);
                            const hasReacted = currentUser && comment.reactions.some(r => r.emoji === emoji && String(r.userId) === String(currentUser.id));

                            return (
                              <Popover.Root key={emoji}>
                                <Popover.Trigger asChild>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleReaction(comment.id, emoji);
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all",
                                      "border border-white/[0.06] hover:border-white/20",
                                      hasReacted ? "bg-accent/20 border-accent/40 text-accent" : "bg-white/5 text-white/60 hover:bg-white/10"
                                    )}
                                    title={`Reacted by: ${users.join(", ")}`}
                                  >
                                    <span>{emoji}</span>
                                    {count > 1 && <span className="font-bold">{count}</span>}
                                  </button>
                                </Popover.Trigger>
                                <Popover.Portal>
                                  <Popover.Content
                                    side="top"
                                    sideOffset={6}
                                    className="z-50 bg-elevated/90 backdrop-blur-2xl border border-white/[0.06] rounded-xl p-2 shadow-spatial-md animate-in fade-in zoom-in-95 duration-100"
                                  >
                                    <div className="text-[10px] text-white/40 font-medium uppercase tracking-widest mb-1 px-1">Reacted by</div>
                                    <div className="flex flex-col gap-1">
                                      {users.map((u, i) => (
                                        <div key={i} className="text-xs text-white/80 px-1">{u}</div>
                                      ))}
                                    </div>
                                    <Popover.Arrow className="fill-elevated" />
                                  </Popover.Content>
                                </Popover.Portal>
                              </Popover.Root>
                            );
                          })}
                        </div>
                      )}
 
                      {/* Reaction Picker Button */}
                      <div className="mt-3 flex items-center justify-end">
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <button className="p-1.5 rounded-full text-white/20 hover:text-white/60 hover:bg-white/5 transition-all">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                              </svg>
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content
                              side="top"
                              align="end"
                              sideOffset={8}
                              className={cn(
                                "z-50 flex gap-1 p-1.5 rounded-full",
                                "bg-elevated/90 backdrop-blur-2xl border border-white/[0.06]",
                                "shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
                                "animate-in fade-in slide-in-from-bottom-2 duration-150"
                              )}
                            >
                              {QUICK_EMOJIS.map(emoji => {
                                const hasReacted = currentUser && comment.reactions?.some(r => r.emoji === emoji && String(r.userId) === String(currentUser.id));
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => handleToggleReaction(comment.id, emoji)}
                                    className={cn(
                                      "w-8 h-8 flex items-center justify-center rounded-full text-lg transition-all",
                                      "hover:bg-white/10 hover:scale-125 active:scale-95",
                                      hasReacted && "bg-accent/20"
                                    )}
                                  >
                                    {emoji}
                                  </button>
                                );
                              })}
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isAddingComment && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                    <span className="text-accent text-sm font-bold">You</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <textarea
                      autoFocus
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handlePostComment();
                        } else if (e.key === "Escape") {
                          setIsAddingComment(false);
                        }
                      }}
                      className={cn(
                        "w-full text-sm bg-black/40 border border-white/[0.06] rounded-xl rounded-tl-sm p-4",
                        "text-white/90 placeholder:text-white/20 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40",
                        "resize-none overflow-hidden transition-all duration-200"
                      )}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsAddingComment(false)}
                        className="px-4 py-2 text-xs font-medium text-white/50 hover:text-white/90 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePostComment}
                        className="px-4 py-2 text-xs font-medium bg-accent hover:bg-accent/90 text-white rounded-lg shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] transition-all"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </article>
      </div>

      {/* ─── Edit Modal ────────────────────────────────────────────── */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-white/[0.06] bg-elevated/90 backdrop-blur-2xl p-6 shadow-spatial-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-2xl">
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
                {isTagOnly ? "Assign Tags" : "Edit Highlight Details"}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-white/50">
                {isTagOnly
                  ? "Select one or more tags to categorize this highlight."
                  : "Make changes to your highlight's organization and metadata."}
              </Dialog.Description>
            </div>

            <div className="grid gap-6 py-4">
              {/* Folder Selection Custom UI */}
              {!isTagOnly && (
                <div className="flex flex-col gap-2 relative">
                  <label className="text-xs font-semibold uppercase tracking-widest text-white/40">Folder</label>

                  <Popover.Root open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
                    <Popover.Trigger asChild>
                      <button className="w-full flex items-center justify-between bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] rounded-xl px-3 py-2 text-sm text-white/80 outline-none focus:border-accent/50 transition-all">
                        <span className="flex items-center gap-2 truncate">
                          {editFolderId ? (
                            <>
                              <span>{folders.find(f => f.id === editFolderId)?.emoji || "📁"}</span>
                              <span>{folders.find(f => f.id === editFolderId)?.name}</span>
                            </>
                          ) : (
                            "Root (No Folder)"
                          )}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2.5 4.5l3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </Popover.Trigger>

                    <Popover.Portal>
                      <Popover.Content align="start" sideOffset={6} className="z-[70] w-[450px] flex flex-col rounded-xl bg-elevated/90 backdrop-blur-2xl border border-white/[0.06] shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] p-2">
                        {/* Create Folder (Pinned to top) */}
                        <div className="pb-2 mb-2 border-b border-white/[0.08]">
                          <button
                            onClick={() => {
                              setSubfolderParentId(undefined);
                              setFolderDialogOpen(true);
                              setFolderPopoverOpen(false);
                            }}
                            className="w-full flex items-center justify-start gap-2 px-3 py-1.5 rounded-xl text-sm text-accent hover:bg-accent/10 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                              <line x1="12" y1="11" x2="12" y2="17"></line>
                              <line x1="9" y1="14" x2="15" y2="14"></line>
                            </svg>
                            <span className="flex-1 text-left">Create New Folder</span>
                          </button>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto pr-1">
                          <button
                            onClick={() => {
                              setEditFolderId(null);
                              setFolderPopoverOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-start gap-2.5 px-3 py-1.5 rounded-xl mb-1",
                              "text-sm transition-all duration-150 ease-spatial min-w-0 text-left",
                              editFolderId === null
                                ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                                : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                            )}
                          >
                            <span className="text-base leading-none shrink-0 opacity-50">📂</span>
                            <span className="flex-1 truncate">Root (No Folder)</span>
                          </button>
                          <div className="space-y-0.5">
                            {renderFolderList(folders)}
                          </div>
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
              )}

              {/* Tags Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-white/40">Tags</label>
                <div className="flex flex-wrap gap-2 mb-1">
                  {editTags.map((tid) => {
                    const tag = tags.find((t: any) => String(t.id) === String(tid));
                    if (!tag) return null;
                    return (
                      <TagPill
                        key={tag.id}
                        name={tag.name}
                        color={tag.color}
                        onRemove={() => setEditTags(editTags.filter(id => String(id) !== String(tag.id)))}
                      />
                    );
                  })}
                </div>

                <Popover.Root open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                  <Popover.Trigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all w-max">
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5.5" /><path d="M7 4.5v5M4.5 7h5" /></svg>
                      Add tag...
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content align="start" sideOffset={6} className="z-[70] w-[240px] rounded-xl overflow-hidden bg-elevated/90 backdrop-blur-2xl border border-white/[0.06] shadow-spatial-lg p-0">
                      <div className="px-3 py-2 border-b border-white/[0.06]">
                        <input
                          autoFocus
                          value={tagQuery}
                          onChange={(e) => setTagQuery(e.target.value)}
                          placeholder="Search tags..."
                          className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none"
                        />
                      </div>
                      <div className="p-1 max-h-48 overflow-y-auto">
                        {filteredTags.length === 0 ? (
                          <div className="px-3 py-3 text-center border-t border-white/[0.06] mt-1">
                            <p className="text-xs text-white/30 mb-2">No tags found for &quot;{tagQuery}&quot;</p>
                            <button
                              onClick={() => {
                                setTagDialogOpen(true);
                                setTagPopoverOpen(false);
                              }}
                              className="text-xs text-accent hover:text-accent/80 transition-colors"
                            >
                              + Create New Tag
                            </button>
                          </div>
                        ) : (
                          <>
                            {filteredTags.map((tag: any) => (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  setEditTags([...editTags, tag.id]);
                                  setTagQuery("");
                                  setTagPopoverOpen(false);
                                }}
                                className="w-full flex justify-start px-2 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/[0.06]"
                              >
                                {tag.name}
                              </button>
                            ))}
                            <div className="p-1 border-t border-white/[0.06] mt-1">
                              <button
                                onClick={() => {
                                  setTagDialogOpen(true);
                                  setTagPopoverOpen(false);
                                }}
                                className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-xs text-white/40 hover:text-white/80 hover:bg-white/[0.06] rounded-lg transition-colors"
                              >
                                + Create New Tag
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>


            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <button
                onClick={() => setEditOpen(false)}
                className="mt-2 sm:mt-0 px-4 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-accent hover:bg-accent/90 text-white shadow-spatial-md shadow-accent/20 transition-all duration-200 ease-spatial"
              >
                Save Changes
              </button>
            </div>

            <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 border-none transition-opacity hover:opacity-100 focus:outline-none">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68688L4.03164 3.21846C3.80708 2.99391 3.44301 2.99391 3.21846 3.21846C2.99391 3.44301 2.99391 3.80708 3.21846 4.03164L6.68688 7.50005L3.21846 10.9685C2.99391 11.193 2.99391 11.5571 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31322L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.5571 12.0062 11.193 11.7816 10.9685L8.31322 7.50005L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
              </svg>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <FolderCreateDialog
        open={folderDialogOpen}
        onOpenChange={(v) => {
          setFolderDialogOpen(v);
          if (!v) setSubfolderParentId(undefined);
        }}
        parentId={subfolderParentId}
      />
      <NewTagDialog open={tagDialogOpen} onOpenChange={setTagDialogOpen} />

    </div>
  );
}
