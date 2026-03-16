import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection middleware.
 *
 * Protected routes require an active session cookie.  If the cookie is absent
 * the visitor is redirected to /login?returnTo=<original-path> so they land
 * back where they wanted after authenticating.
 *
 * Using a simple cookie-presence check (instead of decrypting the iron-session
 * payload) keeps this middleware in the lightweight Edge runtime without any
 * Node.js-only crypto dependencies.  The real authorization gate is the Spring
 * Boot API — every proxied request must carry a valid Bearer JWT, so a forged
 * cookie still cannot access protected data.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/welcome"];
const SESSION_COOKIE = "cortex_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  if (!isProtected) return NextResponse.next();

  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  const search   = request.nextUrl.search;
  loginUrl.searchParams.set("returnTo", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/welcome/:path*"],
};
