"use client";

import * as React from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@cortex/ui";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Spotlight color in CSS format, e.g. "rgba(139,92,246,0.15)" */
  spotlightColor?: string;
  /** Disable spotlight effect entirely (for touch devices) */
  disabled?: boolean;
}

export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(139,92,246,0.12)",
  disabled = false,
  ...props
}: SpotlightCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isHovered, setIsHovered] = React.useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  }

  const spotlightBg = useMotionTemplate`radial-gradient(350px circle at ${mouseX}px ${mouseY}px, ${spotlightColor}, transparent 80%)`;
  const borderGlow = useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.06), transparent 80%)`;

  return (
    <div
      className={cn(
        "group relative rounded-2xl overflow-hidden",
        "bg-white/[0.02] border border-white/[0.06]",
        "transition-all duration-500 ease-snappy",
        "hover:border-white/[0.10]",
        className,
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {/* Spotlight gradient overlay (follows cursor) */}
      {!disabled && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: spotlightBg }}
          aria-hidden
        />
      )}

      {/* Border glow effect */}
      {!disabled && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: borderGlow }}
          aria-hidden
        />
      )}

      {/* Top rim light */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent z-20"
        aria-hidden
      />

      {/* Content */}
      <motion.div
        className="relative z-20"
        whileHover={disabled ? undefined : { scale: 1.005 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
