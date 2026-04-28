import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getSession();
  } catch {
    return NextResponse.json({ success: false, error: "Server session configuration missing" }, { status: 503 });
  }
  const token = session.user?.token;

  if (!token) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Auth backend unavailable" },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json({ success: false, error: "Token refresh failed" }, { status: upstream.status });
  }

  const data = (await upstream.json()) as {
    token: string;
    user: { id: string; email: string; tier: string };
  };

  // Store new token inside iron-session (consistent with login/signup)
  session.user = { token: data.token };
  await session.save();

  return NextResponse.json({
    success: true,
    user: { email: data.user.email, tier: data.user.tier },
  });
}
