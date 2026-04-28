import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { API_BASE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.user?.token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: unknown = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const response = await fetch(`${API_BASE}/api/v1/stripe/portal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.user.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (err?.message?.includes("SECRET_COOKIE_PASSWORD")) {
      return NextResponse.json(
        { error: "Server session configuration missing" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: err.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}
