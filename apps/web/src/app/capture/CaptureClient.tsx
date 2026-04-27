"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast, Toaster } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { useAuthStore } from "@/store/authStore";
import { Loader } from "@/components/ui/Loader";
import type { Folder } from "@/store/types";

/**
 * CaptureClient — slim, auto-filled "save highlight" UI used by the
 * bookmarklet (and by extension users who land on /capture). No dashboard
 * sidebar / header chrome — designed to feel like a popup.
 */
export default function CaptureClient() {
  const params = useSearchParams();

  const initialText   = (params.get("text")  ?? "").slice(0, 8000);
  const initialUrl    = params.get("url")    ?? "";
  const initialTitle  = params.get("title")  ?? "";

  const { user, hasFetched, fetchUser } = useAuthStore();
  const folders     = useDashboardStore((s) => s.folders);
  const tags        = useDashboardStore((s) => s.tags);
  const fetchFolders = useDashboardStore((s) => s.fetchFolders);
  const fetchTags    = useDashboardStore((s) => s.fetchTags);
  const addHighlight = useDashboardStore((s) => s.addHighlight);

  // Local form state, pre-filled from query string
  const [text, setText]               = React.useState(initialText);
  const [source, setSource]           = React.useState(initialTitle || initialUrl);
  const [folderId, setFolderId]       = React.useState<string | undefined>();
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [tagQuery, setTagQuery]       = React.useState("");
  const [saving, setSaving]           = React.useState(false);
  const [done, setDone]               = React.useState(false);

  React.useEffect(() => { fetchUser(); }, [fetchUser]);
  React.useEffect(() => {
    if (user) { fetchFolders(); fetchTags(); }
  }, [user, fetchFolders, fetchTags]);

  // Keyboard: Esc → close popup window if we were opened by the bookmarklet,
  //          Mod+Enter → save
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
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
  }, [text, saving]);

  // Folder hierarchy (flat list with depth prefix, OWNER/EDITOR only)
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
      const children = editable.filter((f) => f.parentId === parentId);
      for (const child of children) {
        out.push({ ...child, depth, prefix: depth ? " ".repeat((depth - 1) * 2) + "└─ " : "" });
        walk(child.id, depth + 1);
      }
    }
    roots.sort((a, b) => a.name.localeCompare(b.name)).forEach((root) => {
      out.push({ ...root, depth: 0, prefix: "" });
      walk(root.id, 1);
    });
    return out;
  }, [folders]);

  const filteredTags = tags.filter(
    (t) => t.name.toLowerCase().includes(tagQuery.toLowerCase()) && !selectedTags.includes(t.id),
  );

  function toggleTag(id: string) {
    setSelectedTags((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
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
      if (!ok) {
        toast.error("Couldn't save — please try again.");
        return;
      }
      setDone(true);
      // Auto-close the bookmarklet popup after a beat so the user feels speed.
      setTimeout(() => { if (window.opener) window.close(); }, 900);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ── States ────────────────────────────────────────────────────────────────

  if (hasFetched && !user) {
    const ret = encodeURIComponent(`/capture?${params.toString()}`);
    if (typeof window !== "undefined") window.location.href = `/login?returnTo=${ret}`;
    return null;
  }

  if (!hasFetched) {
    return (
      <Loader page label="Loading…" />
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-white/80">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-xl">✓</div>
          <p className="text-sm">Saved to Cortex.</p>
          <p className="text-xs text-white/40">This window will close…</p>
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
          "bg-elevated/90 backdrop-blur-2xl border border-white/[0.06] rounded-2xl",
          "shadow-spatial-lg p-6",
        )}
      >
        <div className="mb-5">
          <h1 className="text-base font-semibold text-white/90">Save to Cortex</h1>
          <p className="mt-1 text-xs text-white/40 truncate">{initialUrl || "Manual entry"}</p>
        </div>

        <label className="block text-xs font-medium text-white/50 mb-1.5">Highlight</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          autoFocus
          placeholder="Paste or edit the passage to save…"
          className={cn(
            "w-full resize-none rounded-xl bg-white/[0.04] border border-white/[0.08]",
            "px-3.5 py-3 text-sm text-white/85 placeholder:text-white/25",
            "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
          )}
        />

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
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Folder</label>
           <select
              value={folderId ?? ""}
              onChange={(e) => setFolderId(e.target.value || undefined)}
              title="Select folder"
              className={cn(
                "w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]",
                "px-3 text-sm text-white/85 focus:outline-none focus:border-accent/50",
              )}
            >
              <option value="">No folder</option>
              {flatFolders.map((f) => (
                <option key={f.id} value={f.id}>{f.prefix}{f.emoji ? `${f.emoji} ` : ""}{f.name}</option>
              ))}
            </select> 
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Tags</label>
            <input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Filter tags…"
              className={cn(
                "w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]",
                "px-3 text-sm text-white/85 focus:outline-none focus:border-accent/50",
              )}
            />
          </div>
        </div>

        {(selectedTags.length > 0 || filteredTags.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedTags.map((id) => {
              const t = tags.find((x) => x.id === id);
              if (!t) return null;
              return (
                <button
                  key={id}
                  onClick={() => toggleTag(id)}
                  className="px-2 py-1 rounded-full text-xs bg-accent/20 text-accent border border-accent/30"
                >
                  {t.name} ×
                </button>
              );
            })}
            {filteredTags.slice(0, 8).map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTag(t.id)}
                className="px-2 py-1 rounded-full text-xs bg-white/[0.05] text-white/70 border border-white/[0.08] hover:bg-white/[0.08]"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => { if (window.opener) window.close(); else history.back(); }}
            className="h-10 px-4 rounded-xl text-sm text-white/60 hover:text-white/90"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className={cn(
              "h-10 px-5 rounded-xl text-sm font-medium",
              "bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center gap-2",
            )}
          >
            {saving ? <Loader size="xs" variant="white" /> : null}
            {saving ? "Saving…" : "Save"}
            <span className="text-[10px] text-white/60 border border-white/20 rounded px-1 py-0.5 ml-1">⌘↵</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
