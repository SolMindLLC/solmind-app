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
  SUGGESTED_WAYPOINT_GUIDE_LIST_PAGE_SIZES,
  parseSuggestedWaypointGuideListBrowserResult,
  type SuggestedWaypointGuideListPage,
} from "@/lib/solmind/suggestedWaypointGuideListBrowserContract";
import { isSuggestedWaypointGuideListPageSize } from "@/lib/solmind/suggestedWaypointGuideListSharedContract";
import { isSuggestedWaypointRelationshipId } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";
import { createSuggestedWaypointRequestDependencies } from "@/lib/solmind/supabase/suggestedWaypointRequestDependencies";
import {
  SUGGESTED_WAYPOINT_REQUEST_DENIED,
  resolveSuggestedWaypointRequest,
  type SuggestedWaypointRequestResult,
} from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 10 as const;
const ALLOWED_QUERY_KEYS = Object.freeze(["cursor", "pageSize"] as const);

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
        | typeof SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED;
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
  const searchParams = request.nextUrl.searchParams;
  for (const key of searchParams.keys()) {
    if (!ALLOWED_QUERY_KEYS.includes(key as (typeof ALLOWED_QUERY_KEYS)[number])) {
      return null;
    }
    if (searchParams.getAll(key).length !== 1) {
      return null;
    }
  }

  const pageSizeText = searchParams.get("pageSize");
  const pageSize =
    pageSizeText === null
      ? DEFAULT_PAGE_SIZE
      : SUGGESTED_WAYPOINT_GUIDE_LIST_PAGE_SIZES.find(
          (candidate) => String(candidate) === pageSizeText,
        );
  if (pageSize === undefined || !isSuggestedWaypointGuideListPageSize(pageSize)) {
    return null;
  }

  const cursor = searchParams.get("cursor");
  if (
    cursor !== null &&
    (cursor.length === 0 ||
      cursor.length > 512 ||
      cursor.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(cursor))
  ) {
    return null;
  }

  return Object.freeze({ pageSize, cursor });
}

function projectSuccess(result: SuggestedWaypointRequestResult): PublicResult {
  if (!result.ok) {
    return result.error === SUGGESTED_WAYPOINT_REQUEST_DENIED ? denied() : failed();
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
