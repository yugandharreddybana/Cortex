import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** PUT /api/notifications/[id]/read — mark notification as read */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToJava(request, `/api/v1/notifications/${encodeURIComponent(id)}/read`);
}
