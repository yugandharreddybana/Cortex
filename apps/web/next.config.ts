import type { NextConfig } from "next";

const javaApiUrl = process.env.JAVA_API_URL ?? "http://localhost:8080";

// Build CSP connect-src to include the real API host
const apiHost = (() => {
  try {
    const u = new URL(javaApiUrl);
    const ws = u.protocol === "https:" ? `wss://${u.host}` : `ws://${u.host}`;
    return `${javaApiUrl} ${ws}`;
  } catch {
    return javaApiUrl;
  }
})();

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
  // NOTE: no /api/:path* rewrite. All /api/* requests are handled by Next.js
  // route handlers under apps/web/src/app/api (including the catch-all
  // [...path]/route.ts), which proxy to the Java backend with a Bearer token
  // derived from the iron-session cookie. A plain rewrite can't do that.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss: ${apiHost} https://*.cortex.app; frame-src 'self' https://*.youtube.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;`,
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
