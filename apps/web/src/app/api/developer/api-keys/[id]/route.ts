import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** DELETE /api/developer/api-keys/[id] — revoke an API key */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToJava(request, `/api/v1/developer/api-keys/${encodeURIComponent(id)}`);
}
