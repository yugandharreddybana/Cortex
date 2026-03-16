import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** PUT /api/notifications/[id]/respond?action=accept|decline */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const action = request.nextUrl.searchParams.get("action") ?? "";
  return proxyToJava(
    request,
    `/api/v1/notifications/${encodeURIComponent(id)}/respond?action=${encodeURIComponent(action)}`,
  );
}
