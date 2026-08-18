// PRJ01_V-WS05-WI022-S03 relationship-scoped Guide Suggested Waypoint list.
//
// This read-only Route Handler accepts only a validated relationship selector
// and opaque pagination. Request auth derives the actor and rechecks the active
// Guide relationship before the closed RPC executes. The response is projected
// again to the exact Guide-safe list shape and contains no Explorer-private
// engagement, conversation, Waypoint, or inference data.

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  noopCookieSetAll,
  type RequestCookieAccessor,
} from "@/lib/solmind/auth/requestCookieAccessor";
import {
  SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
  SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED,
  parseSuggestedWaypointGuideListBrowserResult,
  type SuggestedWaypointGuideListPage,
} from "@/lib/solmind/suggestedWaypointGuideListBrowserContract";
import {
  SUGGESTED_WAYPOINT_REFRESH_REQUIRED,
  parseSuggestedWaypointPaginationSearchParams,
} from "@/lib/solmind/suggestedWaypointPaginationSharedContract";
import { isSuggestedWaypointRelationshipId } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";
import { createSuggestedWaypointRequestDependencies } from "@/lib/solmind/supabase/suggestedWaypointRequestDependencies";
import {
  SUGGESTED_WAYPOINT_REQUEST_DENIED,
  SUGGESTED_WAYPOINT_REQUEST_REFRESH_REQUIRED,
  resolveSuggestedWaypointRequest,
  type SuggestedWaypointRequestResult,
} from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";

export const dynamic = "force-dynamic";

type RouteContext = Readonly<{
  params: Promise<Readonly<{ relationshipId: string }>>;
}>;

type PublicResult =
  | Readonly<{
      ok: true;
      data: SuggestedWaypointGuideListPage;
      error: null;
    }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED
        | typeof SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED
        | typeof SUGGESTED_WAYPOINT_REFRESH_REQUIRED;
    }>;

function denied(): PublicResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
  });
}

function failed(): PublicResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED,
  });
}

function parsePagination(request: NextRequest) {
  return parseSuggestedWaypointPaginationSearchParams(
    request.nextUrl.searchParams,
  );
}

function projectSuccess(result: SuggestedWaypointRequestResult): PublicResult {
  if (!result.ok) {
    if (result.error === SUGGESTED_WAYPOINT_REQUEST_DENIED) {
      return denied();
    }
    return result.error === SUGGESTED_WAYPOINT_REQUEST_REFRESH_REQUIRED
      ? Object.freeze({
          ok: false,
          data: null,
          error: SUGGESTED_WAYPOINT_REFRESH_REQUIRED,
        })
      : failed();
  }

  const projected = parseSuggestedWaypointGuideListBrowserResult({
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
  const pagination = parsePagination(request);
  let relationshipId: string;
  try {
    relationshipId = (await context.params).relationshipId;
  } catch {
    return json(denied());
  }
  if (
    pagination === null ||
    !isSuggestedWaypointRelationshipId(relationshipId)
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
      kind: "guide.list",
      relationshipId,
      pageSize: pagination.pageSize,
      cursor: pagination.cursor,
    });
    return json(projectSuccess(result));
  } catch {
    return json(failed());
  }
}
