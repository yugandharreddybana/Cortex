import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

export async function GET(request: NextRequest) {
  return proxyToJava(request, "/api/v1/ai/devils-advocate");
}

export async function POST(request: NextRequest) {
  return proxyToJava(request, "/api/v1/ai/devils-advocate");
}

export async function PUT(request: NextRequest) {
  return proxyToJava(request, "/api/v1/ai/devils-advocate");
}

export async function PATCH(request: NextRequest) {
  return proxyToJava(request, "/api/v1/ai/devils-advocate");
}

export async function DELETE(request: NextRequest) {
  return proxyToJava(request, "/api/v1/ai/devils-advocate");
}
