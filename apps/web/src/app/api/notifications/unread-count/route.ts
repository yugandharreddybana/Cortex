import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** GET /api/notifications/unread-count */
export async function GET(request: NextRequest) {
  return proxyToJava(request, "/api/v1/notifications/unread-count");
}
