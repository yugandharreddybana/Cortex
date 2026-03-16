import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — Cortex's utility for merging Tailwind classes.
 * Combines clsx (conditional logic) with tailwind-merge (conflict resolution).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Map an animation delay index to a CSS custom-property stagger */
export const stagger = (i: number, base = 80): React.CSSProperties =>
  ({ "--stagger": `${i * base}ms` }) as React.CSSProperties;
