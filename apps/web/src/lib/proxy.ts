import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/auth";
import { getSession } from "@/lib/session";

/**
 * Proxy helper — forwards requests from Next.js BFF to the Java backend,
 * converting the HttpOnly iron-session cookie (or an Authorization Bearer header
 * from the Chrome extension) into a Bearer token header for Java.
 */
export async function proxyToJava(
  request: NextRequest,
  path: string,
  options?: { method?: string; body?: unknown },
) {
  // Prefer iron-session JWT, fall back to Authorization header (extension sends Bearer token)
  const session = await getSession();
  const sessionToken = session.user?.token ?? null;
  const authHeaderToken = request.headers.get("Authorization")?.replace("Bearer ", "") ?? null;

  // Helper: check if a JWT is expired
  function isExpired(jwt: string): boolean {
    try {
      const parts = jwt.split(".");
      if (parts.length !== 3) return false;
      const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as { exp?: number };
      return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
    } catch { return false; }
  }

  // Pick the best available token: prefer session, but if it's expired, use Authorization header
  let token = sessionToken;
  if (!token || isExpired(token)) {
    if (authHeaderToken && !isExpired(authHeaderToken)) {
      token = authHeaderToken;
    } else if (token && isExpired(token)) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const method = options?.method ?? request.method;
  const headers: Record<string, string> = {
    "Content-Type":  "application/json",
    Authorization:   `Bearer ${token}`,
  };

  const fetchOptions: RequestInit = { method, headers };
  if (options?.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  } else if (method !== "GET" && method !== "HEAD") {
    // Forward the request body
    const body = await request.text();
    if (body) fetchOptions.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}${path}`, fetchOptions);
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 502 },
    );
  }

  const data = await upstream.text();
  return new NextResponse(data, {
    status:  upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
