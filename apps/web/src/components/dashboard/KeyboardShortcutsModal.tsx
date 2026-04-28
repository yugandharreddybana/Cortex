"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SHORTCUTS: { group: string; items: { keys: string[]; label: string }[] }[] = [
  {
    group: "Navigation",
    items: [
      { keys: ["⌘", "K"],        label: "Open command palette" },
      { keys: ["⌘", "/"],        label: "Keyboard shortcuts" },
      { keys: ["G", "F"],        label: "Go to Favorites" },
      { keys: ["G", "A"],        label: "Go to Archive" },
      { keys: ["G", "T"],        label: "Go to Trash" },
    ],
  },
  {
    group: "Highlights",
    items: [
      { keys: ["N"],             label: "New highlight" },
      { keys: ["⌘", "N"],        label: "New highlight (global)" },
      { keys: ["⌘", "⇧", "S"],   label: "Quick capture" },
      { keys: ["P"],             label: "Pin selected highlight" },
      { keys: ["F"],             label: "Favourite selected highlight" },
      { keys: ["Del"],           label: "Delete selected highlight" },
    ],
  },
  {
    group: "Folders",
    items: [
      { keys: ["⌘", "⇧", "N"],   label: "New folder" },
      { keys: ["⌘", "⇧", "D"],   label: "Duplicate folder" },
      { keys: ["Esc"],           label: "Close folder / go up" },
    ],
  },
  {
    group: "View",
    items: [
      { keys: ["⌘", "1"],        label: "Grid view" },
      { keys: ["⌘", "2"],        label: "List view" },
      { keys: ["⌘", "3"],        label: "Compact view" },
      { keys: ["⌘", "E"],        label: "Export library" },
    ],
  },
  {
    group: "AI",
    items: [
      { keys: ["⌘", "⇧", "A"],   label: "Auto-draft selected folder" },
      { keys: ["⌘", "⇧", "D2"],  label: "Devil's advocate" },
      { keys: ["⌘", "⇧", "C"],   label: "Connect the dots" },
    ],
  },
];

export function KeyboardShortcutsModal({ open, onOpenChange }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  key="kb-overlay"
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                />
              </Dialog.Overlay>

              {/* Panel */}
              <Dialog.Content asChild forceMount>
                <motion.div
                  key="kb-panel"
                  className={cn(
                    "fixed left-1/2 top-1/2 z-50",
                    "-translate-x-1/2 -translate-y-1/2",
                    "w-full max-w-2xl max-h-[85vh] overflow-y-auto",
                    "glass-prominent rounded-2xl p-6",
                    "border border-white/[0.08] shadow-spatial-xl",
                    "scrollbar-hide",
                  )}
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 4 }}
                  transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <Dialog.Title className="text-base font-semibold text-white/90">
                        Keyboard Shortcuts
                      </Dialog.Title>
                      <p className="text-xs text-white/35 mt-0.5">Master Cortex at the speed of thought</p>
                    </div>
                    <button
                      onClick={() => onOpenChange(false)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-150"
                      aria-label="Close"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                        <path d="M2 2l10 10M12 2L2 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Groups grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {SHORTCUTS.map((group, gi) => (
                      <motion.div
                        key={group.group}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: gi * 0.04, duration: 0.2 }}
                      >
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3 px-1">
                          {group.group}
                        </p>
                        <div className="space-y-1">
                          {group.items.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-center justify-between gap-4 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors duration-100"
                            >
                              <span className="text-[12px] text-white/55">{item.label}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {item.keys.map((k, ki) => (
                                  <kbd
                                    key={ki}
                                    className={cn(
                                      "inline-flex items-center justify-center",
                                      "min-w-[22px] h-[22px] px-1.5",
                                      "text-[10px] font-mono font-medium text-white/60",
                                      "bg-white/[0.05] border border-white/[0.10]",
                                      "rounded-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)]",
                                    )}
                                  >
                                    {k}
                                  </kbd>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-white/[0.05] flex items-center justify-between">
                    <p className="text-[11px] text-white/20">Press <kbd className="text-[10px] bg-white/[0.05] border border-white/[0.08] rounded px-1 py-0.5">Esc</kbd> to close</p>
                    <p className="text-[11px] text-white/20">Cortex — context-aware research engine</p>
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
