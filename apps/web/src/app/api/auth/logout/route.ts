import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getSession();
  await session.destroy();
  return NextResponse.json({ success: true });
}
