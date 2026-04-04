"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { Folder } from "@/store/types";

interface NewHighlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function NewHighlightDialog({ open, onOpenChange }: NewHighlightDialogProps) {
  const addHighlight = useDashboardStore((s) => s.addHighlight);
  const folders = useDashboardStore((s) => s.folders);
  const tagsList = useDashboardStore((s) => s.tags);
  const activeFolder = useDashboardStore((s) => s.activeFolder);

  // Recursive helper for folder hierarchy
  const uniqueFolders = React.useMemo(() => {
    const editable = folders.filter(f => {
      const role = f.effectiveRole?.toUpperCase();
      return role === "OWNER" || role === "EDITOR";
    });
    const editableIds = new Set(editable.map(f => f.id));
    
    // A folder is a "view root" if its parent is NOT editable or NOT in the list
    const roots = editable.filter(f => !f.parentId || !editableIds.has(f.parentId));
    
    const result: (Folder & { depth: number; prefix: string })[] = [];
    const seen = new Set<string>();

    function walk(all: Folder[], parentId: string, depth: number) {
      if (seen.has(parentId)) return;
      seen.add(parentId);
      
      const children = all.filter(f => f.parentId === parentId);
      for (const child of children) {
        // Build an explicit visual marker for hierarchy: "  └─ "
        const prefix = depth > 0 ? "\u00A0\u00A0".repeat(depth - 1) + "└─ " : "";
        result.push({ ...child, depth, prefix });
        walk(all, child.id, depth + 1);
      }
    }

    // Sort roots by name then walk their children
    roots.sort((a, b) => a.name.localeCompare(b.name)).forEach(root => {
      result.push({ ...root, depth: 0, prefix: "" });
      walk(editable, root.id, 1);
    });

    return result;
  }, [folders]);

  React.useEffect(() => {
    if (open) {
      console.log("[NewHighlightDialog] Total Folders:", folders.length);
      console.log("[NewHighlightDialog] Unique Editable:", uniqueFolders.map(f => `${f.name} (${f.effectiveRole})`));
    }
  }, [open, folders, uniqueFolders]);

  const uniqueTags = React.useMemo(() => {
    const seen = new Set<string>();
    return tagsList.filter((t) => { const sid = String(t.id); if (seen.has(sid)) return false; seen.add(sid); return true; });
  }, [tagsList]);

  const [text, setText] = React.useState("");
  const [source, setSource] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  
  // Only default to activeFolder if user has edit permissions there
  const [selectedFolder, setSelectedFolder] = React.useState<string | undefined>(() => {
    if (!activeFolder) return undefined;
    const current = folders.find(f => f.id === activeFolder);
    const role = current?.effectiveRole?.toUpperCase();
    if (current && (role === "OWNER" || role === "EDITOR")) {
      return activeFolder;
    }
    return undefined;
  });
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [tagQuery, setTagQuery] = React.useState("");
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  function reset() {
    setText("");
    setSource("");
    setSaving(false);
    
    // Reset to activeFolder ONLY if it's editable
    if (activeFolder) {
      const current = folders.find(f => f.id === activeFolder);
      const role = current?.effectiveRole?.toUpperCase();
      if (current && (role === "OWNER" || role === "EDITOR")) {
        setSelectedFolder(activeFolder);
      } else {
        setSelectedFolder(undefined);
      }
    } else {
      setSelectedFolder(undefined);
    }

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
        tagIds: selectedTags,
      });

      if (!saved) {
        toast.error("Failed to save highlight", {
          description: "Please check your network connection and try again.",
        });
        return;
      }

      const { premiumToast } = await import("@/lib/premium-feedback");
      premiumToast.highlightCreated();
      onOpenChange(false);
      reset();
    } catch (err: unknown) {
      toast.error("Creation failed", {
        description: err instanceof Error ? err.message : "An unexpected error occurred while saving the highlight.",
      });
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

            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
              {/* Panel */}
              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 4 }}
                  transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                  className={cn(
                    "relative z-50 pointer-events-auto",
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
                      disabled={saving}
                      className={cn(
                        "w-full resize-none rounded-xl",
                        "bg-white/[0.04] border border-white/[0.08]",
                        "px-3.5 py-3 text-sm text-white/85 placeholder:text-white/25",
                        "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
                        "transition-colors duration-150",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
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
                      disabled={saving}
                      className={cn(
                        "w-full h-10 rounded-xl",
                        "bg-white/[0.04] border border-white/[0.08]",
                        "px-3.5 text-sm text-white/85 placeholder:text-white/25",
                        "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
                        "transition-colors duration-150",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
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
                        disabled={saving}
                        className={cn(
                          "w-full h-10 rounded-xl",
                          "bg-white/[0.04] border border-white/[0.08]",
                          "px-3 text-sm text-white/85",
                          "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
                          "appearance-none cursor-pointer transition-colors duration-150",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                      >
                        <option value="" className="bg-[#1c1c1c]">No folder</option>
                        {uniqueFolders.map(f => (
                          <option key={f.id} value={f.id} className="bg-[#1c1c1c]">
                            {f.prefix}{f.emoji} {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tags Selection */}
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-medium text-white/50">Tags</label>
                      <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <Popover.Trigger asChild>
                          <button
                            disabled={saving}
                            className={cn(
                              "w-full h-10 rounded-xl flex items-center justify-between",
                              "bg-white/[0.04] border border-white/[0.08]",
                              "px-3 text-sm text-white/85",
                              "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
                              "transition-colors duration-150",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
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
                        </Popover.Trigger>

                        <Popover.Portal>
                          <Popover.Content 
                            align="start" 
                            side="bottom" 
                            sideOffset={8}
                            className={cn(
                              "z-[60] w-[220px] sm:w-[240px]", 
                              "bg-[#1c1c1c] border border-white/[0.09] rounded-xl shadow-[0_12px_48px_rgba(0,0,0,0.6)]",
                              "p-2 outline-none flex flex-col gap-1",
                              "animate-in fade-in zoom-in-95 duration-200"
                            )}
                          >
                            <input
                              type="text"
                              placeholder="Search tags..."
                              value={tagQuery}
                              onChange={(e) => setTagQuery(e.target.value)}
                              autoFocus
                              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white mb-1 focus:outline-none focus:border-accent/50"
                            />
                            
                            {selectedTags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-1 py-1 border-b border-white/[0.06]">
                                {selectedTags.map(id => {
                                  const tag = tagsList.find(t => t.id === id);
                                  if (!tag) return null;
                                  return (
                                    <span key={id} className="inline-flex items-center gap-1 bg-white/[0.08] px-2 py-0.5 rounded border border-white/[0.1] text-xs text-white">
                                      {tag.name}
                                      <button onClick={(e) => { e.stopPropagation(); toggleTag(id); }} className="hover:text-white/50 text-[10px]">&times;</button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            <div className="max-h-52 overflow-y-auto scrollbar-hide py-1">
                              {filteredTags.length === 0 ? (
                                <p className="text-center text-xs text-white/30 py-4">No tags found</p>
                              ) : (
                                <div className="space-y-0.5">
                                  {filteredTags.map(tag => (
                                    <button
                                      key={tag.id}
                                      onClick={() => toggleTag(tag.id)}
                                      className="w-full text-left px-3 py-2 rounded-md hover:bg-white/[0.06] text-xs text-white/80 transition-colors"
                                    >
                                      {tag.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 mt-4">
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
            </div>
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
