import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/**
 * POST /api/folders/[id]/duplicate
 * Proxies to Java: POST /api/v1/folders/{id}/duplicate
 *
 * Deep-clones the folder tree and assigns it to the caller as a new private
 * workspace copy, then revokes the caller's access to the original shared folder.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToJava(request, `/api/v1/folders/${encodeURIComponent(id)}/duplicate`);
}


