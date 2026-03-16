"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

// ─── Badge ────────────────────────────────────────────────────────────────────

export type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline";

const badgeVariants: Record<BadgeVariant, string> = {
  default:
    "bg-white/[0.08] text-secondary border-white/10",
  accent:
    "bg-accent/15 text-accent border-accent/30 shadow-[0_0_8px_rgba(108,99,255,0.2)]",
  success:
    "bg-success/10 text-success border-success/25",
  warning:
    "bg-amber-400/10 text-amber-400 border-amber-400/25",
  danger:
    "bg-danger/10 text-danger border-danger/25",
  outline:
    "bg-transparent text-secondary border-white/15",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({ className, variant = "default", dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "text-2xs font-semibold uppercase tracking-widest",
        "px-2 py-0.5 rounded-full border",
        "transition-colors duration-200 ease-snappy",
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
            variant === "success" && "bg-success",
            variant === "danger"  && "bg-danger",
            variant === "accent"  && "bg-accent",
            (variant === "default" || variant === "outline" || variant === "warning") && "bg-current",
          )}
        />
      )}
      {children}
    </span>
  );
}
