import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  return proxyToJava(request, "/api/v1/ai/connect-dots");
}
