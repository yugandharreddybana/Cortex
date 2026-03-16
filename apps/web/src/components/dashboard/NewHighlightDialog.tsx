"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

interface NewHighlightDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
}


export function NewHighlightDialog({ open, onOpenChange }: NewHighlightDialogProps) {
  const addHighlight = useDashboardStore((s) => s.addHighlight);
  const folders = useDashboardStore((s) => s.folders);
  const tagsList = useDashboardStore((s) => s.tags);
  const activeFolder = useDashboardStore((s) => s.activeFolder);

  // Deduplicate by string id — safety net against any sync path inserting duplicates
  const uniqueFolders = React.useMemo(() => {
    const seen = new Set<string>();
    return folders.filter((f) => { const sid = String(f.id); if (seen.has(sid)) return false; seen.add(sid); return true; });
  }, [folders]);
  const uniqueTags = React.useMemo(() => {
    const seen = new Set<string>();
    return tagsList.filter((t) => { const sid = String(t.id); if (seen.has(sid)) return false; seen.add(sid); return true; });
  }, [tagsList]);

  const [text,    setText]    = React.useState("");
  const [source,  setSource]  = React.useState("");
  const [saving,  setSaving]  = React.useState(false);
  const [selectedFolder, setSelectedFolder] = React.useState<string | undefined>(activeFolder || undefined);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [tagQuery, setTagQuery] = React.useState("");
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  function reset() {
    setText("");
    setSource("");
    setSaving(false);
    setSelectedFolder(activeFolder || undefined);
    setSelectedTags([]);
    setTagQuery("");
    setPopoverOpen(false);
  }

  const filteredTags = uniqueTags.filter(
    (t) =>
      t.name.toLowerCase().includes(tagQuery.toLowerCase()) &&
      !selectedTags.includes(t.id),
  );

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);

    try {
      const saved = await addHighlight({
        text: text.trim(),
        source: source.trim() || "Manual entry",
        folderId: selectedFolder,
        tags: selectedTags,
      });

      if (!saved) {
        toast.error("Failed to save highlight. Please try again.");
        return;
      }

      toast.success("Highlight saved");
      onOpenChange(false);
      reset();
    } catch {
      toast.error("Failed to save highlight. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {/* Panel */}
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1,    y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                className={cn(
                  "fixed left-1/2 top-1/2 z-50",
                  "-translate-x-1/2 -translate-y-1/2",
                  "w-full max-w-[520px] mx-4",
                  "bg-[#171717] border border-white/[0.09] rounded-2xl",
                  "shadow-[0_24px_64px_rgba(0,0,0,0.6)]",
                  "p-6 outline-none",
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-white/90 leading-tight">
                      New Highlight
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-xs text-white/40">
                      Manually capture a passage you want to remember.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        "text-white/40 hover:text-white/80",
                        "hover:bg-white/[0.06] transition-colors duration-150",
                      )}
                      aria-label="Close"
                    >
                      <CloseIcon />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Textarea — highlight content */}
                <div className="space-y-1.5 mb-4">
                  <label className="text-xs font-medium text-white/50" htmlFor="nh-text">
                    Highlight Content <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="nh-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste or type the passage you want to save…"
                    rows={5}
                    className={cn(
                      "w-full resize-none rounded-xl",
                      "bg-white/[0.04] border border-white/[0.08]",
                      "px-3.5 py-3 text-sm text-white/85 placeholder:text-white/25",
                      "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
                      "transition-colors duration-150",
                    )}
                  />
                </div>

                {/* Input — source URL */}
                <div className="space-y-1.5 mb-6">
                  <label className="text-xs font-medium text-white/50" htmlFor="nh-source">
                    Source URL or Title
                  </label>
                  <input
                    id="nh-source"
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g. https://example.com/article or 'Book Title'"
                    className={cn(
                      "w-full h-10 rounded-xl",
                      "bg-white/[0.04] border border-white/[0.08]",
                      "px-3.5 text-sm text-white/85 placeholder:text-white/25",
                      "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
                      "transition-colors duration-150",
                    )}
                  />
                </div>

                {/* Folders and Tags UI */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Folder Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Folder</label>
                    <select
                      value={selectedFolder || ""}
                      onChange={(e) => setSelectedFolder(e.target.value || undefined)}
                      className={cn(
                        "w-full h-10 rounded-xl",
                        "bg-white/[0.04] border border-white/[0.08]",
                        "px-3 text-sm text-white/85",
                        "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
                        "appearance-none cursor-pointer transition-colors duration-150",
                      )}
                    >
                      <option value="" className="bg-[#1c1c1c]">No folder</option>
                      {uniqueFolders.map(f => (
                        <option key={f.id} value={f.id} className="bg-[#1c1c1c]">
                          {f.emoji} {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tags Selection */}
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-medium text-white/50">Tags</label>
                    <button
                      onClick={() => setPopoverOpen(!popoverOpen)}
                      className={cn(
                        "w-full h-10 rounded-xl flex items-center justify-between",
                        "bg-white/[0.04] border border-white/[0.08]",
                        "px-3 text-sm text-white/85",
                        "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
                        "transition-colors duration-150",
                      )}
                    >
                      <span className="truncate">
                        {selectedTags.length > 0 
                          ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}` 
                          : "Select tags..."}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" className="text-white/40 shrink-0">
                        <path d="M3 4.5l3 3 3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {/* Simple Tags Dropdown */}
                    {popoverOpen && (
                      <div className={cn(
                        "absolute z-50 left-0 right-0 top-[full] mt-2",
                        "bg-[#1c1c1c] border border-white/[0.09] rounded-xl shadow-2xl",
                        "p-2 max-h-48 overflow-y-auto"
                      )}>
                        <input 
                          type="text" 
                          placeholder="Search tags..." 
                          value={tagQuery}
                          onChange={(e) => setTagQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white mb-2 focus:outline-none focus:border-accent/50"
                        />
                        {selectedTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-white/[0.06]">
                            {selectedTags.map(id => {
                              const tag = tagsList.find(t => t.id === id);
                              if (!tag) return null;
                              return (
                                <span key={id} className="inline-flex items-center gap-1 bg-white/[0.08] px-2 py-0.5 rounded border border-white/[0.1] text-xs text-white">
                                  {tag.name}
                                  <button onClick={(e) => { e.stopPropagation(); toggleTag(id); }} className="hover:text-white/50">&times;</button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {filteredTags.length === 0 ? (
                          <p className="text-center text-xs text-white/30 py-2">No tags found</p>
                        ) : (
                          <div className="space-y-0.5">
                            {filteredTags.map(tag => (
                              <button
                                key={tag.id}
                                onClick={(e) => { e.stopPropagation(); toggleTag(tag.id); }}
                                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-white/[0.06] text-sm text-white/80 transition-colors"
                              >
                                {tag.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                  <Dialog.Close asChild>
                    <button
                      className={cn(
                        "h-9 px-4 rounded-xl text-sm",
                        "text-white/50 hover:text-white/80",
                        "hover:bg-white/[0.06] transition-colors duration-150",
                      )}
                    >
                      Cancel
                    </button>
                  </Dialog.Close>

                  <button
                    onClick={handleSave}
                    disabled={!text.trim() || saving}
                    className={cn(
                      "h-9 px-5 rounded-xl text-sm font-medium",
                      "bg-white text-black",
                      "hover:bg-gray-200 active:scale-95",
                      "transition-all duration-150",
                      "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
                    )}
                  >
                    {saving ? "Saving…" : "Save Highlight"}
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}
