import type { NextRequest } from "next/server";
import { resolveExplorerEarlyTestNoticeStatus } from "@/lib/solmind/auth/explorerEarlyTestNoticeAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const result = request.nextUrl.search
    ? { status: "denied", noticeVersion: null }
    : await resolveExplorerEarlyTestNoticeStatus(request.headers.get("cookie"));
  return Response.json(result, { headers: {
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
