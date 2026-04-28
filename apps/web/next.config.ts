import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cortex/ui"],

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.cortex.app" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  experimental: {
    optimizePackageImports: ["framer-motion", "@cortex/ui"],
    staleTimes: {
      dynamic: 30,
    },
  },

  // ── Security headers are now handled entirely in src/middleware.ts ──
  // The middleware generates a per-request nonce and writes the full
  // CSP there. Keeping headers() here too would create duplicate/
  // conflicting headers.
};

export default nextConfig;