// PRJ01_V-WS05-WI022-S03 pure browser command-operation state.
//
// A role-specific caller owns command validation and compact serialization.
// This owner retains that exact immutable serialized snapshot and its one
// browser-generated operation identity across transport-uncertain retry.

export type SuggestedWaypointCommandAnnouncementKind =
  | "none"
  | "submitting"
  | "transport_uncertain"
  | "success"
  | "expected_non_success";

export type SuggestedWaypointCommandFocusIntent =
  | "none"
  | "initiator"
  | "updated_status";

export type SuggestedWaypointCommandOperationState = Readonly<{
  phase:
    | "idle"
    | "in_flight"
    | "transport_uncertain"
    | "conclusive"
    | "invalidated";
  generation: number;
  operationId: string | null;
  snapshot: string | null;
  busy: boolean;
  retryAvailable: boolean;
  acceptsResult: boolean;
  announcementKind: SuggestedWaypointCommandAnnouncementKind;
  focusIntent: SuggestedWaypointCommandFocusIntent;
}>;

export type SuggestedWaypointCommandConclusiveKind =
  | "success"
  | "expected_non_success";

// This state owner carries only shared accessibility/retry intent. The parsed
// command result remains separately owned by the role lane, which must preserve
// expected-outcome versus denied/failed copy and recovery behavior.

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function freezeState(
  state: SuggestedWaypointCommandOperationState,
): SuggestedWaypointCommandOperationState {
  return Object.freeze(state);
}

export function createIdleSuggestedWaypointCommandOperation(): SuggestedWaypointCommandOperationState {
  return freezeState({
    phase: "idle",
    generation: 0,
    operationId: null,
    snapshot: null,
    busy: false,
    retryAvailable: false,
    acceptsResult: false,
    announcementKind: "none",
    focusIntent: "none",
  });
}

function createOperationId(
  factory: () => string,
): string | null {
  try {
    const operationId = factory();
    return typeof operationId === "string" && UUID_V4_PATTERN.test(operationId)
      ? operationId
      : null;
  } catch {
    return null;
  }
}

function isSnapshot(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function inFlightState(
  generation: number,
  operationId: string,
  snapshot: string,
): SuggestedWaypointCommandOperationState {
  return freezeState({
    phase: "in_flight",
    generation,
    operationId,
    snapshot,
    busy: true,
    retryAvailable: false,
    acceptsResult: true,
    announcementKind: "submitting",
    focusIntent: "none",
  });
}

export function beginSuggestedWaypointCommandOperation(
  state: SuggestedWaypointCommandOperationState,
  snapshot: string,
  operationIdFactory: () => string,
): SuggestedWaypointCommandOperationState {
  if (state.phase !== "idle" || !isSnapshot(snapshot)) {
    return state;
  }
  const operationId = createOperationId(operationIdFactory);
  return operationId === null
    ? state
    : inFlightState(state.generation + 1, operationId, snapshot);
}

export function markSuggestedWaypointCommandTransportUncertain(
  state: SuggestedWaypointCommandOperationState,
  generation: number,
): SuggestedWaypointCommandOperationState {
  if (state.phase !== "in_flight" || state.generation !== generation) {
    return state;
  }
  return freezeState({
    ...state,
    phase: "transport_uncertain",
    busy: false,
    retryAvailable: true,
    acceptsResult: true,
    announcementKind: "transport_uncertain",
    focusIntent: "initiator",
  });
}

export function retrySuggestedWaypointCommandOperation(
  state: SuggestedWaypointCommandOperationState,
): SuggestedWaypointCommandOperationState {
  if (
    state.phase !== "transport_uncertain" ||
    state.operationId === null ||
    state.snapshot === null
  ) {
    return state;
  }
  return inFlightState(
    state.generation,
    state.operationId,
    state.snapshot,
  );
}

export function resolveSuggestedWaypointCommandOperation(
  state: SuggestedWaypointCommandOperationState,
  generation: number,
  kind: SuggestedWaypointCommandConclusiveKind,
): SuggestedWaypointCommandOperationState {
  if (
    (state.phase !== "in_flight" &&
      state.phase !== "transport_uncertain") ||
    state.generation !== generation
  ) {
    return state;
  }
  return freezeState({
    phase: "conclusive",
    generation,
    operationId: null,
    snapshot: null,
    busy: false,
    retryAvailable: false,
    acceptsResult: false,
    announcementKind: kind,
    focusIntent: kind === "success" ? "updated_status" : "initiator",
  });
}

export function settleSuggestedWaypointCommandByAuthoritativeRead(
  state: SuggestedWaypointCommandOperationState,
  generation: number,
  requestedStateObserved: boolean,
): SuggestedWaypointCommandOperationState {
  if (
    state.phase !== "transport_uncertain" ||
    state.generation !== generation ||
    !requestedStateObserved
  ) {
    return state;
  }
  return resolveSuggestedWaypointCommandOperation(
    state,
    generation,
    "success",
  );
}

export function replaceSuggestedWaypointCommandOperation(
  state: SuggestedWaypointCommandOperationState,
  snapshot: string,
  operationIdFactory: () => string,
): SuggestedWaypointCommandOperationState {
  if (
    state.phase === "in_flight" ||
    state.phase === "invalidated" ||
    !isSnapshot(snapshot) ||
    (state.phase === "transport_uncertain" && state.snapshot === snapshot)
  ) {
    return state;
  }
  const operationId = createOperationId(operationIdFactory);
  return operationId === null
    ? state
    : inFlightState(state.generation + 1, operationId, snapshot);
}

export function invalidateSuggestedWaypointCommandOperation(
  state: SuggestedWaypointCommandOperationState,
): SuggestedWaypointCommandOperationState {
  if (state.phase === "invalidated") {
    return state;
  }
  return freezeState({
    phase: "invalidated",
    generation: state.generation,
    operationId: null,
    snapshot: null,
    busy: false,
    retryAvailable: false,
    acceptsResult: false,
    announcementKind: "none",
    focusIntent: "none",
  });
}
