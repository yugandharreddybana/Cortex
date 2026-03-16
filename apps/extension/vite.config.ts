import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

/**
 * Chrome Extension Vite config.
 *
 * Manifest V3 content scripts run as **classic scripts** — they CANNOT
 * use ES module `import` statements.  We therefore need the content
 * entry to be emitted as a self-contained IIFE with every dependency
 * (React, Framer-Motion, …) inlined.
 *
 * The popup is an extension page loaded via popup.html which supports
 * `<script type="module">`, so it can use normal ESM output.
 *
 * The background service worker declares `"type": "module"` in the
 * manifest, but has no heavy deps so Rollup already emits it standalone.
 *
 * Strategy: set the VITE_EXT_TARGET env var to build each entry
 * separately.  The npm `build` script orchestrates three invocations.
 */
const target = process.env.VITE_EXT_TARGET as
  | "content"
  | "background"
  | "popup"
  | undefined;

const outDir = process.env.VITE_EXT_OUTDIR || "dist";

function contentConfig(): UserConfig {
  return {
    plugins: [react()],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      target: "esnext",
      outDir,
      emptyOutDir: false,
      // IIFE — no import/export, fully self-contained
      lib: {
        entry:    resolve(__dirname, "src/content/index.tsx"),
        name:     "CortexContent",
        formats:  ["iife"],
        fileName: () => "content.js",
      },
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
    },
  };
}

function backgroundConfig(): UserConfig {
  return {
    plugins: [],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    build: {
      target: "esnext",
      outDir,
      emptyOutDir: false,
      lib: {
        entry:    resolve(__dirname, "src/background/index.ts"),
        name:     "CortexBackground",
        formats:  ["es"],
        fileName: () => "background.js",
      },
    },
  };
}

function youtubeConfig(): UserConfig {
  return {
    plugins: [],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      target: "esnext",
      outDir,
      emptyOutDir: false,
      lib: {
        entry:    resolve(__dirname, "src/youtube.ts"),
        name:     "CortexYouTube",
        formats:  ["iife"],
        fileName: () => "youtube.js",
      },
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
    },
  };
}

function popupConfig(): UserConfig {
  return {
    plugins: [react()],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      target: "esnext",
      outDir,
      emptyOutDir: false,
      rollupOptions: {
        input: { popup: resolve(__dirname, "src/popup/main.tsx") },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  };
}

const configs: Record<string, () => UserConfig> = {
  content:    contentConfig,
  youtube:    youtubeConfig,
  background: backgroundConfig,
  popup:      popupConfig,
};

export default defineConfig(
  target && configs[target] ? configs[target]() : popupConfig(),
);
