"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/utils";

// ─── Variant Maps ─────────────────────────────────────────────────────────────

const variantStyles = {
  primary: [
    // Luminous indigo fill with spatial glow
    "bg-accent text-white font-semibold",
    "shadow-[0_0_0_1px_rgba(99,102,241,0.5),inset_0_1px_0_rgba(255,255,255,0.15),0_2px_8px_rgba(99,102,241,0.35),0_4px_20px_-4px_rgba(99,102,241,0.30)]",
    // Hover — amplified glow bloom
    "hover:bg-accent-light",
    "hover:shadow-[0_0_0_1px_rgba(99,102,241,0.6),inset_0_1px_0_rgba(255,255,255,0.15),0_4px_16px_rgba(99,102,241,0.45),0_8px_32px_-4px_rgba(99,102,241,0.35)]",
  ],
  secondary: [
    // Glass surface
    "bg-white/[0.05] text-primary",
    "border border-white/[0.08]",
    "shadow-spatial-sm",
    "hover:bg-white/[0.08] hover:border-white/[0.12] hover:shadow-spatial-md",
  ],
  ghost: [
    "bg-transparent text-secondary",
    "hover:bg-white/[0.05] hover:text-primary",
  ],
  outline: [
    "bg-transparent text-primary",
    "border border-white/[0.10]",
    "hover:bg-white/[0.04] hover:border-white/[0.18]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  ],
  destructive: [
    "bg-danger/10 text-danger",
    "border border-danger/20",
    "hover:bg-danger/20 hover:border-danger/30",
    "hover:shadow-[0_0_20px_rgba(248,113,113,0.12)]",
  ],
} as const;

const sizeStyles = {
  xs: "h-7  px-3   text-xs   gap-1.5 rounded-lg  min-w-[44px]",
  sm: "h-9  px-3.5 text-sm   gap-2   rounded-xl  min-w-[44px]",
  md: "h-11 px-5   text-sm   gap-2   rounded-xl  min-w-[44px]",
  lg: "h-12 px-7   text-base gap-2.5 rounded-2xl min-w-[44px]",
  xl: "h-14 px-8   text-lg   gap-3   rounded-2xl min-w-[44px]",
  icon: "h-11 w-11 rounded-xl min-w-[44px]",
} as const;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof HTMLMotionProps<"button">> {
  /** Visual variant */
  variant?: keyof typeof variantStyles;
  /** Size preset */
  size?: keyof typeof sizeStyles;
  /** Use Radix Slot — composes button styles onto child element */
  asChild?: boolean;
  /** Show subtle shine sweep on hover */
  shine?: boolean;
  /** Loading state — replaces children with spinner */
  loading?: boolean;
  /** Framer Motion prop overrides */
  motionProps?: HTMLMotionProps<"button">;
  /** Button content */
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

// ─── Orbital Spinner ──────────────────────────────────────────────────────────

const OrbitalSpinner = () => (
  <div className="relative h-4 w-4 flex-shrink-0" aria-hidden="true">
    <div className="absolute inset-0 rounded-full border-2 border-current/20" />
    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-current animate-spin" />
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      asChild = false,
      shine = false,
      loading = false,
      disabled,
      children,
      motionProps,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const baseClasses = cn(
      // Layout
      "relative inline-flex items-center justify-center whitespace-nowrap select-none",
      "overflow-hidden",

      // Typography
      "font-medium antialiased",

      // Spatial transition — smooth, responsive
      "transition-all duration-200 ease-spatial",

      // Hardware-accelerated
      "transform-gpu will-change-transform",
      "active:scale-[0.97]",

      // Focus — luminous ring
      "focus-visible:outline-none",
      "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",

      // Disabled
      "disabled:opacity-35 disabled:pointer-events-none",

      // Variant + Size
      variantStyles[variant],
      sizeStyles[size],

      className,
    );

    if (asChild) {
      return (
        <Slot ref={ref} className={baseClasses} {...(props as Record<string, unknown>)}>
          {children}
        </Slot>
      );
    }

    return (
      <motion.button
        ref={ref}
        className={baseClasses}
        disabled={isDisabled}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        {...motionProps}
        {...(props as HTMLMotionProps<"button">)}
      >
        {/* Shine sweep overlay */}
        {shine && !isDisabled && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 -translate-x-full",
              "bg-gradient-to-r from-transparent via-white/[0.08] to-transparent",
              "hover:translate-x-full transition-transform duration-700 ease-spatial",
            )}
          />
        )}

        {/* Content */}
        {loading ? (
          <span className="flex items-center gap-2">
            <OrbitalSpinner />
            <span className="opacity-70">{children}</span>
          </span>
        ) : (
          children
        )}
      </motion.button>
    );
  },
);

Button.displayName = "Button";
