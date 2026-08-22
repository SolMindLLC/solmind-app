// PRJ01_V-WS05-WI022-S03 Explorer browser command client.
//
// This browser-safe owner constructs only explicit Mark as read and
// Acknowledge receipt requests. The server remains authoritative for actor,
// relationship, delivery, version, privacy, and database behavior.

import {
  SUGGESTED_WAYPOINT_COMMAND_FAILED,
  parseSuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandExpectedOutcome,
} from "./suggestedWaypointCommandBrowserContract";
import { isSuggestedWaypointExplorerId } from "./suggestedWaypointExplorerListBrowserContract";

export const SUGGESTED_WAYPOINT_EXPLORER_MARK_READ_OUTCOMES = Object.freeze([
  "invalid_transition",
  "operation_conflict",
  "relationship_unavailable",
] as const);

export const SUGGESTED_WAYPOINT_EXPLORER_ACKNOWLEDGE_OUTCOMES = Object.freeze([
  ...SUGGESTED_WAYPOINT_EXPLORER_MARK_READ_OUTCOMES,
  "stale",
] as const);

export type SuggestedWaypointExplorerCommandKind =
  | "explorer.mark_read"
  | "explorer.acknowledge";

export type SuggestedWaypointExplorerCommand = Readonly<{
  kind: SuggestedWaypointExplorerCommandKind;
  operationId: string;
  snapshot: string;
  suggestedWaypointId: string;
  url: string;
  versionId: string;
}>;

export type SuggestedWaypointExplorerCommandSubmission =
  | Readonly<{
      kind: "conclusive";
      result: SuggestedWaypointCommandBrowserResult;
    }>
  | Readonly<{ kind: "transport_uncertain"; result: null }>;

type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "json" | "ok">>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isUuidV4(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_PATTERN.test(value);
}

function createCommand(
  input: unknown,
  kind: SuggestedWaypointExplorerCommandKind,
): SuggestedWaypointExplorerCommand | null {
  const keys = Object.freeze([
    "operationId",
    "suggestedWaypointId",
    "versionId",
  ] as const);
  const value = readExactDataProperties(input, keys);
  if (
    value === null ||
    !isUuidV4(value.operationId) ||
    !isSuggestedWaypointExplorerId(value.suggestedWaypointId) ||
    !isUuid(value.versionId)
  ) {
    return null;
  }

  const snapshot =
    kind === "explorer.mark_read"
      ? JSON.stringify({
          kind,
          operationId: value.operationId,
          versionId: value.versionId,
        })
      : JSON.stringify({
          kind,
          operationId: value.operationId,
          expectedCurrentVersionId: value.versionId,
        });

  return Object.freeze({
    kind,
    operationId: value.operationId,
    snapshot,
    suggestedWaypointId: value.suggestedWaypointId,
    url: `/explorer/waypoints/${encodeURIComponent(value.suggestedWaypointId)}/commands`,
    versionId: value.versionId,
  });
}

export function createSuggestedWaypointExplorerMarkReadCommand(
  input: unknown,
): SuggestedWaypointExplorerCommand | null {
  return createCommand(input, "explorer.mark_read");
}

export function createSuggestedWaypointExplorerAcknowledgeCommand(
  input: unknown,
): SuggestedWaypointExplorerCommand | null {
  return createCommand(input, "explorer.acknowledge");
}

function fixedFailedResult(): SuggestedWaypointCommandBrowserResult {
  return Object.freeze({
    ok: false,
    outcome: null,
    suggestedWaypointId: null,
    error: SUGGESTED_WAYPOINT_COMMAND_FAILED,
  });
}

function permittedOutcomes(
  kind: SuggestedWaypointExplorerCommandKind,
): readonly SuggestedWaypointCommandExpectedOutcome[] {
  return kind === "explorer.mark_read"
    ? SUGGESTED_WAYPOINT_EXPLORER_MARK_READ_OUTCOMES
    : SUGGESTED_WAYPOINT_EXPLORER_ACKNOWLEDGE_OUTCOMES;
}

export async function submitSuggestedWaypointExplorerCommand(
  command: SuggestedWaypointExplorerCommand,
  signal: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<SuggestedWaypointExplorerCommandSubmission> {
  let response: Pick<Response, "json" | "ok">;
  try {
    response = await fetcher(command.url, {
      body: command.snapshot,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      method: "POST",
      signal,
    });
  } catch {
    return Object.freeze({ kind: "transport_uncertain", result: null });
  }

  if (!response.ok) {
    return Object.freeze({ kind: "transport_uncertain", result: null });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return Object.freeze({ kind: "conclusive", result: fixedFailedResult() });
  }

  const parsed = parseSuggestedWaypointCommandBrowserResult(
    payload,
    permittedOutcomes(command.kind),
  );
  if (
    parsed === null ||
    (parsed.ok && parsed.suggestedWaypointId !== command.suggestedWaypointId)
  ) {
    return Object.freeze({ kind: "conclusive", result: fixedFailedResult() });
  }
  return Object.freeze({ kind: "conclusive", result: parsed });
}
