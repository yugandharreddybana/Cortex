import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const token = session.user?.token;

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) throw new Error("malformed");

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    ) as { exp: number };

    const nowSec = Math.floor(Date.now() / 1000);
    const remainingSec = payload.exp - nowSec;

    if (remainingSec <= 0) {
      return NextResponse.json({ valid: false, expired: true }, { status: 401 });
    }

    return NextResponse.json({ valid: true, expiresIn: remainingSec });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
