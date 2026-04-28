import { loginSchema, API_BASE } from "@/lib/auth";
import { extractCookieValue } from "@/lib/cookies";
import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      console.warn('[API][LOGIN] Validation failed:', parsed.error);
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    let upstream: Response;
    try {
      upstream = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
      });
    } catch {
      console.error('[API][LOGIN] Backend unreachable');
      return NextResponse.json({ success: false, error: "Server is currently unavailable. Please try again shortly." }, { status: 503 });
    }

    if (!upstream.ok) {
      const status = upstream.status;
      const message = status === 401 ? "Invalid email or password" : "Something went wrong. Please try again.";
      let errorBody = null;
      try {
        errorBody = await upstream.text();
      } catch {}
      console.error('[API][LOGIN] Upstream error:', status, errorBody);
      return NextResponse.json({ success: false, error: message }, { status });
    }

    const data = (await upstream.json()) as { token?: string; user: { id: string; email: string; tier: string } };
    const tokenFromCookie = extractCookieValue(upstream.headers.get("set-cookie"), "cortex_session");
    const resolvedToken = data.token ?? tokenFromCookie;
    if (!resolvedToken) {
      console.error("[API][LOGIN] Missing token in upstream response body and Set-Cookie header");
      return NextResponse.json({ success: false, error: "Login succeeded but session token was missing." }, { status: 502 });
    }

    session.user = {
      token: resolvedToken,
    };
    await session.save();

    return NextResponse.json({
      success: true,
      user: { email: data.user.email, tier: data.user.tier },
    });
  } catch (err) {
    console.error('[API][LOGIN] Handler error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
