// PRJ01_V-WS05-WI022-S03 Guide browser command client.
//
// This browser-safe owner constructs exact relationship-scoped save-draft,
// schedule-send, and Pull Back requests and classifies only the fixed four-field
// command result. The server remains authoritative for identity, relationship
// access, lifecycle, policy, and the exact Pull Back deadline.

import {
  parseSuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandExpectedOutcome,
} from "./suggestedWaypointCommandBrowserContract";
import { isSuggestedWaypointId } from "./suggestedWaypointGuideListBrowserContract";
import { isSuggestedWaypointRelationshipId } from "./suggestedWaypointRelationshipBrowserContract";
import {
  snapshotSuggestedWaypointGuideDraftContent,
  type SuggestedWaypointGuideDraftContent,
} from "./suggestedWaypointGuideDraftContentBrowserContract";

export const SUGGESTED_WAYPOINT_GUIDE_SAVE_DRAFT_OUTCOMES = Object.freeze([
  "invalid_transition",
  "operation_conflict",
  "relationship_unavailable",
  "stale",
] as const);

export const SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_SEND_OUTCOMES = Object.freeze([
  "invalid_transition",
  "operation_conflict",
  "policy_unavailable",
  "relationship_unavailable",
  "stale",
] as const);

export const SUGGESTED_WAYPOINT_GUIDE_PULL_BACK_OUTCOMES = Object.freeze([
  "invalid_transition",
  "operation_conflict",
  "relationship_unavailable",
  "stale",
  "too_late",
] as const);

export type SuggestedWaypointGuidePullBackCommand = Readonly<{
  kind: "guide.pull_back";
  expectedRevision: number;
  operationId: string;
  relationshipId: string;
  snapshot: string;
  suggestedWaypointId: string;
  url: string;
}>;

export type SuggestedWaypointGuideSaveDraftCommand = Readonly<{
  kind: "guide.save_draft";
  content: SuggestedWaypointGuideDraftContent;
  expectedRevision: number;
  operationId: string;
  relationshipId: string;
  snapshot: string;
  suggestedWaypointId: string;
  url: string;
}>;

export type SuggestedWaypointGuideScheduleSendCommand = Readonly<{
  kind: "guide.schedule_send";
  expectedRevision: number;
  operationId: string;
  relationshipId: string;
  snapshot: string;
  suggestedWaypointId: string;
  url: string;
}>;

export type SuggestedWaypointGuideCommand =
  | SuggestedWaypointGuidePullBackCommand
  | SuggestedWaypointGuideSaveDraftCommand
  | SuggestedWaypointGuideScheduleSendCommand;

export type SuggestedWaypointGuidePullBackSubmission =
  | Readonly<{
      kind: "conclusive";
      result: SuggestedWaypointCommandBrowserResult;
    }>
  | Readonly<{ kind: "transport_uncertain"; result: null }>;

export type SuggestedWaypointGuideCommandSubmission =
  SuggestedWaypointGuidePullBackSubmission;

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
    kind: "guide.pull_back",
    expectedRevision: input.expectedRevision,
    operationId: input.operationId,
    relationshipId: input.relationshipId,
    snapshot,
    suggestedWaypointId: input.suggestedWaypointId,
    url: `/guide/waypoint-suggestions/${encodeURIComponent(input.relationshipId)}/commands`,
  });
}

function validBaseInput(input: Readonly<{
  expectedRevision: unknown;
  operationId: unknown;
  relationshipId: unknown;
  suggestedWaypointId: unknown;
}>): input is Readonly<{
  expectedRevision: number;
  operationId: string;
  relationshipId: string;
  suggestedWaypointId: string;
}> {
  return (
    typeof input.operationId === "string" &&
    UUID_V4_PATTERN.test(input.operationId) &&
    typeof input.relationshipId === "string" &&
    isSuggestedWaypointRelationshipId(input.relationshipId) &&
    typeof input.suggestedWaypointId === "string" &&
    isSuggestedWaypointId(input.suggestedWaypointId) &&
    isSafeRevision(input.expectedRevision)
  );
}

export function createSuggestedWaypointGuideSaveDraftCommand(input: Readonly<{
  arrivalSignals: unknown;
  destination: unknown;
  expectedRevision: unknown;
  operationId: unknown;
  relationshipId: unknown;
  suggestedWaypointId: unknown;
  why: unknown;
}>): SuggestedWaypointGuideSaveDraftCommand | null {
  if (!validBaseInput(input)) {
    return null;
  }
  const content = snapshotSuggestedWaypointGuideDraftContent({
    destination: input.destination,
    why: input.why,
    arrivalSignals: input.arrivalSignals,
  });
  if (!content.ok) {
    return null;
  }
  const snapshot = JSON.stringify({
    kind: "guide.save_draft",
    operationId: input.operationId,
    suggestedWaypointId: input.suggestedWaypointId,
    expectedRevision: input.expectedRevision,
    destination: content.data.destination,
    why: content.data.why,
    arrivalSignals: content.data.arrivalSignals,
  });
  return Object.freeze({
    kind: "guide.save_draft",
    content: content.data,
    expectedRevision: input.expectedRevision,
    operationId: input.operationId,
    relationshipId: input.relationshipId,
    snapshot,
    suggestedWaypointId: input.suggestedWaypointId,
    url: `/guide/waypoint-suggestions/${encodeURIComponent(input.relationshipId)}/commands`,
  });
}

export function createSuggestedWaypointGuideScheduleSendCommand(input: Readonly<{
  expectedRevision: unknown;
  operationId: unknown;
  relationshipId: unknown;
  suggestedWaypointId: unknown;
}>): SuggestedWaypointGuideScheduleSendCommand | null {
  if (!validBaseInput(input)) {
    return null;
  }
  const snapshot = JSON.stringify({
    kind: "guide.schedule_send",
    operationId: input.operationId,
    suggestedWaypointId: input.suggestedWaypointId,
    expectedRevision: input.expectedRevision,
  });
  return Object.freeze({
    kind: "guide.schedule_send",
    expectedRevision: input.expectedRevision,
    operationId: input.operationId,
    relationshipId: input.relationshipId,
    snapshot,
    suggestedWaypointId: input.suggestedWaypointId,
    url: `/guide/waypoint-suggestions/${encodeURIComponent(input.relationshipId)}/commands`,
  });
}

export async function submitSuggestedWaypointGuideCommand(
  command: SuggestedWaypointGuideCommand,
  permittedExpectedOutcomes: readonly SuggestedWaypointCommandExpectedOutcome[],
  signal: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<SuggestedWaypointGuideCommandSubmission> {
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
      permittedExpectedOutcomes,
    );
    return result === null ||
      (result.ok && result.suggestedWaypointId !== command.suggestedWaypointId)
      ? Object.freeze({ kind: "transport_uncertain", result: null })
      : Object.freeze({ kind: "conclusive", result });
  } catch {
    return Object.freeze({ kind: "transport_uncertain", result: null });
  }
}

export async function submitSuggestedWaypointGuidePullBackCommand(
  command: SuggestedWaypointGuidePullBackCommand,
  signal: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<SuggestedWaypointGuidePullBackSubmission> {
  return submitSuggestedWaypointGuideCommand(
    command,
    SUGGESTED_WAYPOINT_GUIDE_PULL_BACK_OUTCOMES,
    signal,
    fetcher,
  );
}
