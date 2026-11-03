// Setting change (minimal Admin screens, decision queue 2026-11-03 11:56:14),
// in the Guide command order: no query, trusted origin, same-origin JSON, exact
// body, raw cookies, the fixed Admin guard, the existing audited writer (one
// setting per submit), a value-free outcome, no-store. Recorded as a change on
// Paul's word (a system change; accepted for these throwaway screens).

import { type NextRequest, NextResponse } from "next/server";

import {
  adminCommandResult,
  parseAdminChangeSettingBody,
  type AdminChangeSettingResult,
} from "@/lib/solmind/adminWorkspaceContract";
import { changeAdminSetting } from "@/lib/solmind/auth/adminWorkspaceAccess";
import { noopCookieSetAll } from "@/lib/solmind/auth/requestCookieAccessor";
import { readRawRequestCookies } from "@/lib/solmind/auth/readRawRequestCookies";
import { readSameOriginJsonWriteRequest } from "@/lib/solmind/auth/sameOriginJsonWriteRequest";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(result: AdminChangeSettingResult): Response {
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
  const body = parseAdminChangeSettingBody(guarded.value);
  if (body === null) return json(adminCommandResult("denied"));
  try {
    const snapshot = readRawRequestCookies(request.headers.get("cookie"));
    if (snapshot === null) return json(adminCommandResult("denied"));
    return json(await changeAdminSetting({
      cookies: { getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll },
      body,
    }));
  } catch {
    return json(adminCommandResult("failed"));
  }
}
