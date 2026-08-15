// PRJ01_V-WS05-WI022-S03 authenticated Guide relationship-selector seam.
//
// Browser input controls pagination only. Actor, role, and Guide identity are
// derived from request auth and rechecked by the closed database function.

import "server-only";

import { type SolMindAuthSource } from "../auth/authSource";
import { type SolMindRequestAuthPrincipalSource } from "../auth/requestAuthPrincipalSource";
import { deriveTrustedServerAuthContext } from "../auth/serverAuthContext";
import { SOLMIND_ROLES } from "../roles";
import {
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION,
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_PAGE_SIZES,
  type SuggestedWaypointRelationshipSelectorPage,
  type SuggestedWaypointRelationshipSelectorPageSize,
} from "./suggestedWaypointRelationshipSelectorContract";
import { type SuggestedWaypointRelationshipSelectorExecutor } from "./suggestedWaypointRelationshipSelectorExecutor";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: suggestedWaypointRelationshipSelectorRequest must not be imported in browser code.",
  );
}

export const SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED =
  "SolMind Suggested Waypoint relationships are unavailable." as const;
export const SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED =
  "SolMind Suggested Waypoint relationships could not be loaded." as const;

export type SuggestedWaypointRelationshipSelectorClientRequest = Readonly<{
  pageSize: SuggestedWaypointRelationshipSelectorPageSize;
  cursor: string | null;
}>;

export type SuggestedWaypointRelationshipSelectorRequestResult =
  | Readonly<{
      ok: true;
      data: SuggestedWaypointRelationshipSelectorPage;
      error: null;
    }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED
        | typeof SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED;
    }>;

export type SuggestedWaypointRelationshipSelectorRequestDependencies =
  Readonly<{
    principalSource: SolMindRequestAuthPrincipalSource;
    authSource: SolMindAuthSource;
    executor: SuggestedWaypointRelationshipSelectorExecutor;
  }>;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotClientRequest(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value;
  }
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    snapshot[key] = value[key];
  }
  return Object.freeze(snapshot);
}

export function validateSuggestedWaypointRelationshipSelectorClientRequest(
  value: unknown,
): SuggestedWaypointRelationshipSelectorClientRequest | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "cursor" || keys[1] !== "pageSize") {
    return null;
  }
  if (
    typeof value.pageSize !== "number" ||
    !SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_PAGE_SIZES.includes(
      value.pageSize as SuggestedWaypointRelationshipSelectorPageSize,
    )
  ) {
    return null;
  }
  if (
    value.cursor !== null &&
    (typeof value.cursor !== "string" ||
      value.cursor.length < 1 ||
      value.cursor.length > 512 ||
      value.cursor.length % 4 !== 0 ||
      !BASE64_PATTERN.test(value.cursor))
  ) {
    return null;
  }
  return Object.freeze({
    pageSize: value.pageSize as SuggestedWaypointRelationshipSelectorPageSize,
    cursor: value.cursor as string | null,
  });
}

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

export async function resolveSuggestedWaypointRelationshipSelectorRequest(
  deps: SuggestedWaypointRelationshipSelectorRequestDependencies,
  input: unknown,
): Promise<SuggestedWaypointRelationshipSelectorRequestResult> {
  let request: SuggestedWaypointRelationshipSelectorClientRequest | null;
  try {
    request = validateSuggestedWaypointRelationshipSelectorClientRequest(
      snapshotClientRequest(input),
    );
  } catch {
    return denied();
  }
  if (request === null) {
    return denied();
  }

  let actorUserAccountId: string;
  try {
    const principal = await deps.principalSource.resolveAuthenticatedUser();
    if (principal === null) {
      return denied();
    }
    const source = await deps.authSource.loadServerAuthContextInput({
      authenticatedUser: principal,
    });
    const derived = deriveTrustedServerAuthContext(source);
    if (
      !derived.allowed ||
      derived.context.activeRole !== SOLMIND_ROLES.GUIDE ||
      derived.context.identity.guideProfileId === null
    ) {
      return denied();
    }
    actorUserAccountId = derived.context.identity.userAccountId;
  } catch {
    return denied();
  }

  try {
    const result = await deps.executor.execute({
      functionName: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION,
      args: {
        p_actor_user_account_id: actorUserAccountId,
        p_page_size: request.pageSize,
        p_cursor: request.cursor,
      },
    });
    return result.error === null && result.data !== null
      ? Object.freeze({ ok: true, data: result.data, error: null })
      : failed();
  } catch {
    return failed();
  }
}
