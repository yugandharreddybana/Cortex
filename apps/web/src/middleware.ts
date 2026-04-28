import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/welcome", "/capture"];
const SESSION_COOKIE = "cortex_session";

/**
 * Route protection middleware + per-request CSP nonce injection.
 *
 * A fresh cryptographic nonce is generated for every request and
 * forwarded as the `x-nonce` request header so that the Root Layout
 * can stamp it onto every <script> and <style> tag Next.js emits.
 * The same nonce is written into the Content-Security-Policy response
 * header, replacing the brittle hard-coded sha256 hash list.
 */
export function middleware(request: NextRequest) {
  // ── 1. Generate a per-request nonce ────────────────────────────────
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // ── 2. Build CSP ────────────────────────────────────────────────────
  const isDev = process.env.NODE_ENV === "development";

  const javaApiUrl = process.env.JAVA_API_URL ?? "http://localhost:8080";
  let apiHost = javaApiUrl;
  try {
    const u = new URL(javaApiUrl);
    const ws = u.protocol === "https:" ? `wss://${u.host}` : `ws://${u.host}`;
    apiHost = `${javaApiUrl} ${ws}`;
  } catch {
    // keep raw value
  }

  const cspHeader = [
    "default-src 'self'",
    // 'strict-dynamic' lets scripts loaded by the nonce-stamped bootstrap
    // script run without needing individual hashes.
    // In dev we also add 'unsafe-eval' so Turbopack HMR works.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "img-src 'self' data: https:",
    // Allow Google Fonts (next/font/google) + any other self-hosted font CDNs
    "font-src 'self' data: https://fonts.gstatic.com https://frontend-cdn.perplexity.ai",
    // WebSocket for HMR in dev, API backend, and app domain
    `connect-src 'self' ws://localhost:* wss://localhost:* ${apiHost} https://*.cortex.app`,
    "frame-src 'self' https://*.youtube.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  // ── 3. Clone request headers, attach nonce for layout to consume ────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const { pathname } = request.nextUrl;
  const refCode = request.nextUrl.searchParams.get("ref");

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // ── 4. Attach CSP + security headers to the response ───────────────
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // ── 5. Referral code cookie ─────────────────────────────────────────
  if (refCode) {
    response.cookies.set("cortex_referral_code", refCode, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: false,
    });
  }

  // ── 6. Route protection ─────────────────────────────────────────────
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
  if (!isProtected) return response;

  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  if (!sessionCookie?.value) {
    return redirectToLogin(request, pathname, refCode, cspHeader);
  }

  return response;
}

function redirectToLogin(
  request: NextRequest,
  pathname: string,
  refCode: string | null,
  cspHeader: string,
): NextResponse {
  const loginUrl = new URL("/login", request.url);
  const search = request.nextUrl.search;
  loginUrl.searchParams.set("returnTo", pathname + search);

  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Content-Security-Policy", cspHeader);

  if (refCode) {
    response.cookies.set("cortex_referral_code", refCode, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: false,
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/welcome/:path*",
    "/capture/:path*",
    "/capture",
    "/",
    "/signup",
    // Also run on all pages so every route gets the nonce header
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};