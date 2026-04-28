import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await getSession();
    await session.destroy();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Server session configuration missing" }, { status: 503 });
  }
}
