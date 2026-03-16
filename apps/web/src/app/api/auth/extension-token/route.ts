import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  const sessionToken = session.user?.token;

  if (!sessionToken) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  // Ask the Java backend to issue a short-lived extension token
  const upstream = await fetch(`${API_BASE}/api/v1/extension-token`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${sessionToken}`,
    },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { success: false, error: "Failed to generate extension token" },
      { status: upstream.status },
    );
  }

  const data = await upstream.json() as { token: string };

  return NextResponse.json({ success: true, token: data.token });
}
