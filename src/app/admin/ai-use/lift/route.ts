// Lift pause (minimal Admin screens, decision queue 2026-11-03 11:56:14), in
// the Guide command order: no query, trusted origin, same-origin JSON, exact
// body, raw cookies, the fixed Admin guard, the existing lift, a value-free
// outcome, no-store. Recorded as Paul's lift (a system change on Paul's word).

import { type NextRequest, NextResponse } from "next/server";

import {
  adminCommandResult,
  parseAdminLiftPauseBody,
  type AdminLiftPauseResult,
} from "@/lib/solmind/adminWorkspaceContract";
import { liftAdminPause } from "@/lib/solmind/auth/adminWorkspaceAccess";
import { noopCookieSetAll } from "@/lib/solmind/auth/requestCookieAccessor";
import { readRawRequestCookies } from "@/lib/solmind/auth/readRawRequestCookies";
import { readSameOriginJsonWriteRequest } from "@/lib/solmind/auth/sameOriginJsonWriteRequest";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(result: AdminLiftPauseResult): Response {
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  if ([...request.nextUrl.searchParams.keys()].length > 0) return json(adminCommandResult("denied"));
  let trustedOrigin: string;
  try {
    trustedOrigin = loadTrustedApplicationOrigin();
  } catch {
    return json(adminCommandResult("failed"));
  }
  const guarded = await readSameOriginJsonWriteRequest({ request, trustedOrigin });
  if (!guarded.ok) return json(adminCommandResult("denied"));
  const body = parseAdminLiftPauseBody(guarded.value);
  if (body === null) return json(adminCommandResult("denied"));
  try {
    const snapshot = readRawRequestCookies(request.headers.get("cookie"));
    if (snapshot === null) return json(adminCommandResult("denied"));
    return json(await liftAdminPause({
      cookies: { getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll },
      body,
    }));
  } catch {
    return json(adminCommandResult("failed"));
  }
}
