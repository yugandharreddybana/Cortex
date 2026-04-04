import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  email: z.email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Mock: In production, send a real password-reset email.
  // Always return success to prevent email enumeration.
  return NextResponse.json({
    success: true,
    message: "If an account with that email exists, a reset link has been sent.",
  });
}
