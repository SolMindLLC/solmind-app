// PRJ01_V-WS05-WI022-S03 authenticated Explorer Suggested Waypoint inbox.
//
// This read-only route derives the Explorer from authenticated request state.
// It accepts pagination only and returns delivered/current-version Explorer
// projections with private read state and deliberate acknowledgement state.

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  noopCookieSetAll,
  type RequestCookieAccessor,
} from "@/lib/solmind/auth/requestCookieAccessor";
import {
  SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED,
  SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED,
  parseSuggestedWaypointExplorerListBrowserResult,
  type SuggestedWaypointExplorerListPage,
} from "@/lib/solmind/suggestedWaypointExplorerListBrowserContract";
import {
  SUGGESTED_WAYPOINT_REFRESH_REQUIRED,
  parseSuggestedWaypointPaginationSearchParams,
} from "@/lib/solmind/suggestedWaypointPaginationSharedContract";
import { createSuggestedWaypointRequestDependencies } from "@/lib/solmind/supabase/suggestedWaypointRequestDependencies";
import {
  SUGGESTED_WAYPOINT_REQUEST_DENIED,
  SUGGESTED_WAYPOINT_REQUEST_REFRESH_REQUIRED,
  resolveSuggestedWaypointRequest,
  type SuggestedWaypointRequestResult,
} from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";

export const dynamic = "force-dynamic";

type PublicResult =
  | Readonly<{
      ok: true;
      data: SuggestedWaypointExplorerListPage;
      error: null;
    }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED
        | typeof SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED
        | typeof SUGGESTED_WAYPOINT_REFRESH_REQUIRED;
    }>;

function denied(): PublicResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED,
  });
}

function failed(): PublicResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED,
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
  const projected = parseSuggestedWaypointExplorerListBrowserResult({
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

export async function GET(request: NextRequest): Promise<Response> {
  const pagination = parsePagination(request);
  if (pagination === null) {
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
      kind: "explorer.list",
      pageSize: pagination.pageSize,
      cursor: pagination.cursor,
    });
    return json(projectSuccess(result));
  } catch {
    return json(failed());
  }
}
