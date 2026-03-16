import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Omit<Config, "content"> = {
  darkMode: "class",
  theme: {
    extend: {
      // ─── Cortex Design Tokens ────────────────────────────────────────────
      colors: {
        // Surfaces — Deep Obsidian palette
        bg:        "#0A0A0F",
        surface:   "#12121A",
        overlay:   "#1A1A24",

        // Borders
        border: {
          DEFAULT: "rgba(255,255,255,0.06)",
          strong:  "rgba(255,255,255,0.12)",
          focus:   "rgba(255,255,255,0.20)",
        },

        // Text
        primary:   "#FFFFFF",
        secondary: "#A1A1AA",
        muted:     "#52525B",
        danger:    "#F87171",
        success:   "#4ADE80",

        // Brand accent — Synapse Violet
        accent: {
          DEFAULT:  "#8B5CF6",
          muted:    "rgba(139,92,246,0.12)",
          glow:     "rgba(139,92,246,0.35)",
        },

        // Secondary accent — Neon Teal
        teal: {
          DEFAULT:  "#06B6D4",
          muted:    "rgba(6,182,212,0.12)",
          glow:     "rgba(6,182,212,0.30)",
        },
      },

      // ─── Typography ─────────────────────────────────────────────────────
      fontFamily: {
        sans: ["var(--font-inter)", ...fontFamily.sans],
        mono: ["var(--font-jetbrains)", ...fontFamily.mono],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter:  "-0.03em",
        tight:    "-0.02em",
        wide:     "0.06em",
        wider:    "0.1em",
        widest:   "0.15em",
      },

      // ─── Animation ──────────────────────────────────────────────────────
      // "Apple snappy" easing – used across ALL transitions
      transitionTimingFunction: {
        snappy:  "cubic-bezier(0.16, 1, 0.3, 1)",
        spring:  "cubic-bezier(0.34, 1.56, 0.64, 1)",
        elegant: "cubic-bezier(0.4, 0.14, 0.3, 1)",
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "450": "450ms",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)"    },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)"    },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition:  "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%":      { opacity: "1"   },
        },
        spotlight: {
          "0%":   { opacity: "0", transform: "translate(-72%, -62%) scale(0.5)" },
          "100%": { opacity: "1", transform: "translate(-50%,-40%) scale(1)"    },
        },
        "border-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%":      { opacity: "0.8" },
        },
        float: {
          "0%, 100%":  { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up":      "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in":      "fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in":     "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer:        "shimmer 2.0s linear infinite",
        "glow-pulse":   "glow-pulse 3s ease-in-out infinite",
        spotlight:      "spotlight 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "border-glow":  "border-glow 4s ease-in-out infinite",
        float:          "float 6s ease-in-out infinite",
      },

      // ─── Multi-layered shadows ───────────────────────────────────────────
      boxShadow: {
        glass:
          "0 0 0 1px rgba(255,255,255,0.06), " +
          "inset 0 1px 0 rgba(255,255,255,0.08), " +
          "0 4px 6px -1px rgba(0,0,0,0.5), " +
          "0 10px 15px -3px rgba(0,0,0,0.4)",
        "glass-lg":
          "0 0 0 1px rgba(255,255,255,0.06), " +
          "inset 0 1px 0 rgba(255,255,255,0.08), " +
          "0 10px 25px -5px rgba(0,0,0,0.7), " +
          "0 20px 40px -10px rgba(0,0,0,0.6)",
        glow:
          "0 0 20px rgba(139,92,246,0.20), " +
          "0 0 60px rgba(139,92,246,0.08)",
        "glow-sm":
          "0 0 8px rgba(139,92,246,0.25)",
        "glow-teal":
          "0 0 20px rgba(6,182,212,0.20), " +
          "0 0 60px rgba(6,182,212,0.08)",
        inner:
          "inset 0 1px 0 rgba(255,255,255,0.06), " +
          "inset 0 -1px 0 rgba(0,0,0,0.3)",
      },

      // ─── Border radius ───────────────────────────────────────────────────
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },

      // ─── Backdrop blur ──────────────────────────────────────────────────
      backdropBlur: {
        xs: "2px",
      },

      // ─── Background images ──────────────────────────────────────────────
      backgroundImage: {
        "gradient-radial":  "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":   "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "shimmer-gradient":
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
        "accent-gradient":
          "linear-gradient(135deg, #8B5CF6 0%, #A78BFA 50%, #06B6D4 100%)",
        "hero-gradient":
          "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(139,92,246,0.15) 0%, transparent 70%)",
        "mesh-gradient":
          "radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.08) 0%, transparent 50%), " +
          "radial-gradient(ellipse at 80% 20%, rgba(6,182,212,0.06) 0%, transparent 50%), " +
          "radial-gradient(ellipse at 60% 80%, rgba(139,92,246,0.04) 0%, transparent 50%)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
