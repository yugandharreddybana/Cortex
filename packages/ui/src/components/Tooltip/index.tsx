"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../../lib/utils";

// ─── Tooltip — Glass with Blur-in Entrance ───────────────────────────────────

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
        // Spatial layering
        "z-tooltip overflow-hidden",
        "rounded-xl px-3 py-1.5",
        // Glass surface — prominent tier
        "bg-elevated/90 backdrop-blur-xl",
        "border border-white/[0.10]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.4),0_8px_24px_-4px_rgba(0,0,0,0.3)]",
        // Typography
        "text-xs font-medium text-primary antialiased",
        // Blur-in entrance animation
        "animate-blur-in",
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
