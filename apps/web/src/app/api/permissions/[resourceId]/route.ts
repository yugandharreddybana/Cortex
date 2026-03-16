import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** GET /api/permissions/[resourceId]?type=HIGHLIGHT|FOLDER — list permissions */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const { resourceId } = await params;
  const type = request.nextUrl.searchParams.get("type") ?? "HIGHLIGHT";
  return proxyToJava(request, `/api/v1/permissions/${resourceId}?type=${type}`, {
    method: "GET",
  });
}
