"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

interface RenameFolderDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  folderId:     string;
  currentName:  string;
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  folderId,
  currentName,
}: RenameFolderDialogProps) {
  const renameFolder = useDashboardStore((s) => s.renameFolder);
  const [name, setName] = React.useState(currentName);
  const [error, setError] = React.useState("");

  // Sync name when the target folder changes
  React.useEffect(() => {
    setName(currentName);
    setError("");
  }, [currentName, folderId]);

  function handleClose(v: boolean) {
    if (!v) setError("");
    onOpenChange(v);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Folder name is required.");
      return;
    }
    renameFolder(folderId, trimmed);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
          <Dialog.Content
          className={cn(
            "relative z-50 pointer-events-auto",
            "w-full max-w-sm",
            "rounded-2xl border border-white/[0.09] bg-[#181818]",
            "shadow-[0_24px_64px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.07)]",
            "p-6 focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <Dialog.Title className="text-base font-semibold tracking-tight mb-0.5">
            Rename Folder
          </Dialog.Title>
          <Dialog.Description className="text-sm text-white/40 mb-5">
            Enter a new name for &ldquo;{currentName}&rdquo;.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="Folder name"
                className={cn(
                  "w-full h-10 px-3.5 rounded-xl",
                  "bg-white/[0.05] border",
                  error ? "border-red-500/40" : "border-white/[0.08]",
                  "text-sm text-white placeholder:text-white/20",
                  "outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25",
                  "transition-all duration-150",
                )}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "h-9 px-4 rounded-xl",
                    "text-sm text-white/50 hover:text-white",
                    "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]",
                    "transition-all duration-150",
                  )}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className={cn(
                  "h-9 px-5 rounded-xl",
                  "text-sm font-medium text-white",
                  "bg-accent hover:bg-accent/90",
                  "shadow-[0_0_16px_rgba(108,99,255,0.25)]",
                  "transition-all duration-150",
                )}
              >
                Rename
              </button>
            </div>
          </form>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
