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
  const refCode = request.nextUrl.searchParams.get("ref");

  let response = NextResponse.next();

  if (refCode) {
    response.cookies.set("cortex_referral_code", refCode, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false, // need to read it in signup api or client
    });
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  if (!isProtected) return response;

  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return redirectToLogin(request, pathname, refCode);
  }

  return response;
}

function redirectToLogin(request: NextRequest, pathname: string, refCode: string | null): NextResponse {
  const loginUrl = new URL("/login", request.url);
  const search   = request.nextUrl.search;
  loginUrl.searchParams.set("returnTo", pathname + search);

  const response = NextResponse.redirect(loginUrl);
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
  matcher: ["/dashboard/:path*", "/welcome/:path*", "/", "/signup"],
};
