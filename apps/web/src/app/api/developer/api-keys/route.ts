import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** GET /api/developer/api-keys — list all API keys for the user */
export async function GET(request: NextRequest) {
  return proxyToJava(request, "/api/v1/developer/api-keys");
}

/** POST /api/developer/api-keys — create a new API key */
export async function POST(request: NextRequest) {
  return proxyToJava(request, "/api/v1/developer/api-keys");
}
