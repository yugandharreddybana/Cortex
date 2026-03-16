import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToJava(request, `/api/v1/highlights/${encodeURIComponent(id)}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToJava(request, `/api/v1/highlights/${encodeURIComponent(id)}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToJava(request, `/api/v1/highlights/${encodeURIComponent(id)}`);
}
