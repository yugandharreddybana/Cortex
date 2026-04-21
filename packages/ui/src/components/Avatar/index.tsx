"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "../../lib/utils";

// ─── Avatar — Glass Ring with Spatial Depth ───────────────────────────────────

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  /** Show online indicator */
  online?: boolean;
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, online, ...props }, ref) => (
  <div className="relative inline-flex">
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        // Glass ring — frosted border effect
        "ring-[1.5px] ring-white/[0.10]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.10)]",
        // Hover — subtle glow lift
        "transition-all duration-200 ease-spatial",
        "hover:ring-white/[0.18] hover:shadow-[0_0_12px_rgba(129,140,248,0.12)]",
        className,
      )}
      {...props}
    />
    {/* Online indicator — luminous green orb */}
    {online && (
      <span
        aria-label="Online"
        className={cn(
          "absolute -bottom-0.5 -right-0.5 z-10",
          "h-3 w-3 rounded-full",
          "bg-success border-2 border-bg",
          "shadow-[0_0_8px_rgba(74,222,128,0.5)]",
          "animate-pulse-glow",
        )}
      />
    )}
  </div>
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full",
      "bg-elevated text-secondary text-sm font-medium",
      "bg-gradient-to-br from-white/[0.06] to-transparent",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
