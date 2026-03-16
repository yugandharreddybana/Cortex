import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** POST /api/permissions — grant permission (proxy to Java) */
export async function POST(request: NextRequest) {
  return proxyToJava(request, "/api/v1/permissions");
}
