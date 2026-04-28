"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import type { Folder } from "@/store/types";
import { Loader2 } from "lucide-react";
import styles from "./FolderCreateDialog.module.css";

// ─── Animation ────────────────────────────────────────────────────────────────
const ease = [0.20, 0.90, 0.30, 1.00] as const;

// ─── Component ────────────────────────────────────────────────────────────────
interface FolderCreateDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  parentId?:    string;
}

export function FolderCreateDialog({ open, onOpenChange, parentId: initialParentId }: FolderCreateDialogProps) {
  const addFolder = useDashboardStore((s) => s.addFolder);
  const folders   = useDashboardStore((s) => s.folders);
  const [name, setName] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [parentId, setParentId] = React.useState<string | undefined>(initialParentId);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset parentId when dialog opens
  React.useEffect(() => {
    if (open) {
      setName("");
      setParentId(initialParentId);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialParentId]);

  function calculateDepth(id: string | undefined): number {
    if (!id) return 0;
    const f = folders.find(folder => folder.id === id);
    if (!f) return 0;
    return 1 + calculateDepth(f.parentId);
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Policy: Max 10 levels deep
    if (parentId && calculateDepth(parentId) >= 10) {
      toast.error("Depth limit reached", {
        description: "Folders can only be nested up to 10 levels deep."
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addFolder(trimmed, parentId);
      toast.success(parentId ? `Subfolder "${trimmed}" created` : `Folder "${trimmed}" created`);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create folder. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") onOpenChange(false);
  }

  // Build folder tree for parent selection
  const flatFolders = React.useMemo(() => {
    const out: (Folder & { depth: number; prefix: string })[] = [];
    const seen = new Set<string>();
    function walk(parentId: string | null | undefined, depth: number) {
      folders.filter((f) => f.parentId === parentId || (!f.parentId && !parentId)).forEach((child) => {
        if (seen.has(child.id)) return;
        seen.add(child.id);
        out.push({ ...child, depth, prefix: depth ? "\u00a0".repeat((depth - 1) * 3) + "\u2514\u2500 " : "" });
        walk(child.id, depth + 1);
      });
    }
    walk(undefined, 0);
    return out;
  }, [folders]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay>
              <motion.div
                key="folder-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Panel */}
              <Dialog.Content className={cn(
                // Positioning
                "relative z-50 pointer-events-auto",
                // Size
                "w-full max-w-sm",
                // Surface
                "rounded-2xl bg-elevated/90 backdrop-blur-2xl border border-white/[0.06]",
                "shadow-spatial-lg",
                "p-6",
                // Focus ring removal
                "focus:outline-none",
              )}>
                <motion.div
                  key="folder-dialog"
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1,    y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 4 }}
                  transition={{ duration: 0.25, ease }}
                >
                  <Dialog.Title className="text-base font-semibold tracking-tight mb-1">
                  {parentId ? "New subfolder" : "New folder"}
                </Dialog.Title>
                  <Dialog.Description className="text-xs text-white/40 mb-5">
                  {parentId
                    ? `Create a subfolder inside '${folders.find((f) => f.id === parentId)?.name ?? "Unknown"}'.`
                    : "Give your folder a name. You can rename it later."}
                </Dialog.Description>

                  {/* Parent folder selector */}
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Parent folder</label>
                  <select
                    aria-label="Select parent folder"
                    value={parentId || ""}
                    onChange={e => setParentId(e.target.value || undefined)}
                    className={styles["folder-dropdown"]}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <option value="">No parent (root folder)</option>
                    {flatFolders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.prefix}{f.emoji ? `${f.emoji} ` : ""}{f.name}
                      </option>
                    ))}
                  </select>

                  <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. Frontend Research"
                    maxLength={48}
                    className={cn(
                      "w-full h-10 px-3.5 rounded-xl mb-5",
                      "bg-white/[0.05] border border-white/[0.08]",
                      "text-sm text-white placeholder:text-white/25",
                      "outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30",
                      "transition-all duration-150",
                    )}
                  />

                  <div className="flex items-center gap-2.5 justify-end">
                    <Dialog.Close asChild>
                      <button
                        className={cn(
                          "h-9 px-4 rounded-xl",
                          "text-sm text-white/60 hover:text-white",
                          "bg-white/[0.04] hover:bg-white/[0.08]",
                          "border border-white/[0.07]",
                          "transition-all duration-150",
                        )}
                      >
                        Cancel
                      </button>
                    </Dialog.Close>
                    <button
                      onClick={handleCreate}
                      disabled={!name.trim() || isSubmitting}
                      className={cn(
                        "h-9 px-5 rounded-xl min-w-[80px]",
                        "text-sm font-medium text-white",
                        "bg-accent hover:bg-accent/90",
                        "shadow-[0_0_16px_rgba(129,140,248,0.25)]",
                        "transition-all duration-150 ease-spatial",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                      )}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" />
                      ) : (
                        "Create"
                      )}
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
