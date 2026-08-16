// PRJ01_V-WS05-WI022-S03 authenticated Explorer Suggested Waypoint detail.
//
// The route accepts one opaque suggestion selector, derives the Explorer actor
// from authenticated request state, and returns only immutable delivered
// content plus Explorer-private engagement state.

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  noopCookieSetAll,
  type RequestCookieAccessor,
} from "@/lib/solmind/auth/requestCookieAccessor";
import {
  SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED,
  SUGGESTED_WAYPOINT_EXPLORER_DETAIL_FAILED,
  parseSuggestedWaypointExplorerDetailBrowserResult,
  type SuggestedWaypointExplorerDetail,
} from "@/lib/solmind/suggestedWaypointExplorerDetailBrowserContract";
import { isSuggestedWaypointExplorerId } from "@/lib/solmind/suggestedWaypointExplorerListBrowserContract";
import { createSuggestedWaypointRequestDependencies } from "@/lib/solmind/supabase/suggestedWaypointRequestDependencies";
import {
  SUGGESTED_WAYPOINT_REQUEST_DENIED,
  resolveSuggestedWaypointRequest,
  type SuggestedWaypointRequestResult,
} from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";

export const dynamic = "force-dynamic";

type RouteContext = Readonly<{
  params: Promise<Readonly<{ suggestedWaypointId: string }>>;
}>;

type PublicResult =
  | Readonly<{ ok: true; data: SuggestedWaypointExplorerDetail; error: null }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED
        | typeof SUGGESTED_WAYPOINT_EXPLORER_DETAIL_FAILED;
    }>;

function denied(): PublicResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED,
  });
}

function failed(): PublicResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_EXPLORER_DETAIL_FAILED,
  });
}

function projectSuccess(result: SuggestedWaypointRequestResult): PublicResult {
  if (!result.ok) {
    return result.error === SUGGESTED_WAYPOINT_REQUEST_DENIED ? denied() : failed();
  }
  const projected = parseSuggestedWaypointExplorerDetailBrowserResult({
    ok: true,
    data: result.data,
    error: null,
  });
  return projected?.ok ? projected : failed();
}

function json(result: PublicResult): Response {
  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  if ([...request.nextUrl.searchParams.keys()].length > 0) {
    return json(denied());
  }

  let suggestedWaypointId: string;
  try {
    suggestedWaypointId = (await context.params).suggestedWaypointId;
  } catch {
    return json(denied());
  }
  if (!isSuggestedWaypointExplorerId(suggestedWaypointId)) {
    return json(denied());
  }

  try {
    const cookieStore = await cookies();
    const requestCookies: RequestCookieAccessor = {
      getAll: () =>
        cookieStore
          .getAll()
          .map((cookie) => ({ name: cookie.name, value: cookie.value })),
      setAll: noopCookieSetAll,
    };
    const dependencies = createSuggestedWaypointRequestDependencies({
      cookies: requestCookies,
    });
    const result = await resolveSuggestedWaypointRequest(dependencies, {
      kind: "explorer.get",
      suggestedWaypointId,
    });
    return json(projectSuccess(result));
  } catch {
    return json(failed());
  }
}
