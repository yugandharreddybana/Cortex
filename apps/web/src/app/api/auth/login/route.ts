import { loginSchema, API_BASE } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    console.log('[API][LOGIN] Incoming request', req.method, req.url);
    const body = await req.json();
    console.log('[API][LOGIN] Request body:', body);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      console.warn('[API][LOGIN] Validation failed:', parsed.error);
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    console.log('[API][LOGIN] Forwarding to backend:', `${API_BASE}/api/v1/auth/login`);
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
    console.log('[API][LOGIN] Upstream response status:', upstream.status);

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

    const data = (await upstream.json()) as { token: string; user: { id: string; email: string; tier: string } };
    console.log('[API][LOGIN] Upstream response data:', data);

    session.user = {
      token: data.token,
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
