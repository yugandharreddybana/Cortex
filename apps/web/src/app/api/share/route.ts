import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  return proxyToJava(request, "/api/v1/share");
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  if (action === "resource") {
    // Fetch a specific resource for the collaboration workspace
    const resourceId = request.nextUrl.searchParams.get("resourceId") ?? "";
    const type = request.nextUrl.searchParams.get("type") ?? "HIGHLIGHT";
    return proxyToJava(
      request,
      `/api/v1/share/resource?resourceId=${resourceId}&type=${type}`,
      { method: "GET" },
    );
  }

  return proxyToJava(request, "/api/v1/share/shared-with-me");
}
