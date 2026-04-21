import { NextRequest } from "next/server";
import { proxyToJava } from "@/lib/proxy";

/**
 * Catch-all BFF proxy: forwards any /api/<path> that doesn't have a dedicated
 * handler (auth, og, stripe) to the Java backend at /api/v1/<path>, injecting
 * the Bearer token from the iron-session cookie (or Authorization header).
 */
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const suffix = (path ?? []).join("/");
  const search = req.nextUrl.search ?? "";
  return proxyToJava(req, `/api/v1/${suffix}${search}`);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;

export const dynamic = "force-dynamic";
