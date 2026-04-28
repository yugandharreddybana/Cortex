import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getSession();
  } catch {
    return NextResponse.json(
      { success: false, error: "Server session configuration missing" },
      { status: 503 },
    );
  }
  const sessionToken = session.user?.token;

  if (!sessionToken) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  // Ask the Java backend to issue a short-lived extension token
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/v1/extension-token`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${sessionToken}`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Auth backend unavailable" },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { success: false, error: "Failed to generate extension token" },
      { status: upstream.status },
    );
  }

  const data = await upstream.json() as { token: string };

  return NextResponse.json({ success: true, token: data.token });
}
