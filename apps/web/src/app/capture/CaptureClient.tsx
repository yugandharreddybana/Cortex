"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { useAuthStore } from "@/store/authStore";
import { Loader } from "@/components/ui/Loader";
import { FolderCreateDialog } from "@/components/dashboard/FolderCreateDialog";
import type { Folder } from "@/store/types";

export default function CaptureClient() {
  const params = useSearchParams();

  const initialText  = (params.get("text")  ?? "").slice(0, 8000);
  const initialUrl   = params.get("url")    ?? "";
  const initialTitle = params.get("title")  ?? "";

  const { user, hasFetched, fetchUser } = useAuthStore();
  const folders      = useDashboardStore((s) => s.folders);
  const tags         = useDashboardStore((s) => s.tags);
  const fetchFolders = useDashboardStore((s) => s.fetchFolders);
  const fetchTags    = useDashboardStore((s) => s.fetchTags);
  const addHighlight = useDashboardStore((s) => s.addHighlight);
  const addTag       = useDashboardStore((s) => s.addTag);

  const [text, setText]                 = React.useState(initialText);
  const [source, setSource]             = React.useState(initialTitle || initialUrl);
  const [folderId, setFolderId]         = React.useState<string | undefined>();
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [tagQuery, setTagQuery]         = React.useState("");
  const [tagOpen, setTagOpen]           = React.useState(false);
  const [creatingTag, setCreatingTag]   = React.useState(false);
  const [folderOpen, setFolderOpen]     = React.useState(false);
  const [createFolderOpen, setCreateFolderOpen] = React.useState(false);
  const folderIdsAtDialogOpen = React.useRef<Set<string>>(new Set());
  const foldersRef = React.useRef(folders);
  React.useEffect(() => { foldersRef.current = folders; }, [folders]);
  const [saving, setSaving]             = React.useState(false);
  const [done, setDone]                 = React.useState(false);

  const folderRef = React.useRef<HTMLDivElement>(null);
  const tagRef    = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { fetchUser(); }, [fetchUser]);
  React.useEffect(() => {
    if (user) { fetchFolders(); fetchTags(); }
  }, [user, fetchFolders, fetchTags]);

  // Close dropdowns on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (folderRef.current && !folderRef.current.contains(e.target as Node)) setFolderOpen(false);
      if (tagRef.current    && !tagRef.current.contains(e.target as Node))    setTagOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (folderOpen) { setFolderOpen(false); return; }
        if (tagOpen)    { setTagOpen(false);    return; }
        if (window.opener) window.close();
      }
      const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key === "Enter" && !saving && text.trim()) {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, saving, folderOpen, tagOpen]);

  // Flat folder list (OWNER/EDITOR only)
  const flatFolders = React.useMemo(() => {
    const editable = folders.filter((f) => {
      const r = f.effectiveRole?.toUpperCase();
      return !r || r === "OWNER" || r === "EDITOR";
    });
    const editableIds = new Set(editable.map((f) => f.id));
    const roots = editable.filter((f) => !f.parentId || !editableIds.has(f.parentId));
    const out: (Folder & { depth: number; prefix: string })[] = [];
    const seen = new Set<string>();
    function walk(parentId: string, depth: number) {
      if (seen.has(parentId)) return;
      seen.add(parentId);
      editable.filter((f) => f.parentId === parentId).forEach((child) => {
        out.push({ ...child, depth, prefix: depth ? "\u00a0".repeat((depth - 1) * 3) + "\u2514\u2500 " : "" });
        walk(child.id, depth + 1);
      });
    }
    roots.sort((a, b) => a.name.localeCompare(b.name)).forEach((root) => {
      out.push({ ...root, depth: 0, prefix: "" });
      walk(root.id, 1);
    });
    return out;
  }, [folders]);

  const selectedFolder = flatFolders.find((f) => f.id === folderId);

  const filteredTags = tags.filter(
    (t) => t.name.toLowerCase().includes(tagQuery.toLowerCase()) && !selectedTags.includes(t.id),
  );

  function toggleTag(id: string) {
    setSelectedTags((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function handleCreateTag() {
    const name = tagQuery.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    try {
      await addTag(name, "#6366f1");
      const newTag = useDashboardStore.getState().tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (newTag) {
        setSelectedTags((p) => [...p, newTag.id]);
      }
      setTagQuery("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create tag");
    } finally {
      setCreatingTag(false);
    }
  }

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const ok = await addHighlight({
        text: text.trim(),
        source: source.trim() || initialUrl || "Web capture",
        url: initialUrl || undefined,
        folderId,
        tagIds: selectedTags,
      });
      if (!ok) { toast.error("Couldn\u2019t save \u2014 please try again."); return; }
      setDone(true);
      setTimeout(() => { if (window.opener) window.close(); }, 900);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ── Auth states ────────────────────────────────────────────────────────────
  if (hasFetched && !user) {
    const ret = encodeURIComponent(`/capture?${params.toString()}`);
    if (typeof window !== "undefined") window.location.href = `/login?returnTo=${ret}`;
    return null;
  }
  if (!hasFetched) return <Loader page label="Loading\u2026" />;

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-white/80">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-xl">\u2713</div>
          <p className="text-sm">Saved to Cortex.</p>
          <p className="text-xs text-white/40">This window will close\u2026</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-bg p-6">
      <Toaster theme="dark" position="top-center" />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "w-full max-w-[520px] mt-6",
          "bg-elevated/90 backdrop-blur-2xl border border-white/[0.06] rounded-2xl shadow-spatial-lg p-6",
        )}
      >
        <div className="mb-5">
          <h1 className="text-base font-semibold text-white/90">Save to Cortex</h1>
          <p className="mt-1 text-xs text-white/40 truncate">{initialUrl || "Manual entry"}</p>
        </div>

        {/* Highlight */}
        <label className="block text-xs font-medium text-white/50 mb-1.5">Highlight</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          autoFocus
          placeholder="Paste or edit the passage to save\u2026"
          className={cn(
            "w-full resize-none rounded-xl bg-white/[0.04] border border-white/[0.08]",
            "px-3.5 py-3 text-sm text-white/85 placeholder:text-white/25",
            "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
          )}
        />

        {/* Source */}
        <label className="block text-xs font-medium text-white/50 mt-4 mb-1.5">Source</label>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Enter source or title"
          className={cn(
            "w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]",
            "px-3.5 text-sm text-white/85 focus:outline-none focus:border-accent/50",
          )}
        />

        <div className="grid grid-cols-2 gap-4 mt-4">

          {/* ── Folder custom dropdown ── */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Folder</label>
            <div ref={folderRef} className="relative">
              <button
                type="button"
                onClick={() => setFolderOpen((v) => !v)}
                className={cn(
                  "w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3",
                  "flex items-center justify-between text-sm text-white/85",
                  "focus:outline-none focus:border-accent/50 transition-colors",
                  folderOpen && "border-accent/50",
                )}
              >
                <span className="truncate">
                  {selectedFolder
                    ? `${selectedFolder.emoji ? selectedFolder.emoji + " " : ""}${selectedFolder.name}`
                    : <span className="text-white/35">No folder</span>}
                </span>
                <ChevronDown open={folderOpen} />
              </button>
              <AnimatePresence>
                {folderOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className={cn(
                      "absolute z-50 top-[calc(100%+4px)] left-0 right-0",
                      "rounded-xl bg-[#1a1a2e] border border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                      "max-h-52 overflow-y-auto overscroll-contain",
                    )}
                  >
                    {/* No folder option */}
                    <button
                      type="button"
                      onClick={() => { setFolderId(undefined); setFolderOpen(false); }}
                      className={cn(
                        "w-full px-3 py-2.5 text-left text-sm transition-colors",
                        !folderId ? "text-white bg-white/[0.08]" : "text-white/50 hover:bg-white/[0.05] hover:text-white/90",
                      )}
                    >
                      No folder
                    </button>
                    {flatFolders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setFolderId(f.id); setFolderOpen(false); }}
                        className={cn(
                          "w-full px-3 py-2.5 text-left text-sm transition-colors",
                          folderId === f.id
                            ? "text-white bg-white/[0.08]"
                            : "text-white/70 hover:bg-white/[0.05] hover:text-white/90",
                        )}
                      >
                        {f.prefix}{f.emoji ? `${f.emoji} ` : ""}{f.name}
                      </button>
                    ))}
                    {/* Create new folder */}
                    <button
                      type="button"
                      onClick={() => {
                        folderIdsAtDialogOpen.current = new Set(folders.map((f) => f.id));
                        setFolderOpen(false);
                        setCreateFolderOpen(true);
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm text-accent/80 hover:bg-white/[0.05] hover:text-accent border-t border-white/[0.06] flex items-center gap-1.5 transition-colors"
                    >
                      <span className="text-base leading-none">+</span> New folder
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Tags custom dropdown ── */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Tags</label>
            <div ref={tagRef} className="relative">
              <input
                value={tagQuery}
                onChange={(e) => { setTagQuery(e.target.value); setTagOpen(true); }}
                onFocus={() => setTagOpen(true)}
                placeholder={selectedTags.length > 0 ? `${selectedTags.length} selected` : "Search tags\u2026"}
                className={cn(
                  "w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]",
                  "px-3 text-sm text-white/85 placeholder:text-white/35",
                  "focus:outline-none focus:border-accent/50 transition-colors",
                  tagOpen && "border-accent/50",
                )}
              />
              <AnimatePresence>
                {tagOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className={cn(
                      "absolute z-50 top-[calc(100%+4px)] left-0 right-0",
                      "rounded-xl bg-[#1a1a2e] border border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                      "max-h-52 overflow-y-auto overscroll-contain",
                    )}
                  >
                    {/* Selected tags first */}
                    {selectedTags.map((id) => {
                      const t = tags.find((x) => x.id === id);
                      if (!t) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleTag(id)}
                          className="w-full px-3 py-2.5 text-left text-sm text-white bg-accent/10 hover:bg-accent/20 flex items-center justify-between transition-colors"
                        >
                          <span>{t.name}</span>
                          {/* Removed unicode checkmark for cleaner display */}
                        </button>
                      );
                    })}
                    {/* Unselected / filtered tags */}
                    {filteredTags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { toggleTag(t.id); setTagQuery(""); }}
                        className="w-full px-3 py-2.5 text-left text-sm text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        {t.name}
                      </button>
                    ))}
                    {/* Create new tag option */}
                    {tagQuery.trim() && !tags.some((t) => t.name.toLowerCase() === tagQuery.trim().toLowerCase()) && (
                      <button
                        type="button"
                        onClick={handleCreateTag}
                        disabled={creatingTag}
                        className="w-full px-3 py-2.5 text-left text-sm text-accent/80 hover:bg-white/[0.05] hover:text-accent border-t border-white/[0.06] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <span className="text-base leading-none">+</span>
                        {creatingTag ? "Creating\u2026" : `Create \u201c${tagQuery.trim()}\u201d`}
                      </button>
                    )}
                    {filteredTags.length === 0 && selectedTags.length === 0 && !tagQuery.trim() && (
                      <p className="px-3 py-3 text-xs text-white/30 text-center">No tags yet \u2014 type to create one</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Selected tag chips */}
        {selectedTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedTags.map((id) => {
              const t = tags.find((x) => x.id === id);
              if (!t) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTag(id)}
                  className="px-2.5 py-1 rounded-full text-xs bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 transition-colors"
                >
                  {t.name} \u00d7
                </button>
              );
            })}
          </div>
        )}

        {/* Create folder dialog — rendered outside folderRef to avoid outside-click conflicts */}
        <FolderCreateDialog
          open={createFolderOpen}
          onOpenChange={(isOpen) => {
            setCreateFolderOpen(isOpen);
            if (!isOpen) {
              // Auto-select the newly created folder by diffing against folder IDs at dialog open time
              const newFolder = foldersRef.current.find((f) => !folderIdsAtDialogOpen.current.has(f.id));
              if (newFolder) setFolderId(newFolder.id);
            }
          }}
        />

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => { if (window.opener) window.close(); else history.back(); }}
            className="h-10 px-4 rounded-xl text-sm text-white/60 hover:text-white/90 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className={cn(
              "h-10 px-5 rounded-xl text-sm font-medium",
              "bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center gap-2 transition-colors",
            )}
          >
            {saving ? <Loader size="xs" variant="white" /> : null}
            {saving ? "Saving\u2026" : "Save"}
            <span className="text-[10px] text-white/60 border border-white/20 rounded px-1 py-0.5 ml-1">\u2318\u21b5</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      className={cn("text-white/30 shrink-0 transition-transform duration-150", open && "rotate-180")}
    >
      <path d="M2 4l4 4 4-4" />
    </svg>
  );
}
