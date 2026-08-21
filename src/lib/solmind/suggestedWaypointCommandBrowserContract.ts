// PRJ01_V-WS05-WI022-S03 shared browser-safe command result contract.
//
// Role routes remain responsible for their exact action and expected-outcome
// allowlists. This module never accepts an RPC function, actor, role, policy,
// relationship, version, deadline, or content value from a browser result.

export const SUGGESTED_WAYPOINT_COMMAND_DENIED = "command_denied" as const;
export const SUGGESTED_WAYPOINT_COMMAND_FAILED = "command_failed" as const;

export const SUGGESTED_WAYPOINT_COMMAND_EXPECTED_OUTCOMES = Object.freeze([
  "stale",
  "too_late",
  "invalid_transition",
  "relationship_unavailable",
  "policy_unavailable",
  "operation_conflict",
] as const);

export type SuggestedWaypointCommandExpectedOutcome =
  (typeof SUGGESTED_WAYPOINT_COMMAND_EXPECTED_OUTCOMES)[number];

export type SuggestedWaypointCommandBrowserResult =
  | Readonly<{
      ok: true;
      outcome: "applied" | "idempotent";
      suggestedWaypointId: string;
      error: null;
    }>
  | Readonly<{
      ok: false;
      outcome: SuggestedWaypointCommandExpectedOutcome;
      suggestedWaypointId: null;
      error: null;
    }>
  | Readonly<{
      ok: false;
      outcome: null;
      suggestedWaypointId: null;
      error:
        | typeof SUGGESTED_WAYPOINT_COMMAND_DENIED
        | typeof SUGGESTED_WAYPOINT_COMMAND_FAILED;
    }>;

const RESULT_KEYS = Object.freeze([
  "ok",
  "outcome",
  "suggestedWaypointId",
  "error",
] as const);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readExactDataProperties(
  value: unknown,
  expectedKeys: readonly string[],
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
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      ownKeys.length !== expectedKeys.length ||
      !expectedKeys.every((key) => ownKeys.includes(key))
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of expectedKeys) {
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

function snapshotPermittedOutcomes(
  values: readonly SuggestedWaypointCommandExpectedOutcome[],
): ReadonlySet<SuggestedWaypointCommandExpectedOutcome> | null {
  try {
    if (!Array.isArray(values)) {
      return null;
    }
    const permitted = new Set<SuggestedWaypointCommandExpectedOutcome>();
    for (const value of values) {
      if (
        !SUGGESTED_WAYPOINT_COMMAND_EXPECTED_OUTCOMES.includes(value) ||
        permitted.has(value)
      ) {
        return null;
      }
      permitted.add(value);
    }
    return permitted;
  } catch {
    return null;
  }
}

export function parseSuggestedWaypointCommandBrowserResult(
  value: unknown,
  permittedExpectedOutcomes: readonly SuggestedWaypointCommandExpectedOutcome[],
): SuggestedWaypointCommandBrowserResult | null {
  const result = readExactDataProperties(value, RESULT_KEYS);
  const permitted = snapshotPermittedOutcomes(permittedExpectedOutcomes);
  if (result === null || permitted === null) {
    return null;
  }

  if (
    result.ok === true &&
    (result.outcome === "applied" || result.outcome === "idempotent") &&
    typeof result.suggestedWaypointId === "string" &&
    UUID_PATTERN.test(result.suggestedWaypointId) &&
    result.error === null
  ) {
    return Object.freeze({
      ok: true,
      outcome: result.outcome,
      suggestedWaypointId: result.suggestedWaypointId,
      error: null,
    });
  }

  if (
    result.ok === false &&
    typeof result.outcome === "string" &&
    permitted.has(result.outcome as SuggestedWaypointCommandExpectedOutcome) &&
    result.suggestedWaypointId === null &&
    result.error === null
  ) {
    return Object.freeze({
      ok: false,
      outcome: result.outcome as SuggestedWaypointCommandExpectedOutcome,
      suggestedWaypointId: null,
      error: null,
    });
  }

  if (
    result.ok === false &&
    result.outcome === null &&
    result.suggestedWaypointId === null &&
    (result.error === SUGGESTED_WAYPOINT_COMMAND_DENIED ||
      result.error === SUGGESTED_WAYPOINT_COMMAND_FAILED)
  ) {
    return Object.freeze({
      ok: false,
      outcome: null,
      suggestedWaypointId: null,
      error: result.error,
    });
  }

  return null;
}
