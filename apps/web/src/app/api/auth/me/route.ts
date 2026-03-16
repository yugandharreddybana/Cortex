import { API_BASE } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

// Handle both GET and HEAD requests (HEAD is used by extension for probe)
async function handleRequest(req: NextRequest) {
  // Check for Bearer token in Authorization header first (Chrome extension popup)
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7);
    if (bearerToken) {
      // Try to validate via Java backend user profile
      try {
        const upstream = await fetch(`${API_BASE}/api/v1/user/profile`, {
          headers: { Authorization: `Bearer ${bearerToken}` },
        });
        if (upstream.ok) {
          const user = (await upstream.json()) as {
            id: string; email: string; fullName: string | null;
            avatarUrl: string | null; tier: string; createdAt: string | null;
          };
          return NextResponse.json({ authenticated: true, user });
        }
      } catch { /* backend unavailable — fall through to JWT claims */ }

      // Fallback: validate JWT claims locally (works offline)
      try {
        const parts = bearerToken.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as {
            sub: string; exp: number; email: string; tier?: string; fullName?: string; avatarUrl?: string;
          };
          if (payload.exp * 1000 > Date.now()) {
            return NextResponse.json({
              authenticated: true,
              user: {
                id: payload.sub,
                email: payload.email,
                fullName: payload.fullName ?? null,
                avatarUrl: payload.avatarUrl ?? null,
                tier: payload.tier ?? "starter",
                createdAt: null,
              },
            });
          }
        }
      } catch { /* malformed token */ }

      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
  }

  const session = await getSession();
  const token = session.user?.token;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // First check JWT expiry locally (fast path)
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) throw new Error("malformed");

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as {
      sub: string;
      exp: number;
    };

    if (payload.exp * 1000 < Date.now()) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Try to fetch full profile from backend
  try {
    const upstream = await fetch(`${API_BASE}/api/v1/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (upstream.ok) {
      const user = (await upstream.json()) as {
        id: string;
        email: string;
        fullName: string | null;
        avatarUrl: string | null;
        tier: string;
        createdAt: string | null;
      };
      return NextResponse.json({ authenticated: true, user });
    }
    // Backend returned non-200 (e.g., 401, 503) — fall through to JWT claims fallback
  } catch {
    // Network error — fall through to JWT claims fallback
  }

  // Fall back to JWT claims (works when backend is temporarily unavailable or returning errors)
  try {
    const payloadB64 = token.split(".")[1]!;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as {
      sub: string;
      email: string;
      tier: string;
      fullName?: string;
      avatarUrl?: string;
    };

    return NextResponse.json({
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email,
        fullName: payload.fullName || null,
        avatarUrl: payload.avatarUrl || null,
        tier: payload.tier,
        createdAt: null,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function HEAD(_req: NextRequest) {
  // HEAD is used by the Chrome extension probe to check if this is the Cortex dev server.
  // Return 200 immediately — the extension only needs to know the server is alive, not auth status.
  return new NextResponse(null, {
    status: 200,
    headers: { "Content-Length": "0" },
  });
}
