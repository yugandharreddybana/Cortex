import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/**
 * Universal API Proxy Catch-all.
 * Handles all requests that don't have a specific route.ts file (e.g. /api/auth or /api/stripe).
 * Automatically rewrites /api/XYZ to /api/v1/XYZ for compatibility with the Java backend.
 */

function rewritePath(path: string): string {
  if (path.startsWith("/api/") && !path.startsWith("/api/v1/")) {
    return path.replace("/api/", "/api/v1/");
  }
  return path;
}

export async function GET(request: NextRequest) {
  return proxyToJava(request, rewritePath(request.nextUrl.pathname));
}

export async function POST(request: NextRequest) {
  return proxyToJava(request, rewritePath(request.nextUrl.pathname));
}

export async function PUT(request: NextRequest) {
  return proxyToJava(request, rewritePath(request.nextUrl.pathname));
}

export async function DELETE(request: NextRequest) {
  return proxyToJava(request, rewritePath(request.nextUrl.pathname));
}

export async function PATCH(request: NextRequest) {
  return proxyToJava(request, rewritePath(request.nextUrl.pathname));
}
