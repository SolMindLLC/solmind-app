// PRJ01_V-WS05-WI022-S03 relationship-scoped Guide Suggested Waypoint list.
//
// This read-only Route Handler accepts only a validated relationship selector
// and opaque pagination. Request auth derives the actor and rechecks the active
// Guide relationship before the closed RPC executes. The response is projected
// again to the exact Guide-safe list shape and contains no Explorer-private
// engagement, conversation, Waypoint, or inference data.

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { decideGuideRelationshipAccess } from "@/lib/solmind/auth/accessBoundary";
import {
  noopCookieSetAll,
  type RequestCookieAccessor,
} from "@/lib/solmind/auth/requestCookieAccessor";
import { deriveTrustedServerAuthContext } from "@/lib/solmind/auth/serverAuthContext";
import { SOLMIND_ROLES } from "@/lib/solmind/roles";
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
import { createSuggestedWaypointWholePathGuideRelationshipEntryDiagnostic } from "@/lib/solmind/supabase/suggestedWaypointWholePathGuideRelationshipEntryDiagnostic";

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
  const wholePathDiagnostic =
    createSuggestedWaypointWholePathGuideRelationshipEntryDiagnostic(request);
  const pagination = parsePagination(request);
  let relationshipId: string;
  try {
    relationshipId = (await context.params).relationshipId;
  } catch {
    wholePathDiagnostic?.report("relationship_path_denied");
    return json(denied());
  }
  if (pagination === null) {
    wholePathDiagnostic?.report("query_denied");
    return json(denied());
  }
  if (!isSuggestedWaypointRelationshipId(relationshipId)) {
    wholePathDiagnostic?.report("relationship_path_denied");
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
    const baseDependencies = createSuggestedWaypointRequestDependencies({
      cookies: requestCookies,
    });
    let diagnosticAuthInput: Awaited<
      ReturnType<typeof baseDependencies.authSource.loadServerAuthContextInput>
    > | null = null;
    let diagnosticDerived: ReturnType<
      typeof deriveTrustedServerAuthContext
    > | null = null;
    const dependencies =
      wholePathDiagnostic === null
        ? baseDependencies
        : {
            ...baseDependencies,
            principalSource: {
              async resolveAuthenticatedUser() {
                wholePathDiagnostic.setResolutionStage("principal_denied");
                const principal =
                  await baseDependencies.principalSource.resolveAuthenticatedUser();
                if (principal !== null) {
                  wholePathDiagnostic.setResolutionStage(
                    "auth_context_denied",
                  );
                }
                return principal;
              },
            },
            authSource: {
              async loadServerAuthContextInput(
                loadRequest: Parameters<
                  typeof baseDependencies.authSource.loadServerAuthContextInput
                >[0],
              ) {
                wholePathDiagnostic.setResolutionStage("auth_context_denied");
                const authInput =
                  await baseDependencies.authSource.loadServerAuthContextInput(
                    loadRequest,
                  );
                diagnosticAuthInput = authInput;
                try {
                  diagnosticDerived =
                    deriveTrustedServerAuthContext(authInput);
                  if (!diagnosticDerived.allowed) {
                    wholePathDiagnostic.setResolutionStage(
                      "auth_context_denied",
                    );
                  } else if (
                    diagnosticDerived.context.activeRole !==
                      SOLMIND_ROLES.GUIDE ||
                    diagnosticDerived.context.identity.guideProfileId === null
                  ) {
                    wholePathDiagnostic.setResolutionStage(
                      "guide_role_denied",
                    );
                  } else {
                    wholePathDiagnostic.setResolutionStage(
                      "relationship_load_denied",
                    );
                  }
                } catch {
                  wholePathDiagnostic.setResolutionStage(
                    "auth_context_denied",
                  );
                }
                return authInput;
              },
              async loadGuideRelationship(
                loadRequest: Parameters<
                  typeof baseDependencies.authSource.loadGuideRelationship
                >[0],
              ) {
                wholePathDiagnostic.setResolutionStage(
                  "relationship_load_denied",
                );
                const relationship =
                  await baseDependencies.authSource.loadGuideRelationship(
                    loadRequest,
                  );
                if (
                  relationship !== null &&
                  diagnosticAuthInput !== null &&
                  diagnosticDerived?.allowed
                ) {
                  try {
                    const { context: derivedContext } = diagnosticDerived;
                    const decision = decideGuideRelationshipAccess({
                      identity: derivedContext.identity,
                      selectors: {
                        requestedRole: derivedContext.activeRole,
                        requestedUserAccountId:
                          derivedContext.identity.userAccountId,
                      },
                      requestedRelationshipId: relationshipId,
                      userAccount: diagnosticAuthInput.userAccount,
                      roleAssignment:
                        diagnosticAuthInput.activeRoleAssignment,
                      session: diagnosticAuthInput.session,
                      relationship,
                    });
                    wholePathDiagnostic.setResolutionStage(
                      decision.allowed
                        ? "rpc_denied"
                        : "relationship_access_denied",
                    );
                  } catch {
                    wholePathDiagnostic.setResolutionStage(
                      "relationship_access_denied",
                    );
                  }
                }
                return relationship;
              },
            },
          };
    const result = await resolveSuggestedWaypointRequest(dependencies, {
      kind: "guide.list",
      relationshipId,
      pageSize: pagination.pageSize,
      cursor: pagination.cursor,
    });
    if (!result.ok && result.error === SUGGESTED_WAYPOINT_REQUEST_DENIED) {
      wholePathDiagnostic?.reportResolutionDenied();
    }
    return json(projectSuccess(result));
  } catch {
    return json(failed());
  }
}
