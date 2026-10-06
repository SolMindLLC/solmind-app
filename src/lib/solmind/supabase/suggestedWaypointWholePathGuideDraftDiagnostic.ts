// PRJ01_V-WS05-WI022-S03 local-proof-only Guide draft diagnostic seam.
//
// This server-only helper can emit one fixed, value-free stage marker only
// when every exact local whole-path gate and request binding is present. It is
// inert in ordinary application operation, never changes a browser response,
// and never writes request, identity, relationship, command, or database data.

import "server-only";

export const SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_DRAFT_INTERNAL_STAGES = [
  "query_denied",
  "relationship_path_denied",
  "request_guard_denied",
  "route_input_denied",
  "request_resolution_denied",
  "principal_denied",
  "auth_context_denied",
  "guide_role_denied",
  "relationship_denied",
  "rpc_denied",
] as const;

export type SuggestedWaypointWholePathGuideDraftInternalStage =
  (typeof SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_DRAFT_INTERNAL_STAGES)[number];

export type SuggestedWaypointWholePathGuideDraftResolutionStage = Extract<
  SuggestedWaypointWholePathGuideDraftInternalStage,
  | "request_resolution_denied"
  | "principal_denied"
  | "auth_context_denied"
  | "guide_role_denied"
  | "relationship_denied"
  | "rpc_denied"
>;

export type SuggestedWaypointWholePathGuideDraftDiagnostic = Readonly<{
  setResolutionStage(
    stage: SuggestedWaypointWholePathGuideDraftResolutionStage,
  ): void;
  report(stage: SuggestedWaypointWholePathGuideDraftInternalStage): void;
  reportResolutionDenied(): void;
}>;

const APPROVAL_GATE =
  "approved-local-synthetic-suggested-waypoint-whole-path" as const;
const EFFECT_GATE =
  "approved-exact-run-local-auth-and-database-cleanup" as const;
const RUN_ID = /^S03G-[0-9]{8}-[a-z0-9][a-z0-9-]{5,31}$/u;
const ROUTE_PATH = /^\/guide\/waypoint-suggestions\/[^/]+\/commands$/u;
const STAGES = new Set<string>(
  SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_DRAFT_INTERNAL_STAGES,
);

function exactLoopbackOrigin(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    const port = Number(url.port);
    if (
      raw !== url.origin ||
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== "" ||
      !Number.isInteger(port) ||
      port < 4100 ||
      port > 4999 ||
      port === 54321
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function requestIsBoundToExactProof(request: Request): boolean {
  const runId = process.env.SOLMIND_WHOLE_PATH_RUN_ID;
  const trustedOrigin = exactLoopbackOrigin(
    process.env.SOLMIND_TRUSTED_APP_ORIGIN,
  );
  if (
    process.env.SOLMIND_WHOLE_PATH_APPROVAL !== APPROVAL_GATE ||
    process.env.SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS !== EFFECT_GATE ||
    typeof runId !== "string" ||
    !RUN_ID.test(runId) ||
    process.env.SOLMIND_LOCAL_SUPABASE_PROJECT_ID !== "solmind-app" ||
    process.env.SOLMIND_LOCAL_SUPABASE_URL !== "http://127.0.0.1:54321" ||
    process.env.SOLMIND_LOCAL_DATABASE_PORT !== "54322" ||
    trustedOrigin === null ||
    request.method !== "POST" ||
    request.headers.get("x-solmind-whole-path-run-id") !== runId
  ) {
    return false;
  }

  try {
    const requestUrl = new URL(request.url);
    return (
      requestUrl.origin === trustedOrigin &&
      ROUTE_PATH.test(requestUrl.pathname)
    );
  } catch {
    return false;
  }
}

export function createSuggestedWaypointWholePathGuideDraftDiagnostic(
  request: Request,
): SuggestedWaypointWholePathGuideDraftDiagnostic | null {
  if (!requestIsBoundToExactProof(request)) return null;

  let emitted = false;
  let resolutionStage: SuggestedWaypointWholePathGuideDraftResolutionStage =
    "request_resolution_denied";

  const report = (
    stage: SuggestedWaypointWholePathGuideDraftInternalStage,
  ): void => {
    if (emitted || !STAGES.has(stage)) return;
    emitted = true;
    process.stderr.write(
      `whole_path_internal_guide_draft_create_${stage}\n`,
    );
  };

  return Object.freeze({
    setResolutionStage(stage) {
      if (!emitted && STAGES.has(stage)) resolutionStage = stage;
    },
    report,
    reportResolutionDenied() {
      report(resolutionStage);
    },
  });
}
