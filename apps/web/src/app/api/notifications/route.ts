import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** GET /api/notifications — list all notifications */
export async function GET(request: NextRequest) {
  return proxyToJava(request, "/api/v1/notifications");
}
