import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";
import { useDashboardStore, type Highlight } from "@/store/dashboard";

interface AIContextModalProps {
  highlight: Highlight;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AIContextModal({ highlight, open, onOpenChange, onSuccess }: AIContextModalProps) {
  const [aiContext, setAiContext] = React.useState(highlight.aiContext || "");
  const [aiResponse, setAiResponse] = React.useState(highlight.aiResponse || "");
  const updateHighlight = useDashboardStore((s) => s.updateHighlight);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAiContext(highlight.aiContext || "");
      setAiResponse(highlight.aiResponse || "");
    }
  }, [open, highlight.aiContext, highlight.aiResponse]);

  const handleSave = async () => {
    setSaving(true);
    updateHighlight(highlight.id, { aiContext, aiResponse });
    setSaving(false);
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className={cn(
                  "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                  "w-[90vw] max-w-md rounded-2xl",
                  "bg-elevated/90 backdrop-blur-2xl border border-white/[0.06]",
                  "shadow-spatial-lg overflow-hidden",
                  "flex flex-col focus:outline-none",
                )}
              >
                <div className="px-6 py-5 border-b border-white/[0.06]">
                  <Dialog.Title className="text-lg font-semibold text-white/90">
                    Provide AI Context
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-white/60 mt-1">
                    This is an AI-generated highlight. We need a bit more information about the context to provide accurate AI features.
                  </Dialog.Description>
                </div>

                <div className="px-6 py-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60">What is this highlight about?</label>
                    <textarea
                      value={aiContext}
                      onChange={(e) => setAiContext(e.target.value)}
                      placeholder="e.g., A discussion about React Server Components..."
                      rows={3}
                      className={cn(
                        "w-full rounded-xl px-3.5 py-3",
                        "bg-white/[0.04] border border-white/[0.08]",
                        "text-sm text-white/80 placeholder:text-white/20",
                        "outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20",
                        "resize-none transition-all duration-150",
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60">What was the AI&apos;s response?</label>
                    <textarea
                      value={aiResponse}
                      onChange={(e) => setAiResponse(e.target.value)}
                      placeholder="e.g., The AI explained that RSCs allow rendering on the server..."
                      rows={4}
                      className={cn(
                        "w-full rounded-xl px-3.5 py-3",
                        "bg-white/[0.04] border border-white/[0.08]",
                        "text-sm text-white/80 placeholder:text-white/20",
                        "outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20",
                        "resize-none transition-all duration-150",
                      )}
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3 bg-white/[0.02]">
                  <button
                    onClick={() => onOpenChange(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !aiContext.trim() || !aiResponse.trim()}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium",
                      "bg-accent hover:bg-accent/90 text-white shadow-glow-sm",
                      "transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    Save & Continue
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
