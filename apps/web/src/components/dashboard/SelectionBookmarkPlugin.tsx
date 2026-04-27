"use client";

/**
 * SelectionBookmarkPlugin
 * =======================
 * Drop this anywhere inside your dashboard layout (already mounted in
 * apps/web/src/app/dashboard/layout.tsx).
 *
 * When the user selects ANY text anywhere in the dashboard a floating
 * toolbar appears above the selection with:
 *   • Save Bookmark button
 *   • Inline folder picker
 *   • Inline tag multi-select
 *   • Manage Access – set sharing (friends / team / role) before or after save
 *
 * AUTH GATE: If useAuthStore.user is null the component returns null
 * immediately — no event listeners, no UI, nothing is attached.
 *
 * Works on:
 *   - AI-agent conversation views (uses data-message-id when available)
 *   - Highlights page, folders, read view, settings — any dashboard text
 *
 * Usage:
 *   <SelectionBookmarkPlugin />
 *   // optionally pass containerRef to restrict to a specific scroll container:
 *   <SelectionBookmarkPlugin containerRef={chatRef} />
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useDashboardStore } from "@/store/dashboard";
import { useAuthStore } from "@/store/authStore";
import { ManageAccessModal } from "./ManageAccessModal";
import type { Tag, HighlightMeta } from "@/store/types";

interface SelectionAnchor {
  x: number;
  y: number;
  text: string;
  meta: HighlightMeta;
}

interface SelectionBookmarkPluginProps {
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function SelectionBookmarkPlugin({ containerRef }: SelectionBookmarkPluginProps) {
  // ── AUTH GATE ──────────────────────────────────────────────────────────────────
  const user         = useAuthStore((s) => s.user);
  const addHighlight = useDashboardStore((s) => s.addHighlight);
  const folders      = useDashboardStore((s) => s.folders);
  const tags         = useDashboardStore((s) => s.tags);

  const [anchor, setAnchor]                     = React.useState<SelectionAnchor | null>(null);
  const [saving, setSaving]                     = React.useState(false);
  const [showPicker, setShowPicker]             = React.useState(false);
  const [selFolderId, setSelFolder]             = React.useState<string | null>(null);
  const [selTagIds, setSelTagIds]               = React.useState<string[]>([]);
  const [savedHighlightId, setSavedId]          = React.useState<string | null>(null);
  const [manageAccessOpen, setManageAccessOpen] = React.useState(false);
  const toolbarRef                              = React.useRef<HTMLDivElement>(null);

  // Reset picker state whenever a new selection is made
  React.useEffect(() => {
    if (anchor) {
      setShowPicker(false);
      setSelFolder(null);
      setSelTagIds([]);
      setSavedId(null);
    }
  }, [anchor?.text, anchor?.meta.messageId]);

  // Attach / detach mouse listeners — only when user is logged in
  React.useEffect(() => {
    if (!user) return;

    /**
     * Tries to find the nearest ancestor with data-message-id (AI chat view).
     * Returns null on regular dashboard pages — that is fine and expected.
     */
    function resolveMessageBlock(range: Range): HTMLElement | null {
      let node: Node | null =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as Element)
          : range.startContainer.parentElement;
      while (node && node !== document.body) {
        if ((node as HTMLElement).dataset?.messageId) return node as HTMLElement;
        node = (node as HTMLElement).parentElement;
      }
      return null;
    }

    function onMouseUp(e: MouseEvent) {
      // Ignore clicks that land on the toolbar itself
      if (toolbarRef.current?.contains(e.target as Node)) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setAnchor(null);
        return;
      }

      const selectedText = sel.toString().trim();
      if (selectedText.length < 2) {
        setAnchor(null);
        return;
      }

      const range = sel.getRangeAt(0);

      // If a containerRef is passed, only activate inside that container
      if (
        containerRef?.current &&
        !containerRef.current.contains(range.commonAncestorContainer)
      ) {
        setAnchor(null);
        return;
      }

      const rect = range.getBoundingClientRect();

      // Try to resolve an AI chat message block — falls back gracefully to null
      const block     = resolveMessageBlock(range);
      const messageId = block?.dataset.messageId ?? `page-${Date.now()}`;

      setAnchor({
        x:    rect.left + rect.width / 2,
        y:    rect.top - 12,
        text: selectedText,
        meta: {
          messageId,
          startOffset: range.startOffset,
          endOffset:   range.endOffset,
          quote:       selectedText.slice(0, 80),
        },
      });
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAnchor(null);
        setShowPicker(false);
      }
    }

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keyup",   onKeyUp);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup",   onKeyUp);
    };
  }, [user, containerRef]);

  // Dismiss toolbar when clicking outside
  React.useEffect(() => {
    if (!anchor) return;
    function onMouseDown(e: MouseEvent) {
      if (!toolbarRef.current?.contains(e.target as Node)) {
        setAnchor(null);
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [anchor]);

  async function handleSave() {
    if (!anchor || saving) return;
    setSaving(true);
    try {
      const saved = await addHighlight({
        text:     anchor.text,
        source:   `agent:${anchor.meta.messageId}`,
        url:      window.location.href,
        folderId: selFolderId ?? undefined,
        tagIds:   selTagIds,
        meta:     anchor.meta,
      });
      if (saved) {
        const id = typeof saved === "object" && saved !== null && "id" in saved
          ? (saved as { id: string }).id
          : null;
        setSavedId(id);
        const folderName = folders.find((f) => f.id === selFolderId)?.name;
        const tagNames   = tags.filter((t) => selTagIds.includes(t.id)).map((t) => t.name);
        toast.success("Bookmark saved!", {
          description: [
            `"${anchor.text.slice(0, 50)}${anchor.text.length > 50 ? "…" : ""}",`,
            folderName ? `Folder: ${folderName}` : null,
            tagNames.length ? `Tags: ${tagNames.join(", ")}` : null,
          ].filter(Boolean).join(" · "),
          action: id
            ? { label: "Manage Access", onClick: () => setManageAccessOpen(true) }
            : undefined,
        });
        window.getSelection()?.removeAllRanges();
        setAnchor(null);
        setShowPicker(false);
      } else {
        toast.error("Couldn't save bookmark", { description: "Please try again." });
      }
    } finally {
      setSaving(false);
    }
  }

  // Guest: render nothing
  if (!user) return null;

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {anchor && (
            <motion.div
              ref={toolbarRef}
              key="bookmark-toolbar"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{   opacity: 0, y: 4, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              style={{
                position:  "fixed",
                left:      anchor.x,
                top:       anchor.y,
                transform: "translate(-50%, -100%)",
                zIndex:    9999,
                maxWidth:  "min(360px, 90vw)",
              }}
              className="flex flex-col rounded-xl shadow-2xl bg-[#1c1b19]/95 backdrop-blur-xl border border-white/[0.08] select-none overflow-hidden"
            >
              {/* ── Top row: bookmark icon + label + folder/tag toggle + save + manage access + dismiss ── */}
              <div className="flex items-center gap-2 px-3 py-2">

                {/* Bookmark icon */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400/80 shrink-0" aria-hidden="true">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>

                {/* Selected text preview */}
                <span className="flex-1 text-xs text-white/60 truncate max-w-[120px]">
                  {anchor.text.length > 35 ? anchor.text.slice(0, 35) + "…" : anchor.text}
                </span>

                {/* Folder + tag toggle button */}
                <button
                  type="button"
                  onClick={() => setShowPicker((v) => !v)}
                  title="Set folder and tags"
                  className={[
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors duration-150",
                    showPicker
                      ? "bg-white/[0.10] text-white/80"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {selFolderId || selTagIds.length > 0
                    ? [
                        selFolderId ? "1 folder" : "",
                        selFolderId && selTagIds.length ? " · " : "",
                        selTagIds.length ? `${selTagIds.length} tag${selTagIds.length > 1 ? "s" : ""}` : "",
                      ].join("")
                    : "Add to…"}
                </button>

                {/* Save button */}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-2.5 py-1 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : "Save"}
                </button>

                {/* Manage Access button */}
                <button
                  type="button"
                  onClick={() => setManageAccessOpen(true)}
                  title="Manage access — control who can view this bookmark"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-white/40 hover:text-violet-300 hover:bg-violet-500/[0.10] transition-colors duration-150"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Access
                </button>

                {/* Dismiss */}
                <button
                  type="button"
                  onClick={() => { setAnchor(null); setShowPicker(false); }}
                  className="text-white/25 hover:text-white/60 transition-colors duration-150"
                  aria-label="Dismiss"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/>
                  </svg>
                </button>
              </div>

              {/* ── Expandable folder + tag picker ── */}
              <AnimatePresence initial={false}>
                {showPicker && (
                  <motion.div
                    key="picker"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{   height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden border-t border-white/[0.06]"
                  >
                    <div className="px-3 py-2.5 space-y-3">

                      {/* Folder section */}
                      {folders.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-1.5">Folder</p>
                          <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                            <FolderChip
                              label="None"
                              emoji=""
                              selected={selFolderId === null}
                              onClick={() => setSelFolder(null)}
                            />
                            {folders.map((f) => (
                              <FolderChip
                                key={f.id}
                                label={f.name}
                                emoji={f.emoji}
                                selected={selFolderId === f.id}
                                onClick={() => setSelFolder(f.id === selFolderId ? null : f.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags section */}
                      {tags.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-1.5">Tags</p>
                          <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                            {tags.map((t) => (
                              <TagChip
                                key={t.id}
                                tag={t}
                                selected={selTagIds.includes(t.id)}
                                onClick={() =>
                                  setSelTagIds((prev) =>
                                    prev.includes(t.id)
                                      ? prev.filter((x) => x !== t.id)
                                      : [...prev, t.id],
                                  )
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {folders.length === 0 && tags.length === 0 && (
                        <p className="text-xs text-white/25 py-1">
                          No folders or tags yet. Create them in the sidebar first.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* ManageAccessModal */}
      <ManageAccessModal
        open={manageAccessOpen}
        onOpenChange={setManageAccessOpen}
        resourceType="highlight"
        resourceId={savedHighlightId ?? ""}
        resourceTitle={anchor?.text?.slice(0, 60) ?? "Bookmark"}
      />
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────────────────

function FolderChip({
  label, emoji, selected, onClick,
}: { label: string; emoji: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors duration-150",
        selected
          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
          : "bg-white/[0.05] text-white/50 hover:text-white/80 hover:bg-white/[0.08] border border-transparent",
      ].join(" ")}
    >
      {emoji && <span aria-hidden="true">{emoji}</span>}
      {label}
      {selected && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 4l1.5 1.5 3-3"/>
        </svg>
      )}
    </button>
  );
}

function TagChip({
  tag, selected, onClick,
}: { tag: Tag; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors duration-150",
        selected
          ? "ring-1 ring-white/30 opacity-100"
          : "opacity-60 hover:opacity-90",
        tag.color || "bg-white/[0.08] text-white/70",
      ].join(" ")}
    >
      {tag.name}
      {selected && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 4l1.5 1.5 3-3"/>
        </svg>
      )}
    </button>
  );
}
