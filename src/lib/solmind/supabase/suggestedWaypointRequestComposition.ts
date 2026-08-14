// PRJ01_V-WS05-WI022-S03 authenticated Suggested Waypoint request composition.
//
// This server-only boundary turns a client-safe Guide or Explorer request into
// one of the closed human RPC calls. The authenticated request principal and
// SolMind records establish authority. The client can select a relationship or
// feature operation, but can never supply the actor account, role, profile, or
// database function name used by the RPC call.

import "server-only";

import { SOLMIND_ROLES } from "../roles";
import { decideGuideRelationshipAccess } from "../auth/accessBoundary";
import { type SolMindAuthSource } from "../auth/authSource";
import { type SolMindRequestAuthPrincipalSource } from "../auth/requestAuthPrincipalSource";
import { deriveTrustedServerAuthContext } from "../auth/serverAuthContext";
import {
  type SuggestedWaypointHumanRpcFunction,
  type SuggestedWaypointRpcPayload,
} from "./suggestedWaypointRpcContract";
import {
  type SuggestedWaypointHumanRpcExecutor,
  type SuggestedWaypointRpcResult,
} from "./suggestedWaypointRpcExecutor";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: suggestedWaypointRequestComposition must not be imported in browser code.",
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PAGE_SIZES = new Set([5, 10, 20, 50, 100]);

export const SUGGESTED_WAYPOINT_REQUEST_DENIED =
  "solmind_suggested_waypoint_request_denied" as const;
export const SUGGESTED_WAYPOINT_REQUEST_FAILED =
  "solmind_suggested_waypoint_request_failed" as const;

export type SuggestedWaypointRequestError =
  | typeof SUGGESTED_WAYPOINT_REQUEST_DENIED
  | typeof SUGGESTED_WAYPOINT_REQUEST_FAILED;

export type SuggestedWaypointRequestResult =
  | Readonly<{
      ok: true;
      data: SuggestedWaypointRpcPayload;
      error: null;
    }>
  | Readonly<{
      ok: false;
      data: null;
      error: SuggestedWaypointRequestError;
    }>;

type PageSize = 5 | 10 | 20 | 50 | 100;

type CreateDraftRequest = Readonly<{
  kind: "guide.create_draft";
  relationshipId: string;
  operationId: string;
  destination: string;
  why: string;
  arrivalSignals: readonly string[];
}>;

type SaveDraftRequest = Readonly<{
  kind: "guide.save_draft";
  relationshipId: string;
  operationId: string;
  suggestedWaypointId: string;
  expectedRevision: number;
  destination: string;
  why: string;
  arrivalSignals: readonly string[];
}>;

type ScheduleSendRequest = Readonly<{
  kind: "guide.schedule_send";
  relationshipId: string;
  operationId: string;
  suggestedWaypointId: string;
  expectedRevision: number;
}>;

type PullBackRequest = Readonly<{
  kind: "guide.pull_back";
  relationshipId: string;
  operationId: string;
  suggestedWaypointId: string;
  expectedRevision: number;
  expectedPendingVersionId: string;
}>;

type GuideListRequest = Readonly<{
  kind: "guide.list";
  relationshipId: string;
  pageSize: PageSize;
  cursor: string | null;
}>;

type GuideGetRequest = Readonly<{
  kind: "guide.get";
  relationshipId: string;
  suggestedWaypointId: string;
}>;

type MarkReadRequest = Readonly<{
  kind: "explorer.mark_read";
  operationId: string;
  suggestedWaypointId: string;
  versionId: string;
}>;

type AcknowledgeRequest = Readonly<{
  kind: "explorer.acknowledge";
  operationId: string;
  suggestedWaypointId: string;
  expectedCurrentVersionId: string;
}>;

type ExplorerListRequest = Readonly<{
  kind: "explorer.list";
  pageSize: PageSize;
  cursor: string | null;
}>;

type ExplorerGetRequest = Readonly<{
  kind: "explorer.get";
  suggestedWaypointId: string;
}>;

export type SuggestedWaypointClientRequest =
  | CreateDraftRequest
  | SaveDraftRequest
  | ScheduleSendRequest
  | PullBackRequest
  | GuideListRequest
  | GuideGetRequest
  | MarkReadRequest
  | AcknowledgeRequest
  | ExplorerListRequest
  | ExplorerGetRequest;

export type SuggestedWaypointRequestCompositionDependencies = Readonly<{
  principalSource: SolMindRequestAuthPrincipalSource;
  authSource: SolMindAuthSource;
  executor: SuggestedWaypointHumanRpcExecutor;
  identifiers?: Readonly<{
    // Both functions MUST be stable for the same exact scoped operation so an
    // idempotent retry cannot receive different canonical bytes.
    suggestedWaypointIdForCreate(args: {
      actorUserAccountId: string;
      relationshipId: string;
      operationId: string;
    }): string;
    versionIdForSchedule(args: {
      actorUserAccountId: string;
      relationshipId: string;
      operationId: string;
      suggestedWaypointId: string;
    }): string;
  }>;
}>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum
  );
}

function hasForbiddenControl(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (
      code === 0 ||
      (code >= 1 && code <= 8) ||
      (code >= 11 && code <= 12) ||
      (code >= 14 && code <= 31) ||
      (code >= 127 && code <= 159)
    ) {
      return true;
    }
  }
  return false;
}

function isBoundedText(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const length = Array.from(value).length;
  return (
    length >= minimum &&
    length <= maximum &&
    value === value.trim() &&
    value === value.normalize("NFC") &&
    !value.includes("\r") &&
    !hasForbiddenControl(value)
  );
}

function isArrivalSignals(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    return false;
  }
  const seen = new Set<string>();
  for (const signal of value) {
    if (!isBoundedText(signal, 1, 240) || seen.has(signal)) {
      return false;
    }
    seen.add(signal);
  }
  return true;
}

function isPageSize(value: unknown): value is PageSize {
  return typeof value === "number" && PAGE_SIZES.has(value);
}

function isCursor(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      value.length % 4 === 0 &&
      BASE64_PATTERN.test(value))
  );
}

function validateClientRequest(
  value: unknown,
): SuggestedWaypointClientRequest | null {
  if (!isPlainObject(value) || typeof value.kind !== "string") {
    return null;
  }

  switch (value.kind) {
    case "guide.create_draft":
      if (
        !hasExactKeys(value, [
          "kind",
          "relationshipId",
          "operationId",
          "destination",
          "why",
          "arrivalSignals",
        ]) ||
        !isUuid(value.relationshipId) ||
        !isUuid(value.operationId) ||
        !isBoundedText(value.destination, 1, 160) ||
        !isBoundedText(value.why, 1, 1000) ||
        !isArrivalSignals(value.arrivalSignals)
      ) {
        return null;
      }
      break;
    case "guide.save_draft":
      if (
        !hasExactKeys(value, [
          "kind",
          "relationshipId",
          "operationId",
          "suggestedWaypointId",
          "expectedRevision",
          "destination",
          "why",
          "arrivalSignals",
        ]) ||
        !isUuid(value.relationshipId) ||
        !isUuid(value.operationId) ||
        !isUuid(value.suggestedWaypointId) ||
        !isSafeInteger(value.expectedRevision, 1) ||
        !isBoundedText(value.destination, 1, 160) ||
        !isBoundedText(value.why, 1, 1000) ||
        !isArrivalSignals(value.arrivalSignals)
      ) {
        return null;
      }
      break;
    case "guide.schedule_send":
      if (
        !hasExactKeys(value, [
          "kind",
          "relationshipId",
          "operationId",
          "suggestedWaypointId",
          "expectedRevision",
        ]) ||
        !isUuid(value.relationshipId) ||
        !isUuid(value.operationId) ||
        !isUuid(value.suggestedWaypointId) ||
        !isSafeInteger(value.expectedRevision, 1)
      ) {
        return null;
      }
      break;
    case "guide.pull_back":
      if (
        !hasExactKeys(value, [
          "kind",
          "relationshipId",
          "operationId",
          "suggestedWaypointId",
          "expectedRevision",
          "expectedPendingVersionId",
        ]) ||
        !isUuid(value.relationshipId) ||
        !isUuid(value.operationId) ||
        !isUuid(value.suggestedWaypointId) ||
        !isSafeInteger(value.expectedRevision, 1) ||
        !isUuid(value.expectedPendingVersionId)
      ) {
        return null;
      }
      break;
    case "guide.list":
      if (
        !hasExactKeys(value, [
          "kind",
          "relationshipId",
          "pageSize",
          "cursor",
        ]) ||
        !isUuid(value.relationshipId) ||
        !isPageSize(value.pageSize) ||
        !isCursor(value.cursor)
      ) {
        return null;
      }
      break;
    case "guide.get":
      if (
        !hasExactKeys(value, [
          "kind",
          "relationshipId",
          "suggestedWaypointId",
        ]) ||
        !isUuid(value.relationshipId) ||
        !isUuid(value.suggestedWaypointId)
      ) {
        return null;
      }
      break;
    case "explorer.mark_read":
      if (
        !hasExactKeys(value, [
          "kind",
          "operationId",
          "suggestedWaypointId",
          "versionId",
        ]) ||
        !isUuid(value.operationId) ||
        !isUuid(value.suggestedWaypointId) ||
        !isUuid(value.versionId)
      ) {
        return null;
      }
      break;
    case "explorer.acknowledge":
      if (
        !hasExactKeys(value, [
          "kind",
          "operationId",
          "suggestedWaypointId",
          "expectedCurrentVersionId",
        ]) ||
        !isUuid(value.operationId) ||
        !isUuid(value.suggestedWaypointId) ||
        !isUuid(value.expectedCurrentVersionId)
      ) {
        return null;
      }
      break;
    case "explorer.list":
      if (
        !hasExactKeys(value, ["kind", "pageSize", "cursor"]) ||
        !isPageSize(value.pageSize) ||
        !isCursor(value.cursor)
      ) {
        return null;
      }
      break;
    case "explorer.get":
      if (
        !hasExactKeys(value, ["kind", "suggestedWaypointId"]) ||
        !isUuid(value.suggestedWaypointId)
      ) {
        return null;
      }
      break;
    default:
      return null;
  }

  return value as unknown as SuggestedWaypointClientRequest;
}

function snapshotClientRequest(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value;
  }

  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    snapshot[key] = value[key];
  }
  if (Array.isArray(snapshot.arrivalSignals)) {
    snapshot.arrivalSignals = Object.freeze([...snapshot.arrivalSignals]);
  }
  return Object.freeze(snapshot);
}

function isGuideRequest(
  request: SuggestedWaypointClientRequest,
): request is
  | CreateDraftRequest
  | SaveDraftRequest
  | ScheduleSendRequest
  | PullBackRequest
  | GuideListRequest
  | GuideGetRequest {
  return request.kind.startsWith("guide.");
}

type BuiltRpcCall = Readonly<{
  functionName: SuggestedWaypointHumanRpcFunction;
  call: unknown;
}>;

function toRpcCall(
  actorUserAccountId: string,
  request: SuggestedWaypointClientRequest,
  identifiers: SuggestedWaypointRequestCompositionDependencies["identifiers"],
): BuiltRpcCall | null {
  switch (request.kind) {
    case "guide.create_draft": {
      const suggestedWaypointId =
        identifiers?.suggestedWaypointIdForCreate({
          actorUserAccountId,
          relationshipId: request.relationshipId,
          operationId: request.operationId,
        });
      if (!isUuid(suggestedWaypointId)) {
        return null;
      }
      return {
        functionName: "solmind_save_suggested_waypoint_draft",
        call: {
          functionName: "solmind_save_suggested_waypoint_draft",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_operation_id: request.operationId,
            p_guide_explorer_relationship_id: request.relationshipId,
            p_suggested_waypoint_id: suggestedWaypointId,
            p_expected_revision: 0,
            p_destination: request.destination,
            p_why: request.why,
            p_arrival_signals: [...request.arrivalSignals],
          },
        },
      };
    }
    case "guide.save_draft":
      return {
        functionName: "solmind_save_suggested_waypoint_draft",
        call: {
          functionName: "solmind_save_suggested_waypoint_draft",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_operation_id: request.operationId,
            p_guide_explorer_relationship_id: request.relationshipId,
            p_suggested_waypoint_id: request.suggestedWaypointId,
            p_expected_revision: request.expectedRevision,
            p_destination: request.destination,
            p_why: request.why,
            p_arrival_signals: [...request.arrivalSignals],
          },
        },
      };
    case "guide.schedule_send": {
      const suggestedWaypointVersionId = identifiers?.versionIdForSchedule({
        actorUserAccountId,
        relationshipId: request.relationshipId,
        operationId: request.operationId,
        suggestedWaypointId: request.suggestedWaypointId,
      });
      if (!isUuid(suggestedWaypointVersionId)) {
        return null;
      }
      return {
        functionName: "solmind_schedule_suggested_waypoint_send",
        call: {
          functionName: "solmind_schedule_suggested_waypoint_send",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_operation_id: request.operationId,
            p_suggested_waypoint_id: request.suggestedWaypointId,
            p_suggested_waypoint_version_id: suggestedWaypointVersionId,
            p_expected_revision: request.expectedRevision,
          },
        },
      };
    }
    case "guide.pull_back":
      return {
        functionName: "solmind_pull_back_suggested_waypoint",
        call: {
          functionName: "solmind_pull_back_suggested_waypoint",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_operation_id: request.operationId,
            p_suggested_waypoint_id: request.suggestedWaypointId,
            p_expected_revision: request.expectedRevision,
            p_expected_pending_version_id: request.expectedPendingVersionId,
          },
        },
      };
    case "guide.list":
      return {
        functionName: "solmind_list_guide_suggested_waypoints",
        call: {
          functionName: "solmind_list_guide_suggested_waypoints",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_guide_explorer_relationship_id: request.relationshipId,
            p_page_size: request.pageSize,
            p_cursor: request.cursor,
          },
        },
      };
    case "guide.get":
      return {
        functionName: "solmind_get_guide_suggested_waypoint",
        call: {
          functionName: "solmind_get_guide_suggested_waypoint",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_guide_explorer_relationship_id: request.relationshipId,
            p_suggested_waypoint_id: request.suggestedWaypointId,
          },
        },
      };
    case "explorer.mark_read":
      return {
        functionName: "solmind_mark_suggested_waypoint_read",
        call: {
          functionName: "solmind_mark_suggested_waypoint_read",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_operation_id: request.operationId,
            p_suggested_waypoint_id: request.suggestedWaypointId,
            p_version_id: request.versionId,
          },
        },
      };
    case "explorer.acknowledge":
      return {
        functionName: "solmind_acknowledge_suggested_waypoint_receipt",
        call: {
          functionName: "solmind_acknowledge_suggested_waypoint_receipt",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_operation_id: request.operationId,
            p_suggested_waypoint_id: request.suggestedWaypointId,
            p_expected_current_version_id: request.expectedCurrentVersionId,
          },
        },
      };
    case "explorer.list":
      return {
        functionName: "solmind_list_explorer_suggested_waypoints",
        call: {
          functionName: "solmind_list_explorer_suggested_waypoints",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_page_size: request.pageSize,
            p_cursor: request.cursor,
          },
        },
      };
    case "explorer.get":
      return {
        functionName: "solmind_get_explorer_suggested_waypoint",
        call: {
          functionName: "solmind_get_explorer_suggested_waypoint",
          args: {
            p_actor_user_account_id: actorUserAccountId,
            p_suggested_waypoint_id: request.suggestedWaypointId,
          },
        },
      };
  }
}

function deny(): SuggestedWaypointRequestResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_REQUEST_DENIED,
  });
}

function fail(): SuggestedWaypointRequestResult {
  return Object.freeze({
    ok: false,
    data: null,
    error: SUGGESTED_WAYPOINT_REQUEST_FAILED,
  });
}

export async function resolveSuggestedWaypointRequest(
  deps: SuggestedWaypointRequestCompositionDependencies,
  input: unknown,
): Promise<SuggestedWaypointRequestResult> {
  let request: SuggestedWaypointClientRequest | null;
  try {
    // Read untrusted properties exactly once and validate only that frozen,
    // plain-data snapshot. Proxy traps and accessors therefore fail closed,
    // and mutable caller objects cannot change bytes across an await.
    request = validateClientRequest(snapshotClientRequest(input));
  } catch {
    return deny();
  }
  if (request === null) {
    return deny();
  }

  let actorUserAccountId: string;
  try {
    const principal = await deps.principalSource.resolveAuthenticatedUser();
    if (principal === null) {
      return deny();
    }

    const serverAuthContext = await deps.authSource.loadServerAuthContextInput({
      authenticatedUser: principal,
    });
    const derived = deriveTrustedServerAuthContext(serverAuthContext);
    if (!derived.allowed) {
      return deny();
    }

    const { context } = derived;
    if (isGuideRequest(request)) {
      if (
        context.activeRole !== SOLMIND_ROLES.GUIDE ||
        context.identity.guideProfileId === null
      ) {
        return deny();
      }
      const relationship = await deps.authSource.loadGuideRelationship({
        relationshipId: request.relationshipId,
      });
      if (relationship === null) {
        return deny();
      }
      const decision = decideGuideRelationshipAccess({
        identity: context.identity,
        selectors: {
          requestedRole: context.activeRole,
          requestedUserAccountId: context.identity.userAccountId,
        },
        requestedRelationshipId: request.relationshipId,
        userAccount: serverAuthContext.userAccount,
        roleAssignment: serverAuthContext.activeRoleAssignment,
        session: serverAuthContext.session,
        relationship,
      });
      if (!decision.allowed) {
        return deny();
      }
    } else if (
      context.activeRole !== SOLMIND_ROLES.EXPLORER ||
      context.identity.explorerProfileId === null
    ) {
      return deny();
    }

    actorUserAccountId = context.identity.userAccountId;
  } catch {
    return deny();
  }

  let builtCall: BuiltRpcCall | null;
  try {
    builtCall = toRpcCall(actorUserAccountId, request, deps.identifiers);
  } catch {
    return fail();
  }
  if (builtCall === null) {
    return fail();
  }

  let rpcResult: SuggestedWaypointRpcResult;
  try {
    rpcResult = await deps.executor.execute(builtCall.call);
  } catch {
    return fail();
  }
  if (
    rpcResult.error !== null ||
    rpcResult.functionName === null ||
    rpcResult.data === null ||
    rpcResult.functionName !== builtCall.functionName
  ) {
    return fail();
  }
  return Object.freeze({ ok: true, data: rpcResult.data, error: null });
}
