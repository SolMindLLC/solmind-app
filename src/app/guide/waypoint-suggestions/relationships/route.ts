// PRJ01_V-WS05-WI022-S03 first browser-reachable Guide entry seam.
//
// This read-only Route Handler exposes only the feature-specific Suggested
// Waypoint relationship selector. The browser controls validated pagination;
// request auth and the database derive and recheck Guide authority. The route
// does not expose the canonical Guide Explorer roster and returns no onboarding,
// appointment, Shared Snapshot, Practice, suggestion-count, contact, or private
// Explorer data.

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  noopCookieSetAll,
  type RequestCookieAccessor,
} from "@/lib/solmind/auth/requestCookieAccessor";
import { createSuggestedWaypointRequestDependencies } from "@/lib/solmind/supabase/suggestedWaypointRequestDependencies";
import {
  SUGGESTED_WAYPOINT_REFRESH_REQUIRED,
  parseSuggestedWaypointPaginationSearchParams,
} from "@/lib/solmind/suggestedWaypointPaginationSharedContract";
import type { SuggestedWaypointRelationshipBrowserPage } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";
import {
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED,
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED,
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_REFRESH_REQUIRED,
  resolveSuggestedWaypointRelationshipSelectorRequest,
  type SuggestedWaypointRelationshipSelectorRequestResult,
  validateSuggestedWaypointRelationshipSelectorClientRequest,
} from "@/lib/solmind/supabase/suggestedWaypointRelationshipSelectorRequest";

export const dynamic = "force-dynamic";

type PublicResult =
  | Readonly<{
      ok: true;
      data: SuggestedWaypointRelationshipBrowserPage;
      error: null;
    }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED
        | typeof SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED
        | typeof SUGGESTED_WAYPOINT_REFRESH_REQUIRED;
    }>;

function denied(): SuggestedWaypointRelationshipSelectorRequestResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED,
  });
}

function failed(): SuggestedWaypointRelationshipSelectorRequestResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED,
  });
}

function parsePagination(request: NextRequest) {
  const parsed = parseSuggestedWaypointPaginationSearchParams(
    request.nextUrl.searchParams,
  );
  return parsed === null
    ? null
    : validateSuggestedWaypointRelationshipSelectorClientRequest(parsed);
}

function projectResult(
  result: SuggestedWaypointRelationshipSelectorRequestResult,
): PublicResult {
  if (result.ok) {
    return Object.freeze({
      ok: true,
      data: Object.freeze({
        items: Object.freeze(
          result.data.items.map((item) =>
            Object.freeze({
              guide_explorer_relationship_id:
                item.guide_explorer_relationship_id,
              explorer_display_name: item.explorer_display_name,
              relationship_created_at: item.relationship_created_at,
            }),
          ),
        ),
        next_cursor: result.data.next_cursor,
        total_count: result.data.total_count,
      }),
      error: null,
    });
  }
  if (
    result.error ===
    SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_REFRESH_REQUIRED
  ) {
    return Object.freeze({
      ok: false,
      data: null,
      error: SUGGESTED_WAYPOINT_REFRESH_REQUIRED,
    });
  }
  return result.error === SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED
    ? Object.freeze({
        ok: false,
        data: null,
        error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED,
      })
    : Object.freeze({
        ok: false,
        data: null,
        error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED,
      });
}

function json(
  result: SuggestedWaypointRelationshipSelectorRequestResult,
): Response {
  return NextResponse.json(projectResult(result), {
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
    const result = await resolveSuggestedWaypointRelationshipSelectorRequest(
      {
        principalSource: dependencies.principalSource,
        authSource: dependencies.authSource,
        executor: dependencies.relationshipSelectorExecutor,
      },
      pagination,
    );
    return json(result);
  } catch {
    return json(failed());
  }
}
