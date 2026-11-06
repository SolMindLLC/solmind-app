import type { NextRequest } from "next/server";
import { agreeExplorerEarlyTestNotice, isExplorerEarlyTestNoticeEnabled } from "@/lib/solmind/auth/explorerEarlyTestNoticeAccess";
import { readSameOriginJsonWriteRequest } from "@/lib/solmind/auth/sameOriginJsonWriteRequest";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";
import type { ExplorerEarlyTestNoticeResult } from "@/lib/solmind/explorerEarlyTestNotice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const denied = () => Response.json({ status: "denied", noticeVersion: null }, { headers });

export async function POST(request: NextRequest): Promise<Response> {
  if (!isExplorerEarlyTestNoticeEnabled()) return denied();
  if (request.nextUrl.search) return denied();
  try {
    const guarded = await readSameOriginJsonWriteRequest({ request, trustedOrigin: loadTrustedApplicationOrigin() });
    if (!guarded.ok || typeof guarded.value !== "object" || guarded.value === null || Array.isArray(guarded.value)) return denied();
    const value = guarded.value as Record<string, unknown>;
    const keys = Object.keys(value);
    if (keys.length !== 2 || !keys.includes("noticeVersion") || !keys.includes("adultAffirmation")) return denied();
    const result = await agreeExplorerEarlyTestNotice(request.headers.get("cookie"), value.noticeVersion, value.adultAffirmation);
    return Response.json(result, { headers });
  } catch {
    const result: ExplorerEarlyTestNoticeResult = { status: "unavailable", noticeVersion: null };
    return Response.json(result, { headers });
  }
}
