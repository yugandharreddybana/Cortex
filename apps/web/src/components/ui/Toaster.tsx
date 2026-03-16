"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";
import { useToastStore } from "@/store/useToastStore";

// ─── Toaster ──────────────────────────────────────────────────────────────────
// Mount once in the root layout. Automatically renders all active toasts.

export function Toaster() {
  const toasts      = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            open
            duration={t.duration ?? 4000}
            onOpenChange={(open) => { if (!open) removeToast(t.id); }}
            asChild
            forceMount
          >
            <motion.div
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0,  scale: 1    }}
              exit={{    opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
              className={cn(
                "pointer-events-auto",
                "flex items-start gap-3 w-[360px] max-w-[calc(100vw-2rem)]",
                "rounded-xl px-4 py-3.5",
                "bg-[#1c1c1c] border border-white/[0.10]",
                "shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]",
                "backdrop-blur-xl",
              )}
            >
              {/* Icon */}
              <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                <CheckCircleIcon />
              </span>

              <div className="flex-1 min-w-0">
                <ToastPrimitive.Title className="text-sm font-semibold text-white/90 leading-tight">
                  {t.title}
                </ToastPrimitive.Title>
                {t.description && (
                  <ToastPrimitive.Description className="text-xs text-white/45 mt-0.5 leading-relaxed">
                    {t.description}
                  </ToastPrimitive.Description>
                )}
              </div>

              <ToastPrimitive.Close asChild>
                <button
                  className="shrink-0 mt-0.5 p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all duration-150"
                  aria-label="Dismiss"
                >
                  <XIcon />
                </button>
              </ToastPrimitive.Close>
            </motion.div>
          </ToastPrimitive.Root>
        ))}
      </AnimatePresence>

      {/* Viewport — bottom-right corner */}
      <ToastPrimitive.Viewport
        className={cn(
          "fixed bottom-6 right-6 z-[9999]",
          "flex flex-col gap-2",
          "outline-none",
          "pointer-events-none",
          "[--viewport-padding:0px]",
        )}
      />
    </ToastPrimitive.Provider>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CheckCircleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" />
      <path d="M3.5 6l2 2 3-3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2l8 8M10 2L2 10" />
    </svg>
  );
}
