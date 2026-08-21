// PRJ01_V-WS05-WI022-S03 relationship-scoped Guide command route.
//
// This is the first authenticated browser-to-command edge for Suggested
// Waypoints. It rejects URL and body authority before auth, derives identity
// and role through the existing request composition, and returns only the
// shared value-free four-field browser contract.

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  noopCookieSetAll,
  type RequestCookieAccessor,
} from "@/lib/solmind/auth/requestCookieAccessor";
import { readSameOriginJsonWriteRequest } from "@/lib/solmind/auth/sameOriginJsonWriteRequest";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";
import {
  SUGGESTED_WAYPOINT_COMMAND_DENIED,
  SUGGESTED_WAYPOINT_COMMAND_FAILED,
  type SuggestedWaypointCommandBrowserResult,
} from "@/lib/solmind/suggestedWaypointCommandBrowserContract";
import { isSuggestedWaypointRelationshipId } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";
import {
  parseSuggestedWaypointGuideCommandRouteInput,
  projectSuggestedWaypointGuideCommandResult,
} from "@/lib/solmind/supabase/suggestedWaypointGuideCommandRouteContract";
import { createSuggestedWaypointRequestDependencies } from "@/lib/solmind/supabase/suggestedWaypointRequestDependencies";
import { resolveSuggestedWaypointRequest } from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";

export const dynamic = "force-dynamic";

type RouteContext = Readonly<{
  params: Promise<Readonly<{ relationshipId: string }>>;
}>;

function failure(
  error:
    | typeof SUGGESTED_WAYPOINT_COMMAND_DENIED
    | typeof SUGGESTED_WAYPOINT_COMMAND_FAILED,
): SuggestedWaypointCommandBrowserResult {
  return Object.freeze({
    ok: false,
    outcome: null,
    suggestedWaypointId: null,
    error,
  });
}

function json(result: SuggestedWaypointCommandBrowserResult): Response {
  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  if ([...request.nextUrl.searchParams.keys()].length > 0) {
    return json(failure(SUGGESTED_WAYPOINT_COMMAND_DENIED));
  }

  let relationshipId: string;
  try {
    relationshipId = (await context.params).relationshipId;
  } catch {
    return json(failure(SUGGESTED_WAYPOINT_COMMAND_DENIED));
  }
  if (!isSuggestedWaypointRelationshipId(relationshipId)) {
    return json(failure(SUGGESTED_WAYPOINT_COMMAND_DENIED));
  }

  let trustedOrigin: string;
  try {
    trustedOrigin = loadTrustedApplicationOrigin();
  } catch {
    return json(failure(SUGGESTED_WAYPOINT_COMMAND_FAILED));
  }

  const guarded = await readSameOriginJsonWriteRequest({
    request,
    trustedOrigin,
  });
  if (!guarded.ok) {
    return json(failure(SUGGESTED_WAYPOINT_COMMAND_DENIED));
  }

  const routeInput = parseSuggestedWaypointGuideCommandRouteInput(
    guarded.value,
    relationshipId,
  );
  if (routeInput === null) {
    return json(failure(SUGGESTED_WAYPOINT_COMMAND_DENIED));
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
    const result = await resolveSuggestedWaypointRequest(
      dependencies,
      routeInput.request,
    );
    return json(projectSuggestedWaypointGuideCommandResult(routeInput, result));
  } catch {
    return json(failure(SUGGESTED_WAYPOINT_COMMAND_FAILED));
  }
}
