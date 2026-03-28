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
};

export default nextConfig;
