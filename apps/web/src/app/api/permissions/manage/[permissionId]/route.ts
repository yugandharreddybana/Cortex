import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/** PUT /api/permissions/manage/[permissionId] — update access level */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ permissionId: string }> },
) {
  const { permissionId } = await params;
  return proxyToJava(request, `/api/v1/permissions/${permissionId}`);
}

/** DELETE /api/permissions/manage/[permissionId] — revoke permission */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ permissionId: string }> },
) {
  const { permissionId } = await params;
  return proxyToJava(request, `/api/v1/permissions/${permissionId}`, {
    method: "DELETE",
  });
}
