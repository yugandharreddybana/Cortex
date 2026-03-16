import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** PUT /api/notifications/read-all — mark all as read */
export async function PUT(request: NextRequest) {
  return proxyToJava(request, "/api/v1/notifications/read-all");
}
