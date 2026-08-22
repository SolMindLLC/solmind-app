// PRJ01_V-WS05-WI022-S03 Guide Suggested Waypoint command route contract.
//
// This server-only boundary validates the browser body before authentication,
// injects the already validated relationship selector, binds each operation to
// one closed RPC function, and projects only the shared four-field browser
// result. Actor, role, profile, policy, deadline, lifecycle, and audit authority
// never come from the browser.

import "server-only";

import {
  SUGGESTED_WAYPOINT_COMMAND_DENIED,
  SUGGESTED_WAYPOINT_COMMAND_FAILED,
  parseSuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandExpectedOutcome,
} from "@/lib/solmind/suggestedWaypointCommandBrowserContract";
import { isSuggestedWaypointRelationshipId } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";
import { snapshotSuggestedWaypointGuideDraftContent } from "@/lib/solmind/suggestedWaypointGuideDraftContentBrowserContract";
import {
  SUGGESTED_WAYPOINT_REQUEST_DENIED,
  type SuggestedWaypointClientRequest,
  type SuggestedWaypointRequestResult,
} from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";
import {
  validateSuggestedWaypointRpcPayload,
  type SuggestedWaypointHumanRpcFunction,
} from "@/lib/solmind/supabase/suggestedWaypointRpcContract";

export type SuggestedWaypointGuideCommandKind =
  | "guide.create_draft"
  | "guide.save_draft"
  | "guide.schedule_send"
  | "guide.pull_back";

export type SuggestedWaypointGuideCommandRequest = Extract<
  SuggestedWaypointClientRequest,
  { kind: SuggestedWaypointGuideCommandKind }
>;

type SuggestedWaypointGuideCommandRpcFunction = Extract<
  SuggestedWaypointHumanRpcFunction,
  | "solmind_save_suggested_waypoint_draft"
  | "solmind_schedule_suggested_waypoint_send"
  | "solmind_pull_back_suggested_waypoint"
>;

export type SuggestedWaypointGuideCommandRouteInput = Readonly<{
  request: SuggestedWaypointGuideCommandRequest;
  functionName: SuggestedWaypointGuideCommandRpcFunction;
  permittedExpectedOutcomes: readonly SuggestedWaypointCommandExpectedOutcome[];
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const OUTCOMES = Object.freeze({
  "guide.create_draft": Object.freeze([
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "stale",
  ] as const),
  "guide.save_draft": Object.freeze([
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "stale",
  ] as const),
  "guide.schedule_send": Object.freeze([
    "invalid_transition",
    "operation_conflict",
    "policy_unavailable",
    "relationship_unavailable",
    "stale",
  ] as const),
  "guide.pull_back": Object.freeze([
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "stale",
    "too_late",
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

function isSafeRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function functionForKind(
  kind: SuggestedWaypointGuideCommandKind,
): SuggestedWaypointGuideCommandRpcFunction {
  switch (kind) {
    case "guide.create_draft":
    case "guide.save_draft":
      return "solmind_save_suggested_waypoint_draft";
    case "guide.schedule_send":
      return "solmind_schedule_suggested_waypoint_send";
    case "guide.pull_back":
      return "solmind_pull_back_suggested_waypoint";
  }
}

export function parseSuggestedWaypointGuideCommandRouteInput(
  value: unknown,
  relationshipId: unknown,
): SuggestedWaypointGuideCommandRouteInput | null {
  if (!isSuggestedWaypointRelationshipId(relationshipId)) {
    return null;
  }

  const body = readDataPropertySnapshot(value);
  if (body === null || typeof body.kind !== "string") {
    return null;
  }
  const kind = body.kind;

  switch (kind) {
    case "guide.create_draft":
      if (!hasExactKeys(body, [
        "kind",
        "operationId",
        "destination",
        "why",
        "arrivalSignals",
      ])) {
        return null;
      }
      break;
    case "guide.save_draft":
      if (!hasExactKeys(body, [
        "kind",
        "operationId",
        "suggestedWaypointId",
        "expectedRevision",
        "destination",
        "why",
        "arrivalSignals",
      ])) {
        return null;
      }
      break;
    case "guide.schedule_send":
      if (!hasExactKeys(body, [
        "kind",
        "operationId",
        "suggestedWaypointId",
        "expectedRevision",
      ])) {
        return null;
      }
      break;
    case "guide.pull_back":
      if (!hasExactKeys(body, [
        "kind",
        "operationId",
        "suggestedWaypointId",
        "expectedRevision",
        "expectedPendingVersionId",
      ])) {
        return null;
      }
      break;
    default:
      return null;
  }
  if (!isUuid(body.operationId)) {
    return null;
  }

  let request: SuggestedWaypointGuideCommandRequest;
  if (kind === "guide.create_draft" || kind === "guide.save_draft") {
    const content = snapshotSuggestedWaypointGuideDraftContent({
      destination: body.destination,
      why: body.why,
      arrivalSignals: body.arrivalSignals,
    });
    if (
      !content.ok ||
      (kind === "guide.save_draft" &&
        (!isUuid(body.suggestedWaypointId) ||
          !isSafeRevision(body.expectedRevision)))
    ) {
      return null;
    }
    request =
      kind === "guide.create_draft"
        ? Object.freeze({
            kind,
            relationshipId,
            operationId: body.operationId,
            destination: content.data.destination,
            why: content.data.why,
            arrivalSignals: content.data.arrivalSignals,
          })
        : Object.freeze({
            kind,
            relationshipId,
            operationId: body.operationId,
            suggestedWaypointId: body.suggestedWaypointId as string,
            expectedRevision: body.expectedRevision as number,
            destination: content.data.destination,
            why: content.data.why,
            arrivalSignals: content.data.arrivalSignals,
          });
  } else if (kind === "guide.schedule_send") {
    if (!isUuid(body.suggestedWaypointId) || !isSafeRevision(body.expectedRevision)) {
      return null;
    }
    request = Object.freeze({
      kind,
      relationshipId,
      operationId: body.operationId,
      suggestedWaypointId: body.suggestedWaypointId,
      expectedRevision: body.expectedRevision,
    });
  } else {
    if (
      !isUuid(body.suggestedWaypointId) ||
      !isSafeRevision(body.expectedRevision) ||
      !isUuid(body.expectedPendingVersionId)
    ) {
      return null;
    }
    request = Object.freeze({
      kind,
      relationshipId,
      operationId: body.operationId,
      suggestedWaypointId: body.suggestedWaypointId,
      expectedRevision: body.expectedRevision,
      expectedPendingVersionId: body.expectedPendingVersionId,
    });
  }

  return Object.freeze({
    request,
    functionName: functionForKind(kind),
    permittedExpectedOutcomes: OUTCOMES[kind],
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

export function projectSuggestedWaypointGuideCommandResult(
  routeInput: SuggestedWaypointGuideCommandRouteInput,
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
  const committed = row.outcome_code === "applied" || row.outcome_code === "idempotent";
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
