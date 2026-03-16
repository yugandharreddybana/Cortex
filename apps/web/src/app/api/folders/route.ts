import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

export async function GET(request: NextRequest) {
  return proxyToJava(request, "/api/v1/folders");
}

export async function POST(request: NextRequest) {
  return proxyToJava(request, "/api/v1/folders");
}
