import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** GET /api/permissions/access-level?resourceId=x&type=HIGHLIGHT|FOLDER */
export async function GET(request: NextRequest) {
  const resourceId = request.nextUrl.searchParams.get("resourceId") ?? "";
  const type = request.nextUrl.searchParams.get("type") ?? "HIGHLIGHT";
  return proxyToJava(
    request,
    `/api/v1/permissions/access-level?resourceId=${resourceId}&type=${type}`,
    { method: "GET" },
  );
}
