"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/utils";

// ─── Variant Maps ─────────────────────────────────────────────────────────────

const variantStyles = {
  primary: [
    // Base fill
    "bg-accent text-white",
    // Multi-layer glass border + glow
    "shadow-[0_0_0_1px_rgba(108,99,255,0.5),inset_0_1px_0_rgba(255,255,255,0.15),0_4px_12px_rgba(108,99,255,0.35)]",
    // Hover glow amplification
    "hover:shadow-[0_0_0_1px_rgba(108,99,255,0.7),inset_0_1px_0_rgba(255,255,255,0.15),0_4px_20px_rgba(108,99,255,0.55)]",
    "hover:bg-[#7C73FF]",
  ],
  secondary: [
    "bg-surface text-primary",
    "shadow-glass",
    "hover:bg-overlay hover:shadow-glass-lg",
  ],
  ghost: [
    "bg-transparent text-secondary",
    "hover:bg-white/[0.05] hover:text-primary",
  ],
  outline: [
    "bg-transparent text-primary",
    "border border-white/10",
    "hover:bg-white/[0.04] hover:border-white/20",
  ],
  destructive: [
    "bg-danger/10 text-danger",
    "border border-danger/30",
    "hover:bg-danger/20",
  ],
} as const;

const sizeStyles = {
  xs: "h-7  px-3   text-xs   gap-1.5 rounded-lg",
  sm: "h-8  px-3.5 text-sm   gap-2   rounded-xl",
  md: "h-10 px-5   text-sm   gap-2   rounded-xl",
  lg: "h-12 px-7   text-base gap-2.5 rounded-2xl",
  xl: "h-14 px-8   text-lg   gap-3   rounded-2xl",
  icon: "h-10 w-10 rounded-xl",
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

// ─── Spinner ──────────────────────────────────────────────────────────────────

const Spinner = () => (
  <svg
    className="animate-spin h-4 w-4 text-current"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
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

      // Transition — Apple snappy easing
      "transition-all duration-250 ease-snappy",

      // Hardware-accelerated interaction states
      "transform-gpu will-change-transform",
      "active:scale-[0.97]",

      // Focus
      "focus-visible:outline-none",
      "focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",

      // Disabled
      "disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed",

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
              "bg-gradient-to-r from-transparent via-white/10 to-transparent",
              "group-hover:translate-x-full transition-transform duration-700 ease-snappy",
            )}
          />
        )}

        {/* Content */}
        {loading ? (
          <>
            <Spinner />
            <span className="opacity-60">{children}</span>
          </>
        ) : (
          children
        )}
      </motion.button>
    );
  },
);

Button.displayName = "Button";
