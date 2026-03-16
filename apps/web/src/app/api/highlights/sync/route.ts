import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

export async function PUT(request: NextRequest) {
  return proxyToJava(request, "/api/v1/highlights/sync");
}
