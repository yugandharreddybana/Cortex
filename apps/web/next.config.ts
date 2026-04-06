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
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.JAVA_API_URL ?? "http://localhost:8080"}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:8080 ws://localhost:8080 https://*.cortex.app; frame-src 'self' https://*.youtube.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
