/**
 * Premium feedback & animation utilities for Cortex
 * Provides rich, polished user feedback for all actions
 */
import { toast } from "sonner";

export type ToastType = "success" | "error" | "info" | "warning";

// ─── Premium success messages with context ──────────────────────────────────

export const premiumToast = {
  highlightCreated: () => toast.success("✨ Highlight saved to your brain!", {
    description: "You can now find it in your dashboard",
    duration: 4000,
  }),

  highlightDeleted: () => toast.success("🗑️ Highlight removed", {
    description: "It's been safely archived",
    duration: 3000,
  }),

  folderCreated: (name: string) => toast.success(`📁 "${name}" created!`, {
    description: "Ready to organize your highlights",
    duration: 3000,
  }),

  folderDeleted: (name: string) => toast.success(`📁 "${name}" removed`, {
    duration: 2500,
  }),

  tagCreated: (name: string) => toast.success(`🏷️ Tag "${name}" added!`, {
    description: "Start tagging your highlights",
    duration: 3000,
  }),

  tagDeleted: (name: string) => toast.success(`🏷️ "${name}" removed`, {
    duration: 2500,
  }),

  loginSuccess: () => toast.success("👋 Welcome back!", {
    description: "Your brain is ready to explore",
    duration: 3000,
  }),

  signupSuccess: () => toast.success("🎉 Brain created successfully!", {
    description: "Your learning journey begins now",
    duration: 3000,
  }),

  logoutSuccess: () => toast.success("👋 See you next time!", {
    duration: 2500,
  }),

  dataSynced: () => toast.success("☁️ All synced!", {
    description: "Your data is up to date",
    duration: 2000,
  }),

  extensionConnected: () => toast.success("🔗 Extension connected!", {
    description: "You can now capture highlights from anywhere",
    duration: 4000,
  }),

  // ── Errors ──

  loginFailed: (reason?: string) => toast.error("❌ Login failed", {
    description: reason ?? "Please check your email and password",
    duration: 4000,
  }),

  signupFailed: (reason?: string) => toast.error("❌ Signup failed", {
    description: reason ?? "Something went wrong. Please try again",
    duration: 4000,
  }),

  emailExists: () => toast.error("📧 Email already registered", {
    description: "Try logging in instead",
    duration: 4000,
    action: {
      label: "Go to login",
      onClick: () => window.location.href = "/login",
    },
  }),

  networkError: () => toast.error("📡 Network error", {
    description: "Check your connection and try again",
    duration: 4000,
  }),

  sessionExpired: () => toast.error("⏰ Session expired", {
    description: "Please log in again",
    duration: 4000,
  }),

  serverError: () => toast.error("🔧 Server error", {
    description: "Something went wrong. Please try again later",
    duration: 4000,
  }),

  // ── Info messages ──

  savingChanges: () => toast.loading("💾 Saving changes...", {
    duration: Infinity,
  }),

  syncingData: () => toast.loading("🔄 Syncing data...", {
    duration: Infinity,
  }),

  // ── Warning messages ──

  offlineMode: () => toast.warning("📵 You\'re offline", {
    description: "Changes will sync when you\'re back online",
    duration: Infinity,
  }),

  unsavedChanges: () => toast.warning("💾 Unsaved changes", {
    description: "Make sure to sync before closing",
    duration: 5000,
  }),
};

// ─── Animation variants for Framer Motion ─────────────────────────────────

export const PREMIUM_ANIMATIONS = {
  // ── Entrances ──
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  } as const,

  fadeInScale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  } as const,

  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  } as const,

  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  } as const,

  // ── Item animations (staggered) ──
  itemVariants: {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      },
    }),
  } as const,

  // ── Bounce effect ──
  bounce: {
    initial: { scale: 0.95 },
    animate: { scale: 1 },
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10,
    },
  } as const,

  // ── Pulse effect ──
  pulse: {
    animate: { scale: [1, 1.05, 1] },
    transition: { duration: 2, repeat: Infinity },
  } as const,

  // ── Hover effects ──
  hoverLift: {
    whileHover: { y: -2 },
    transition: { duration: 0.2 },
  } as const,

  hoverScale: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.2 },
  } as const,
};

// ─── Easing curves ─────────────────────────────────────────────────────────

export const EASING = {
  smooth: [0.16, 1, 0.3, 1] as const,
  bounce: [0.68, -0.55, 0.265, 1.55] as const,
  snappy: [0.25, 0.46, 0.45, 0.94] as const,
  elastic: [0.17, 0.67, 0.83, 0.67] as const,
} as const;

// ─── Delay computations for staggered animations ──────────────────────────

export function staggerDelay(index: number, baseDelay = 0.05): number {
  return index * baseDelay;
}

// ─── Premium notification for action feedback ────────────────────────────

export function dismissToast(toastId: string) {
  toast.dismiss(toastId);
}

export function dismissAll() {
  toast.dismiss();
}
