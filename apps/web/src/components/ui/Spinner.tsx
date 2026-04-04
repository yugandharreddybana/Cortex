import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  variant?: "accent" | "white" | "muted";
}

const sizes = {
  xs: "w-3 h-3 border-[1.5px]",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-10 h-10 border-[3px]",
};

const variants = {
  accent: "border-accent/20 border-t-accent",
  white: "border-white/10 border-t-white/80",
  muted: "border-white/5 border-t-white/20",
};

export function Spinner({ size = "sm", className, variant = "accent" }: SpinnerProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        className={cn(
          "rounded-full border-solid",
          sizes[size],
          variants[variant]
        )}
      />
    </div>
  );
}
