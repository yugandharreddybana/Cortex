// apps/web/tailwind.config.ts
// Extends the shared @cortex/config-tailwind base with web-specific content globs.
import type { Config } from "tailwindcss";
import baseConfig from "@cortex/config-tailwind";

const config: Config = {
  ...baseConfig,
  content: [
    "./src/**/*.{ts,tsx,mdx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
