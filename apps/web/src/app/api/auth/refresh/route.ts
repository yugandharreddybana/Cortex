import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  const token = session.user?.token;

  if (!token) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const upstream = await fetch(`${API_BASE}/api/v1/refresh-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

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
