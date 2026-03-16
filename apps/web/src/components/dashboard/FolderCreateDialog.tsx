"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

// ─── Animation ────────────────────────────────────────────────────────────────
const ease = [0.16, 1, 0.3, 1] as const;

// ─── Component ────────────────────────────────────────────────────────────────
interface FolderCreateDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  parentId?:    string;
}

export function FolderCreateDialog({ open, onOpenChange, parentId }: FolderCreateDialogProps) {
  const addFolder = useDashboardStore((s) => s.addFolder);
  const folders   = useDashboardStore((s) => s.folders);
  const [name, setName] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const parentName = parentId ? folders.find((f) => f.id === parentId)?.name : undefined;

  // Focus input whenever dialog opens
  React.useEffect(() => {
    if (open) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addFolder(trimmed, parentId);
    toast.success(parentId ? `Subfolder "${trimmed}" created` : `Folder "${trimmed}" created`);
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                key="folder-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {/* Panel */}
            <Dialog.Content asChild>
              <motion.div
                key="folder-dialog"
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1,    y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.25, ease }}
                className={cn(
                  // Positioning
                  "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  // Size
                  "w-full max-w-sm",
                  // Surface
                  "rounded-2xl bg-[#171717] border border-white/[0.09]",
                  "shadow-[0_32px_64px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]",
                  "p-6",
                  // Focus ring removal
                  "focus:outline-none",
                )}
              >
                <Dialog.Title className="text-base font-semibold tracking-tight mb-1">
                  {parentId ? "New subfolder" : "New folder"}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-white/40 mb-5">
                  {parentId && parentName
                    ? `Create a subfolder inside "${parentName}".`
                    : "Give your folder a name. You can rename it later."}
                </Dialog.Description>

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
                    disabled={!name.trim()}
                    className={cn(
                      "h-9 px-5 rounded-xl",
                      "text-sm font-medium text-white",
                      "bg-accent hover:bg-accent/90",
                      "shadow-[0_0_16px_rgba(108,99,255,0.3)]",
                      "transition-all duration-150",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    Create
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
