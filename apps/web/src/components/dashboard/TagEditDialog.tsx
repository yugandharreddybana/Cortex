"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore, Tag } from "@/store/dashboard";
import { Loader2 } from "lucide-react";

// ─── Color options ─────────────────────────────────────────────────────────────

const DEFAULT_COLORS = [
  { key: "#ef4444", name: "Red" },
  { key: "#3b82f6", name: "Blue" },
  { key: "#22c55e", name: "Green" },
  { key: "#eab308", name: "Yellow" },
];

function getContrastColor(hexColor: string) {
  const hex = (hexColor || "#ffffff").replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
}

// ─── Components ───────────────────────────────────────────────────────────────
interface TagEditDialogProps {
  tag:          Tag | null;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagEditDialog({ tag, open, onOpenChange }: TagEditDialogProps) {
  const updateTag = useDashboardStore((s) => s.updateTag);

  const [name,  setName]  = React.useState("");
  const [color, setColor] = React.useState<string>(DEFAULT_COLORS[0].key);
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync state when tag changes or opens
  React.useEffect(() => {
    if (tag && open) {
      setName(tag.name);
      setColor(tag.color);
      setError("");
    }
  }, [tag, open]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!tag) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Tag name is required.");
      return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading("Updating tag...");
    try {
      await updateTag(tag.id, trimmed, color);
      toast.success(`Tag updated`, { id: toastId });
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to update tag.";
      toast.error(msg, { id: toastId });
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
          <Dialog.Content
            className={cn(
              "relative z-50 pointer-events-auto",
              "w-full max-w-md",
              "rounded-2xl border border-white/[0.06] bg-elevated/90 backdrop-blur-2xl",
              "shadow-spatial-lg",
              "p-6 focus:outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            <Dialog.Title className="text-base font-semibold tracking-tight mb-0.5">
              Edit Tag
            </Dialog.Title>
            <Dialog.Description className="text-sm text-white/40 mb-5">
              Rename your tag or pick a new color.
            </Dialog.Description>

            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="edit-tag-name" className="text-xs font-medium text-white/50">
                  Tag name
                </label>
                <input
                  id="edit-tag-name"
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  placeholder="e.g. Must Read"
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

              <div className="flex flex-row gap-6 items-start mt-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/50 mb-2">Color</p>
                  <div className="grid grid-cols-5 gap-2.5 p-3 rounded-2xl bg-gradient-to-br from-[#23233a] via-[#181825] to-[#181818] border border-white/10 shadow-[0_2px_16px_rgba(60,60,120,0.10)]">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setColor(c.key)}
                        className={cn(
                          "w-9 h-9 rounded-full border-2 border-white/15 flex items-center justify-center shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent",
                          color === c.key
                            ? "ring-2 ring-offset-2 ring-accent scale-110 border-accent shadow-[0_0_0_4px_rgba(129,140,248,0.18)] outline-none"
                            : "opacity-90 hover:opacity-100 hover:scale-110 hover:shadow-lg",
                        )}
                        style={{ background: c.key, boxShadow: color === c.key ? '0 0 0 4px rgba(129,140,248,0.18), 0 2px 12px rgba(0,0,0,0.13)' : undefined }}
                        aria-label={c.name}
                      >
                        {color === c.key && (
                          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                            <path d="M5 9l3 3 5-5" stroke={getContrastColor(c.key)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    ))}
                    <label className="relative cursor-pointer flex items-center justify-center">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          setColor(e.target.value);
                          e.target.blur();
                        }}
                        className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                        aria-label="Custom color picker"
                      />
                      <span
                        className={cn(
                          "w-9 h-9 rounded-full border-2 border-white/15 flex items-center justify-center transition-all duration-150",
                          !DEFAULT_COLORS.some((c) => c.key === color) && "ring-2 ring-offset-2 ring-accent scale-110 border-accent shadow-[0_0_0_4px_rgba(129,140,248,0.18)]"
                        )}
                        style={{ background: DEFAULT_COLORS.some((c) => c.key === color) ? "linear-gradient(135deg,#a855f7,#3b82f6,#10b981)" : color }}
                        title="Custom color"
                      >
                        {DEFAULT_COLORS.some((c) => c.key === color) && (
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="4" fill="white" fillOpacity=".8" />
                            <circle cx="10" cy="10" r="2" fill="white" />
                          </svg>
                        )}
                        {!DEFAULT_COLORS.some((c) => c.key === color) && (
                          <span className="text-[10px] font-bold" style={{ color: getContrastColor(color) }}>Aa</span>
                        )}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className={cn(
                      "h-9 px-4 rounded-xl",
                      "text-sm text-white/50 hover:text-white",
                      "bg-white/[0.04] hover:bg-white/[0.08]",
                      "border border-white/[0.06]",
                      "transition-all duration-150",
                    )}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "h-9 px-5 rounded-xl min-w-[80px]",
                    "text-sm font-medium text-white",
                    "bg-accent hover:bg-accent/90",
                    "shadow-[0_0_16px_rgba(129,140,248,0.25)]",
                    "transition-all duration-150",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" />
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
