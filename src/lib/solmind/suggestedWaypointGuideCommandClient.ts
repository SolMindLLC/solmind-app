// PRJ01_V-WS05-WI022-S03 Guide Pull Back browser command client.
//
// This browser-safe owner constructs one exact relationship-scoped Pull Back
// request and classifies only the fixed four-field command result. The server
// remains authoritative for identity, relationship access, lifecycle, and the
// exact Pull Back deadline.

import {
  parseSuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandBrowserResult,
} from "./suggestedWaypointCommandBrowserContract";
import { isSuggestedWaypointId } from "./suggestedWaypointGuideListBrowserContract";
import { isSuggestedWaypointRelationshipId } from "./suggestedWaypointRelationshipBrowserContract";

export const SUGGESTED_WAYPOINT_GUIDE_PULL_BACK_OUTCOMES = Object.freeze([
  "invalid_transition",
  "operation_conflict",
  "relationship_unavailable",
  "stale",
  "too_late",
] as const);

export type SuggestedWaypointGuidePullBackCommand = Readonly<{
  operationId: string;
  relationshipId: string;
  snapshot: string;
  suggestedWaypointId: string;
  url: string;
}>;

export type SuggestedWaypointGuidePullBackSubmission =
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

function isSafeRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}

export function createSuggestedWaypointGuidePullBackCommand(input: Readonly<{
  expectedPendingVersionId: unknown;
  expectedRevision: unknown;
  operationId: unknown;
  relationshipId: unknown;
  suggestedWaypointId: unknown;
}>): SuggestedWaypointGuidePullBackCommand | null {
  if (
    typeof input.operationId !== "string" ||
    !UUID_V4_PATTERN.test(input.operationId) ||
    typeof input.relationshipId !== "string" ||
    !isSuggestedWaypointRelationshipId(input.relationshipId) ||
    typeof input.suggestedWaypointId !== "string" ||
    !isSuggestedWaypointId(input.suggestedWaypointId) ||
    typeof input.expectedPendingVersionId !== "string" ||
    !UUID_PATTERN.test(input.expectedPendingVersionId) ||
    !isSafeRevision(input.expectedRevision)
  ) {
    return null;
  }

  const snapshot = JSON.stringify({
    kind: "guide.pull_back",
    operationId: input.operationId,
    suggestedWaypointId: input.suggestedWaypointId,
    expectedRevision: input.expectedRevision,
    expectedPendingVersionId: input.expectedPendingVersionId,
  });

  return Object.freeze({
    operationId: input.operationId,
    relationshipId: input.relationshipId,
    snapshot,
    suggestedWaypointId: input.suggestedWaypointId,
    url: `/guide/waypoint-suggestions/${encodeURIComponent(input.relationshipId)}/commands`,
  });
}

export async function submitSuggestedWaypointGuidePullBackCommand(
  command: SuggestedWaypointGuidePullBackCommand,
  signal: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<SuggestedWaypointGuidePullBackSubmission> {
  try {
    const response = await fetcher(command.url, {
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
    if (!response.ok) {
      return Object.freeze({ kind: "transport_uncertain", result: null });
    }
    const result = parseSuggestedWaypointCommandBrowserResult(
      await response.json(),
      SUGGESTED_WAYPOINT_GUIDE_PULL_BACK_OUTCOMES,
    );
    return result === null ||
      (result.ok && result.suggestedWaypointId !== command.suggestedWaypointId)
      ? Object.freeze({ kind: "transport_uncertain", result: null })
      : Object.freeze({ kind: "conclusive", result });
  } catch {
    return Object.freeze({ kind: "transport_uncertain", result: null });
  }
}
