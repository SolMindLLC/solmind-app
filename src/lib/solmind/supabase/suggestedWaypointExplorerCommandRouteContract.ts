// PRJ01_V-WS05-WI022-S03 Explorer Suggested Waypoint command route contract.
//
// This server-only boundary accepts only deliberate mark-read and receipt-
// acknowledgement bodies, injects the already validated suggestion selector,
// binds each operation to one closed RPC function, and projects only the shared
// value-free browser result. Actor, role, relationship, content, engagement
// timestamps, and audit authority never come from or return to the browser.

import "server-only";

import {
  SUGGESTED_WAYPOINT_COMMAND_DENIED,
  SUGGESTED_WAYPOINT_COMMAND_FAILED,
  parseSuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandExpectedOutcome,
} from "@/lib/solmind/suggestedWaypointCommandBrowserContract";
import { isSuggestedWaypointExplorerId } from "@/lib/solmind/suggestedWaypointExplorerListBrowserContract";
import {
  SUGGESTED_WAYPOINT_REQUEST_DENIED,
  type SuggestedWaypointClientRequest,
  type SuggestedWaypointRequestResult,
} from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";
import {
  validateSuggestedWaypointRpcPayload,
  type SuggestedWaypointHumanRpcFunction,
} from "@/lib/solmind/supabase/suggestedWaypointRpcContract";

export type SuggestedWaypointExplorerCommandKind =
  | "explorer.mark_read"
  | "explorer.acknowledge";

export type SuggestedWaypointExplorerCommandRequest = Extract<
  SuggestedWaypointClientRequest,
  { kind: SuggestedWaypointExplorerCommandKind }
>;

type SuggestedWaypointExplorerCommandRpcFunction = Extract<
  SuggestedWaypointHumanRpcFunction,
  | "solmind_mark_suggested_waypoint_read"
  | "solmind_acknowledge_suggested_waypoint_receipt"
>;

export type SuggestedWaypointExplorerCommandRouteInput = Readonly<{
  request: SuggestedWaypointExplorerCommandRequest;
  functionName: SuggestedWaypointExplorerCommandRpcFunction;
  permittedExpectedOutcomes: readonly SuggestedWaypointCommandExpectedOutcome[];
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const OUTCOMES = Object.freeze({
  "explorer.mark_read": Object.freeze([
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
  ] as const),
  "explorer.acknowledge": Object.freeze([
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "stale",
  ] as const),
});

function readDataPropertySnapshot(
  value: unknown,
): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
      return null;
    }
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of ownKeys as string[]) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        return null;
      }
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => actualKeys.includes(key))
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function functionForKind(
  kind: SuggestedWaypointExplorerCommandKind,
): SuggestedWaypointExplorerCommandRpcFunction {
  return kind === "explorer.mark_read"
    ? "solmind_mark_suggested_waypoint_read"
    : "solmind_acknowledge_suggested_waypoint_receipt";
}

export function parseSuggestedWaypointExplorerCommandRouteInput(
  value: unknown,
  suggestedWaypointId: unknown,
): SuggestedWaypointExplorerCommandRouteInput | null {
  if (!isSuggestedWaypointExplorerId(suggestedWaypointId)) {
    return null;
  }

  const body = readDataPropertySnapshot(value);
  if (body === null || typeof body.kind !== "string") {
    return null;
  }

  let request: SuggestedWaypointExplorerCommandRequest;
  switch (body.kind) {
    case "explorer.mark_read":
      if (
        !hasExactKeys(body, ["kind", "operationId", "versionId"]) ||
        !isUuid(body.operationId) ||
        !isUuid(body.versionId)
      ) {
        return null;
      }
      request = Object.freeze({
        kind: body.kind,
        operationId: body.operationId,
        suggestedWaypointId,
        versionId: body.versionId,
      });
      break;
    case "explorer.acknowledge":
      if (
        !hasExactKeys(body, [
          "kind",
          "operationId",
          "expectedCurrentVersionId",
        ]) ||
        !isUuid(body.operationId) ||
        !isUuid(body.expectedCurrentVersionId)
      ) {
        return null;
      }
      request = Object.freeze({
        kind: body.kind,
        operationId: body.operationId,
        suggestedWaypointId,
        expectedCurrentVersionId: body.expectedCurrentVersionId,
      });
      break;
    default:
      return null;
  }

  return Object.freeze({
    request,
    functionName: functionForKind(request.kind),
    permittedExpectedOutcomes: OUTCOMES[request.kind],
  });
}

function fixedFailure(
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

export function projectSuggestedWaypointExplorerCommandResult(
  routeInput: SuggestedWaypointExplorerCommandRouteInput,
  result: SuggestedWaypointRequestResult,
): SuggestedWaypointCommandBrowserResult {
  if (!result.ok) {
    return fixedFailure(
      result.error === SUGGESTED_WAYPOINT_REQUEST_DENIED
        ? SUGGESTED_WAYPOINT_COMMAND_DENIED
        : SUGGESTED_WAYPOINT_COMMAND_FAILED,
    );
  }

  const validated = validateSuggestedWaypointRpcPayload(
    routeInput.functionName,
    [result.data],
  );
  if (validated === null) {
    return fixedFailure(SUGGESTED_WAYPOINT_COMMAND_FAILED);
  }

  const row = validated as unknown as Record<string, unknown>;
  const committed =
    row.outcome_code === "applied" || row.outcome_code === "idempotent";
  if (
    row.operation_id !== routeInput.request.operationId ||
    (row.suggested_waypoint_id !== null &&
      row.suggested_waypoint_id !== routeInput.request.suggestedWaypointId) ||
    (committed &&
      routeInput.request.kind === "explorer.mark_read" &&
      row.current_version_id !== routeInput.request.versionId) ||
    (committed &&
      routeInput.request.kind === "explorer.acknowledge" &&
      row.acknowledged_version_id !==
        routeInput.request.expectedCurrentVersionId)
  ) {
    return fixedFailure(SUGGESTED_WAYPOINT_COMMAND_FAILED);
  }

  const projected = parseSuggestedWaypointCommandBrowserResult(
    committed
      ? {
          ok: true,
          outcome: row.outcome_code,
          suggestedWaypointId: row.suggested_waypoint_id,
          error: null,
        }
      : {
          ok: false,
          outcome: row.outcome_code,
          suggestedWaypointId: null,
          error: null,
        },
    routeInput.permittedExpectedOutcomes,
  );
  return projected ?? fixedFailure(SUGGESTED_WAYPOINT_COMMAND_FAILED);
}
