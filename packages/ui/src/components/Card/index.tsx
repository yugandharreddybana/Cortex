"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

// ─── Card — Spatial Glass Surface ─────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Enable interactive hover effects (lift, glow, cursor tracking) */
  interactive?: boolean;
  /** Custom glow colour on hover */
  glowColor?: string;
  /** Glass tier: subtle | default | prominent */
  glass?: "subtle" | "default" | "prominent";
}

const glassTiers = {
  subtle: [
    "bg-white/[0.02]",
    "border border-white/[0.05]",
    "shadow-spatial-sm",
  ],
  default: [
    "bg-surface/60",
    "border border-white/[0.07]",
    "shadow-spatial-sm",
    "[backdrop-filter:blur(24px)_saturate(1.2)]",
  ],
  prominent: [
    "bg-surface/75",
    "border border-white/[0.09]",
    "shadow-spatial-md",
    "[backdrop-filter:blur(40px)_saturate(1.3)]",
  ],
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, glass = "default", glowColor = "rgba(129,140,248,0.10)", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group relative rounded-2xl overflow-hidden",
          // Glass tier
          glassTiers[glass],
          // Inner rim highlight
          "before:pointer-events-none before:absolute before:inset-0",
          "before:rounded-[inherit] before:shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]",
          // Interaction
          interactive && [
            "cursor-pointer transform-gpu will-change-transform",
            "transition-all duration-250 ease-spatial",
            "hover:-translate-y-0.5 hover:shadow-spatial-md",
            "hover:border-white/[0.12]",
            "active:scale-[0.99] active:translate-y-0",
          ],
          className,
        )}
        style={
          interactive
            ? ({ "--glow-color": glowColor } as React.CSSProperties)
            : undefined
        }
        {...props}
      >
        {/* Hover glow gradient — follows group hover */}
        {interactive && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100",
              "bg-[radial-gradient(ellipse_at_top,var(--glow-color),transparent_70%)]",
              "transition-opacity duration-350 ease-spatial rounded-[inherit]",
            )}
          />
        )}
        {children}
      </div>
    );
  },
);
Card.displayName = "Card";

// ─── Card Sub-components ──────────────────────────────────────────────────────

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5 pb-0", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center p-5 pt-0 border-t border-white/[0.05] mt-4",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
