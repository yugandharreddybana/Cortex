"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

// ─── Badge — Glass Pill ───────────────────────────────────────────────────────

export type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline"
  | "premium";

const badgeVariants: Record<BadgeVariant, string> = {
  default:
    "bg-white/[0.06] text-secondary border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  accent:
    "bg-accent/12 text-accent-light border-accent/20 shadow-[0_0_12px_rgba(129,140,248,0.15),inset_0_1px_0_rgba(129,140,248,0.10)]",
  success:
    "bg-success/10 text-success border-success/20 shadow-[inset_0_1px_0_rgba(74,222,128,0.08)]",
  warning:
    "bg-amber-400/10 text-amber-400 border-amber-400/20 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]",
  danger:
    "bg-danger/10 text-danger border-danger/20 shadow-[inset_0_1px_0_rgba(248,113,113,0.08)]",
  outline:
    "bg-transparent text-secondary border-white/[0.12]",
  premium:
    "bg-amber/10 text-amber-light border-amber/20 shadow-[0_0_12px_rgba(245,158,11,0.15),inset_0_1px_0_rgba(245,158,11,0.10)]",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  /** Subtle glow pulse animation */
  glow?: boolean;
}

export function Badge({ className, variant = "default", dot = false, glow = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "text-2xs font-semibold uppercase tracking-widest",
        "px-2.5 py-1 rounded-full border",
        "transition-all duration-200 ease-spatial",
        glow && "animate-pulse-glow",
        badgeVariants[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            variant === "success" && "bg-success shadow-[0_0_6px_rgba(74,222,128,0.5)]",
            variant === "danger"  && "bg-danger shadow-[0_0_6px_rgba(248,113,113,0.5)]",
            variant === "accent"  && "bg-accent shadow-[0_0_6px_rgba(129,140,248,0.5)]",
            variant === "premium" && "bg-amber shadow-[0_0_6px_rgba(245,158,11,0.5)]",
            (variant === "default" || variant === "outline" || variant === "warning") && "bg-current",
          )}
        />
      )}
      {children}
    </span>
  );
}
