"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../../lib/utils";

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // Base
        "z-50 overflow-hidden",
        "rounded-xl px-3 py-1.5",
        // Glassmorphic surface
        "bg-overlay/90 backdrop-blur-xl",
        "border border-white/10",
        "shadow-glass",
        // Typography
        "text-xs font-medium text-primary antialiased",
        // Animation
        "animate-scale-in",
        "origin-[var(--radix-tooltip-transform-origin)]",
        // Hardware accel
        "transform-gpu will-change-transform",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
