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

/**
 * FIX (CSP): Removed 'unsafe-eval' and 'unsafe-inline' from script-src.
 * These directives allowed arbitrary script execution and are a significant XSS vector.
 *
 * NOTE: If you use libraries that require eval() (e.g. certain Framer Motion features
 * or older webpack configs), you must migrate them or use a nonce-based CSP via
 * middleware.ts instead of these broad allowances.
 *
 * For inline styles required by Tailwind and CSS-in-JS, 'unsafe-inline' is kept
 * only for style-src which is lower risk than script-src.
 */
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
            // FIX: removed 'unsafe-eval' and 'unsafe-inline' from script-src
            // 'unsafe-inline' is retained only in style-src (lower risk, needed by Tailwind)
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              `connect-src 'self' ws: wss: ${apiHost} https://*.cortex.app`,
              "frame-src 'self' https://*.youtube.com",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
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
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
