import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * GET /api/auth/ws-token
 * Returns the JWT token from the iron-session so the browser client
 * can authenticate the STOMP WebSocket connection to the Java backend.
 */
export async function GET() {
  let session;
  try {
    session = await getSession();
  } catch {
    return NextResponse.json({ error: "Server session configuration missing" }, { status: 503 });
  }
  const token = session.user?.token ?? null;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ token });
}
