import { NextRequest, NextResponse } from "next/server";
import { signupSchema, API_BASE } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/v1/auth/signup`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email:    parsed.data.email,
        password: parsed.data.password,
        fullName: parsed.data.fullName,
        tier:     parsed.data.tier ?? "starter",
      }),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Server is currently unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    const status = upstream.status;
    const message = status === 409
      ? "An account already exists with that email. Try to login."
      : "Something went wrong. Please try again.";
    return NextResponse.json({ success: false, error: message, code: status === 409 ? "EMAIL_EXISTS" : undefined }, { status });
  }

  const data = await upstream.json() as { token: string; user: { id: string; email: string; tier: string } };

  // Store the JWT inside the iron-session encrypted cookie (consistent with login)
  const session = await getSession();
  session.user = { token: data.token };
  await session.save();

  return NextResponse.json({
    success: true,
    user:    { email: data.user.email, tier: data.user.tier },
  });
}
