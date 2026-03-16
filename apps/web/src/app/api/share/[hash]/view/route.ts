import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  return proxyToJava(request, `/api/v1/share/${encodeURIComponent(hash)}/view`);
}
