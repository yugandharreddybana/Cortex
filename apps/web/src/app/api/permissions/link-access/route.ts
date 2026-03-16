import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** PUT /api/permissions/link-access — update link-level access settings */
export async function PUT(request: NextRequest) {
  return proxyToJava(request, "/api/v1/permissions/link-access");
}
