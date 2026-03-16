"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Enable the inner-gradient hover accent */
  interactive?: boolean;
  /** Glow colour on hover (CSS colour, default accent) */
  glowColor?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, glowColor = "rgba(108,99,255,0.12)", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl bg-surface overflow-hidden",
          // Multi-layer border + depth
          "border border-white/[0.08]",
          "shadow-glass",
          // Glass rim highlight
          "before:pointer-events-none before:absolute before:inset-0",
          "before:rounded-[inherit] before:shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]",
          // Interaction
          interactive && [
            "cursor-pointer transform-gpu will-change-transform",
            "transition-all duration-350 ease-snappy",
            "hover:-translate-y-0.5 hover:shadow-glass-lg",
            "active:scale-[0.99] active:translate-y-0",
          ],
          className,
        )}
        style={
          interactive
            ? ({
                "--glow-color": glowColor,
              } as React.CSSProperties)
            : undefined
        }
        {...props}
      >
        {/* Inner gradient accent on hover */}
        {interactive && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100",
              "bg-gradient-to-br from-[var(--glow-color)] to-transparent",
              "transition-opacity duration-350 ease-snappy rounded-[inherit]",
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
      "flex items-center p-5 pt-0 border-t border-white/[0.06] mt-4",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
