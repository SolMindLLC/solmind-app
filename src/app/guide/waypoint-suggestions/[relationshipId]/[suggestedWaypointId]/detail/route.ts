// PRJ01_V-WS05-WI022-S03 relationship-scoped Guide Suggested Waypoint detail.
//
// This read-only Route Handler accepts only two opaque selectors. Request auth
// derives the actor and rechecks the active Guide relationship before the
// closed RPC executes. The exact Guide projection excludes Explorer-private
// read/open activity, Waypoints, conversation, evidence, and inference data.

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  noopCookieSetAll,
  type RequestCookieAccessor,
} from "@/lib/solmind/auth/requestCookieAccessor";
import {
  SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED,
  SUGGESTED_WAYPOINT_GUIDE_DETAIL_FAILED,
  parseSuggestedWaypointGuideDetailBrowserResult,
  type SuggestedWaypointGuideDetail,
} from "@/lib/solmind/suggestedWaypointGuideDetailBrowserContract";
import { isSuggestedWaypointId } from "@/lib/solmind/suggestedWaypointGuideListBrowserContract";
import { isSuggestedWaypointRelationshipId } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";
import { createSuggestedWaypointRequestDependencies } from "@/lib/solmind/supabase/suggestedWaypointRequestDependencies";
import {
  SUGGESTED_WAYPOINT_REQUEST_DENIED,
  resolveSuggestedWaypointRequest,
  type SuggestedWaypointRequestResult,
} from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";

export const dynamic = "force-dynamic";

type RouteContext = Readonly<{
  params: Promise<
    Readonly<{ relationshipId: string; suggestedWaypointId: string }>
  >;
}>;

type PublicResult =
  | Readonly<{ ok: true; data: SuggestedWaypointGuideDetail; error: null }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED
        | typeof SUGGESTED_WAYPOINT_GUIDE_DETAIL_FAILED;
    }>;

function denied(): PublicResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED,
  });
}

function failed(): PublicResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_GUIDE_DETAIL_FAILED,
  });
}

function projectSuccess(result: SuggestedWaypointRequestResult): PublicResult {
  if (!result.ok) {
    return result.error === SUGGESTED_WAYPOINT_REQUEST_DENIED ? denied() : failed();
  }
  const projected = parseSuggestedWaypointGuideDetailBrowserResult({
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

  let relationshipId: string;
  let suggestedWaypointId: string;
  try {
    ({ relationshipId, suggestedWaypointId } = await context.params);
  } catch {
    return json(denied());
  }
  if (
    !isSuggestedWaypointRelationshipId(relationshipId) ||
    !isSuggestedWaypointId(suggestedWaypointId)
  ) {
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
      kind: "guide.get",
      relationshipId,
      suggestedWaypointId,
    });
    return json(projectSuccess(result));
  } catch {
    return json(failed());
  }
}
