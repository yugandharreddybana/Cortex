import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Omit<Config, "content"> = {
  darkMode: "class",
  theme: {
    extend: {
      // ═══════════════════════════════════════════════════════════════════════
      // Cortex Vision Pro Design System
      // Deep spatial glassmorphism · Luminous depth layers · Immersive motion
      // ═══════════════════════════════════════════════════════════════════════

      // ─── Colors ──────────────────────────────────────────────────────────
      colors: {
        // Surfaces — Deep Space palette (blue-black undertones)
        bg:        "#06060C",
        surface:   "#0E0E18",
        overlay:   "#161622",
        elevated:  "#1E1E2E",

        // Glass layers — translucent surfaces
        glass: {
          subtle:    "rgba(255,255,255,0.02)",
          DEFAULT:   "rgba(255,255,255,0.04)",
          prominent: "rgba(255,255,255,0.07)",
          solid:     "rgba(255,255,255,0.10)",
        },

        // Borders — layered translucency
        border: {
          DEFAULT: "rgba(255,255,255,0.06)",
          subtle:  "rgba(255,255,255,0.04)",
          strong:  "rgba(255,255,255,0.12)",
          focus:   "rgba(255,255,255,0.20)",
        },

        // Text hierarchy
        primary:   "#FFFFFF",
        secondary: "#A1A1AA",
        muted:     "#52525B",
        faint:     "#3F3F50",

        // Semantic
        danger:    "#F87171",
        success:   "#4ADE80",
        warning:   "#FBBF24",
        info:      "#60A5FA",

        // Brand accent — Luminous Indigo
        accent: {
          DEFAULT:  "#818CF8",
          light:    "#A5B4FC",
          deep:     "#6366F1",
          muted:    "rgba(129,140,248,0.12)",
          glow:     "rgba(129,140,248,0.35)",
          bright:   "rgba(129,140,248,0.55)",
        },

        // Secondary accent — Neon Teal
        teal: {
          DEFAULT:  "#06B6D4",
          light:    "#22D3EE",
          muted:    "rgba(6,182,212,0.12)",
          glow:     "rgba(6,182,212,0.30)",
        },

        // Premium accent — Warm Amber
        amber: {
          DEFAULT:  "#F59E0B",
          light:    "#FCD34D",
          muted:    "rgba(245,158,11,0.12)",
          glow:     "rgba(245,158,11,0.30)",
        },
      },

      // ─── Typography ─────────────────────────────────────────────────────
      fontFamily: {
        sans: ["var(--font-inter)", ...fontFamily.sans],
        mono: ["var(--font-jetbrains)", ...fontFamily.mono],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }],
        "4xl": ["2.25rem",  { lineHeight: "2.5rem",  letterSpacing: "-0.025em" }],
        "5xl": ["3rem",     { lineHeight: "1.1",     letterSpacing: "-0.03em" }],
        "6xl": ["3.75rem",  { lineHeight: "1.05",    letterSpacing: "-0.035em" }],
        "7xl": ["4.5rem",   { lineHeight: "1",       letterSpacing: "-0.04em" }],
        "8xl": ["6rem",     { lineHeight: "0.95",    letterSpacing: "-0.04em" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter:  "-0.03em",
        tight:    "-0.02em",
        normal:   "0",
        wide:     "0.06em",
        wider:    "0.1em",
        widest:   "0.15em",
      },

      // ─── Spacing & Sizing ───────────────────────────────────────────────
      spacing: {
        "4.5": "1.125rem",
        "13": "3.25rem",
        "15": "3.75rem",
        "18": "4.5rem",
        "88": "22rem",
        "100": "25rem",
        "112": "28rem",
        "128": "32rem",
      },

      // ─── Animation — Spatial motion system ──────────────────────────────
      transitionTimingFunction: {
        spatial:  "cubic-bezier(0.20, 0.90, 0.30, 1.00)",
        snappy:   "cubic-bezier(0.16, 1, 0.3, 1)",
        spring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
        elegant:  "cubic-bezier(0.4, 0.14, 0.3, 1)",
        bounce:   "cubic-bezier(0.22, 1.2, 0.36, 1)",
      },
      transitionDuration: {
        "150": "150ms",
        "200": "200ms",
        "250": "250ms",
        "350": "350ms",
        "450": "450ms",
        "600": "600ms",
      },
      keyframes: {
        // ── Entrance animations
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-down": {
          "0%":   { opacity: "0", transform: "translateY(-16px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "blur-in": {
          "0%":   { opacity: "0", filter: "blur(8px)", transform: "scale(0.96)" },
          "100%": { opacity: "1", filter: "blur(0px)", transform: "scale(1)" },
        },
        "slide-up": {
          "0%":   { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-down": {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-left": {
          "0%":   { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-right": {
          "0%":   { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "morph-in": {
          "0%":   { opacity: "0", transform: "scale(0.95) translateY(8px)", filter: "blur(4px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)", filter: "blur(0px)" },
        },

        // ── Ambient animations
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "shimmer-glass": {
          "0%":   { backgroundPosition: "-300% 0", opacity: "0.5" },
          "50%":  { opacity: "1" },
          "100%": { backgroundPosition: "300% 0", opacity: "0.5" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%":      { opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(129,140,248,0.15), 0 0 60px rgba(129,140,248,0.05)" },
          "50%":      { boxShadow: "0 0 30px rgba(129,140,248,0.30), 0 0 80px rgba(129,140,248,0.12)" },
        },
        spotlight: {
          "0%":   { opacity: "0", transform: "translate(-72%, -62%) scale(0.5)" },
          "100%": { opacity: "1", transform: "translate(-50%,-40%) scale(1)" },
        },
        "border-glow": {
          "0%, 100%": { opacity: "0.3" },
          "50%":      { opacity: "0.7" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        "float-gentle": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%":      { transform: "translateY(-4px) rotate(0.5deg)" },
          "66%":      { transform: "translateY(-6px) rotate(-0.5deg)" },
        },

        // ── Orbital / loading
        orbit: {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "spin-slow": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },

        // ── Background ambient motion
        "ambient-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%":      { transform: "translate(2%, -1%) scale(1.02)" },
          "50%":      { transform: "translate(-1%, 2%) scale(0.98)" },
          "75%":      { transform: "translate(1%, -2%) scale(1.01)" },
        },
      },
      animation: {
        // Entrances
        "fade-up":       "fade-up 0.5s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",
        "fade-down":     "fade-down 0.5s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",
        "fade-in":       "fade-in 0.35s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",
        "scale-in":      "scale-in 0.3s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",
        "blur-in":       "blur-in 0.4s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",
        "slide-up":      "slide-up 0.4s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",
        "slide-down":    "slide-down 0.4s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",
        "slide-left":    "slide-left 0.4s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",
        "slide-right":   "slide-right 0.4s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",
        "morph-in":      "morph-in 0.5s cubic-bezier(0.20, 0.90, 0.30, 1.00) both",

        // Ambient
        shimmer:         "shimmer 2.0s linear infinite",
        "shimmer-glass": "shimmer-glass 3.0s ease-in-out infinite",
        "glow-pulse":    "glow-pulse 3s ease-in-out infinite",
        "pulse-glow":    "pulse-glow 3s ease-in-out infinite",
        spotlight:       "spotlight 1.2s cubic-bezier(0.20, 0.90, 0.30, 1.00) forwards",
        "border-glow":   "border-glow 4s ease-in-out infinite",
        float:           "float 6s ease-in-out infinite",
        "float-gentle":  "float-gentle 8s ease-in-out infinite",
        orbit:           "orbit 1.2s linear infinite",
        "spin-slow":     "spin-slow 3s linear infinite",
        "ambient-drift": "ambient-drift 20s ease-in-out infinite",
      },

      // ─── Spatial Shadow System ──────────────────────────────────────────
      boxShadow: {
        // Glass surfaces
        glass:
          "0 0 0 1px rgba(255,255,255,0.05), " +
          "inset 0 1px 0 rgba(255,255,255,0.07), " +
          "0 2px 4px rgba(0,0,0,0.3), " +
          "0 8px 16px -4px rgba(0,0,0,0.4)",
        "glass-lg":
          "0 0 0 1px rgba(255,255,255,0.06), " +
          "inset 0 1px 0 rgba(255,255,255,0.08), " +
          "0 8px 20px -4px rgba(0,0,0,0.5), " +
          "0 16px 40px -8px rgba(0,0,0,0.45)",

        // Spatial depth layers (for layered UI)
        "spatial-sm":
          "0 1px 2px rgba(0,0,0,0.3), " +
          "0 2px 8px rgba(0,0,0,0.2), " +
          "inset 0 1px 0 rgba(255,255,255,0.06)",
        "spatial-md":
          "0 2px 4px rgba(0,0,0,0.3), " +
          "0 8px 24px -4px rgba(0,0,0,0.35), " +
          "0 16px 48px -12px rgba(0,0,0,0.25), " +
          "inset 0 1px 0 rgba(255,255,255,0.06)",
        "spatial-lg":
          "0 4px 8px rgba(0,0,0,0.3), " +
          "0 12px 32px -4px rgba(0,0,0,0.4), " +
          "0 24px 64px -12px rgba(0,0,0,0.35), " +
          "inset 0 1px 0 rgba(255,255,255,0.08)",
        "spatial-xl":
          "0 8px 16px rgba(0,0,0,0.3), " +
          "0 24px 48px -8px rgba(0,0,0,0.4), " +
          "0 48px 96px -24px rgba(0,0,0,0.5), " +
          "inset 0 1px 0 rgba(255,255,255,0.08)",

        // Accent glows
        glow:
          "0 0 20px rgba(129,140,248,0.20), " +
          "0 0 60px rgba(129,140,248,0.08)",
        "glow-sm":
          "0 0 8px rgba(129,140,248,0.25)",
        "glow-lg":
          "0 0 30px rgba(129,140,248,0.30), " +
          "0 0 80px rgba(129,140,248,0.12), " +
          "0 0 120px rgba(129,140,248,0.06)",
        "glow-teal":
          "0 0 20px rgba(6,182,212,0.20), " +
          "0 0 60px rgba(6,182,212,0.08)",
        "glow-amber":
          "0 0 20px rgba(245,158,11,0.20), " +
          "0 0 60px rgba(245,158,11,0.08)",
        "glow-danger":
          "0 0 20px rgba(248,113,113,0.20), " +
          "0 0 60px rgba(248,113,113,0.08)",

        // Inner rim highlight
        inner:
          "inset 0 1px 0 rgba(255,255,255,0.06), " +
          "inset 0 -1px 0 rgba(0,0,0,0.3)",
        "inner-glow":
          "inset 0 0 20px rgba(129,140,248,0.08), " +
          "inset 0 1px 0 rgba(255,255,255,0.08)",
      },

      // ─── Border radius ───────────────────────────────────────────────────
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
        "6xl": "3rem",
      },

      // ─── Backdrop blur tiers ────────────────────────────────────────────
      backdropBlur: {
        xs:   "2px",
        sm:   "4px",
        md:   "12px",
        lg:   "24px",
        xl:   "40px",
        "2xl": "64px",
        "3xl": "100px",
      },

      // ─── Background images ──────────────────────────────────────────────
      backgroundImage: {
        "gradient-radial":  "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":   "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",

        // Glass shimmer
        "shimmer-gradient":
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%, transparent 100%)",
        "shimmer-glass":
          "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.02) 30%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 70%, transparent 100%)",

        // Brand gradients
        "accent-gradient":
          "linear-gradient(135deg, #6366F1 0%, #818CF8 40%, #06B6D4 100%)",
        "accent-gradient-subtle":
          "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.10) 40%, rgba(6,182,212,0.08) 100%)",

        // Ambient backgrounds
        "hero-gradient":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(129,140,248,0.18) 0%, transparent 70%)",
        "mesh-gradient":
          "radial-gradient(ellipse at 20% 50%, rgba(129,140,248,0.08) 0%, transparent 50%), " +
          "radial-gradient(ellipse at 80% 20%, rgba(6,182,212,0.06) 0%, transparent 50%), " +
          "radial-gradient(ellipse at 60% 80%, rgba(129,140,248,0.04) 0%, transparent 50%)",
        "ambient-light":
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(129,140,248,0.08) 0%, transparent 70%)",
        "ambient-glow":
          "radial-gradient(circle at 50% 50%, rgba(129,140,248,0.12) 0%, transparent 60%)",

        // Surface gradients
        "surface-gradient":
          "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)",
        "surface-radial":
          "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%)",
      },

      // ─── Z-index layers ─────────────────────────────────────────────────
      zIndex: {
        "dropdown": "100",
        "sticky":   "200",
        "overlay":  "300",
        "modal":    "400",
        "popover":  "500",
        "toast":    "600",
        "tooltip":  "700",
        "max":      "999",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
