// PRJ01_V-WS05-WI022-S03 closed Suggested Waypoint RPC contract.
//
// This module validates the exact nine human calls and one worker call released
// for the first authenticated thin path. It deliberately omits the dormant
// Admin operational query and stays off the shared Supabase barrel.

import "server-only";

import {
  isSuggestedWaypointOptionalCursor,
  isSuggestedWaypointPageSize,
  type SuggestedWaypointPageSize,
} from "../suggestedWaypointPaginationSharedContract";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: suggestedWaypointRpcContract must not be imported in browser code.",
  );
}

export const SUGGESTED_WAYPOINT_HUMAN_RPC_FUNCTIONS = [
  "solmind_save_suggested_waypoint_draft",
  "solmind_schedule_suggested_waypoint_send",
  "solmind_pull_back_suggested_waypoint",
  "solmind_mark_suggested_waypoint_read",
  "solmind_acknowledge_suggested_waypoint_receipt",
  "solmind_list_guide_suggested_waypoints",
  "solmind_get_guide_suggested_waypoint",
  "solmind_list_explorer_suggested_waypoints",
  "solmind_get_explorer_suggested_waypoint",
] as const;

export const SUGGESTED_WAYPOINT_WORKER_RPC_FUNCTIONS = [
  "solmind_deliver_suggested_waypoint",
] as const;

export type SuggestedWaypointHumanRpcFunction =
  (typeof SUGGESTED_WAYPOINT_HUMAN_RPC_FUNCTIONS)[number];
export type SuggestedWaypointWorkerRpcFunction =
  (typeof SUGGESTED_WAYPOINT_WORKER_RPC_FUNCTIONS)[number];
export type SuggestedWaypointRpcFunction =
  | SuggestedWaypointHumanRpcFunction
  | SuggestedWaypointWorkerRpcFunction;

type SaveDraftArgs = Readonly<{
  p_actor_user_account_id: string;
  p_operation_id: string;
  p_guide_explorer_relationship_id: string;
  p_suggested_waypoint_id: string;
  p_expected_revision: number;
  p_destination: string;
  p_why: string;
  p_arrival_signals: readonly string[];
}>;

type ScheduleSendArgs = Readonly<{
  p_actor_user_account_id: string;
  p_operation_id: string;
  p_suggested_waypoint_id: string;
  p_suggested_waypoint_version_id: string;
  p_expected_revision: number;
}>;

type PullBackArgs = Readonly<{
  p_actor_user_account_id: string;
  p_operation_id: string;
  p_suggested_waypoint_id: string;
  p_expected_revision: number;
  p_expected_pending_version_id: string;
}>;

type DeliverArgs = Readonly<{
  p_operation_id: string;
  p_suggested_waypoint_id: string;
  p_expected_pending_version_id: string;
}>;

type MarkReadArgs = Readonly<{
  p_actor_user_account_id: string;
  p_operation_id: string;
  p_suggested_waypoint_id: string;
  p_version_id: string;
}>;

type AcknowledgeArgs = Readonly<{
  p_actor_user_account_id: string;
  p_operation_id: string;
  p_suggested_waypoint_id: string;
  p_expected_current_version_id: string;
}>;

type ListGuideArgs = Readonly<{
  p_actor_user_account_id: string;
  p_guide_explorer_relationship_id: string;
  p_page_size: 5 | 10 | 20 | 50 | 100;
  p_cursor: string | null;
}>;

type GetGuideArgs = Readonly<{
  p_actor_user_account_id: string;
  p_guide_explorer_relationship_id: string;
  p_suggested_waypoint_id: string;
}>;

type ListExplorerArgs = Readonly<{
  p_actor_user_account_id: string;
  p_page_size: 5 | 10 | 20 | 50 | 100;
  p_cursor: string | null;
}>;

type GetExplorerArgs = Readonly<{
  p_actor_user_account_id: string;
  p_suggested_waypoint_id: string;
}>;

export type SuggestedWaypointHumanRpcCall =
  | Readonly<{
      functionName: "solmind_save_suggested_waypoint_draft";
      args: SaveDraftArgs;
    }>
  | Readonly<{
      functionName: "solmind_schedule_suggested_waypoint_send";
      args: ScheduleSendArgs;
    }>
  | Readonly<{
      functionName: "solmind_pull_back_suggested_waypoint";
      args: PullBackArgs;
    }>
  | Readonly<{
      functionName: "solmind_mark_suggested_waypoint_read";
      args: MarkReadArgs;
    }>
  | Readonly<{
      functionName: "solmind_acknowledge_suggested_waypoint_receipt";
      args: AcknowledgeArgs;
    }>
  | Readonly<{
      functionName: "solmind_list_guide_suggested_waypoints";
      args: ListGuideArgs;
    }>
  | Readonly<{
      functionName: "solmind_get_guide_suggested_waypoint";
      args: GetGuideArgs;
    }>
  | Readonly<{
      functionName: "solmind_list_explorer_suggested_waypoints";
      args: ListExplorerArgs;
    }>
  | Readonly<{
      functionName: "solmind_get_explorer_suggested_waypoint";
      args: GetExplorerArgs;
    }>;

export type SuggestedWaypointWorkerRpcCall = Readonly<{
  functionName: "solmind_deliver_suggested_waypoint";
  args: DeliverArgs;
}>;

export type SuggestedWaypointRpcCall =
  | SuggestedWaypointHumanRpcCall
  | SuggestedWaypointWorkerRpcCall;

export const SUGGESTED_WAYPOINT_COMMAND_OUTCOMES = Object.freeze([
  "applied",
  "idempotent",
  "stale",
  "too_late",
  "invalid_transition",
  "relationship_unavailable",
  "policy_unavailable",
  "operation_conflict",
] as const);

export type SuggestedWaypointCommandOutcome =
  (typeof SUGGESTED_WAYPOINT_COMMAND_OUTCOMES)[number];

type SuggestedWaypointSaveDraftOutcome =
  | "applied"
  | "idempotent"
  | "invalid_transition"
  | "operation_conflict"
  | "relationship_unavailable"
  | "stale";

type SuggestedWaypointScheduleSendOutcome =
  | SuggestedWaypointSaveDraftOutcome
  | "policy_unavailable";

type SuggestedWaypointPullBackOutcome =
  | SuggestedWaypointSaveDraftOutcome
  | "too_late";

type SuggestedWaypointDeliverOutcome =
  | "applied"
  | "idempotent"
  | "invalid_transition"
  | "operation_conflict"
  | "relationship_unavailable"
  | "too_late";

type SuggestedWaypointMarkReadOutcome = Exclude<
  SuggestedWaypointDeliverOutcome,
  "too_late"
>;

type SuggestedWaypointAcknowledgeOutcome =
  | SuggestedWaypointMarkReadOutcome
  | "stale";

type SuggestedWaypointCommandCommonRow<
  TOutcome extends SuggestedWaypointCommandOutcome,
> = Readonly<{
  outcome_code: TOutcome;
  operation_id: string;
  suggested_waypoint_id: string | null;
  authoring_revision: number | null;
  current_version_id: string | null;
  committed_at: string | null;
}>;

export type SuggestedWaypointSaveDraftCommandRow =
  SuggestedWaypointCommandCommonRow<SuggestedWaypointSaveDraftOutcome> &
    Readonly<{
      draft_saved_at: string | null;
    }>;

export type SuggestedWaypointScheduleSendCommandRow =
  SuggestedWaypointCommandCommonRow<SuggestedWaypointScheduleSendOutcome> &
    Readonly<{
      pending_version_id: string | null;
      deadline_at: string | null;
      policy_key: "suggested_waypoint_send_grace_seconds" | null;
      policy_version: number | null;
      effective_seconds: number | null;
    }>;

export type SuggestedWaypointPullBackCommandRow =
  SuggestedWaypointCommandCommonRow<SuggestedWaypointPullBackOutcome> &
    Readonly<{
      draft_restored_at: string | null;
    }>;

export type SuggestedWaypointDeliverCommandRow =
  SuggestedWaypointCommandCommonRow<SuggestedWaypointDeliverOutcome> &
    Readonly<{
      delivered_version_id: string | null;
      delivered_at: string | null;
    }>;

export type SuggestedWaypointMarkReadCommandRow =
  SuggestedWaypointCommandCommonRow<SuggestedWaypointMarkReadOutcome> &
    Readonly<{
      read_at: string | null;
    }>;

export type SuggestedWaypointAcknowledgeCommandRow =
  SuggestedWaypointCommandCommonRow<SuggestedWaypointAcknowledgeOutcome> &
    Readonly<{
      acknowledged_version_id: string | null;
      acknowledged_at: string | null;
    }>;

export type SuggestedWaypointCommandRow =
  | SuggestedWaypointSaveDraftCommandRow
  | SuggestedWaypointScheduleSendCommandRow
  | SuggestedWaypointPullBackCommandRow
  | SuggestedWaypointDeliverCommandRow
  | SuggestedWaypointMarkReadCommandRow
  | SuggestedWaypointAcknowledgeCommandRow;

export type GuideSuggestedWaypointListItem = Readonly<{
  suggested_waypoint_id: string;
  authoring_mode: "draft" | "pending" | "delivered";
  authoring_revision: number;
  destination_preview: string;
  pending_deadline_at: string | null;
  pull_back_available: boolean;
  channel_category: "not_delivered" | "pending" | "open";
  current_version_id: string | null;
  delivered_at: string | null;
  acknowledged_version_id: string | null;
  acknowledged_at: string | null;
}>;

export type ExplorerSuggestedWaypointListItem = Readonly<{
  suggested_waypoint_id: string;
  current_version_id: string;
  destination_preview: string;
  received_at: string;
  read: boolean;
  receipt_acknowledged: boolean;
  acknowledged_at: string | null;
  channel_category: "open";
}>;

export type SuggestedWaypointListRow = Readonly<{
  items: readonly (
    | GuideSuggestedWaypointListItem
    | ExplorerSuggestedWaypointListItem
  )[];
  next_cursor: string | null;
  total_count: number;
}>;

export type GuideSuggestedWaypointDetailRow = Readonly<{
  suggested_waypoint_id: string;
  authoring_mode: "draft" | "pending" | "delivered";
  authoring_revision: number;
  destination_preview: string;
  pending_deadline_at: string | null;
  pull_back_available: boolean;
  channel_category: "not_delivered" | "pending" | "open";
  current_version_id: string | null;
  pending_version_id: string | null;
  delivered_at: string | null;
  acknowledged_version_id: string | null;
  acknowledged_at: string | null;
  draft_or_pending_destination: string | null;
  draft_or_pending_why: string | null;
  draft_or_pending_arrival_signals: readonly string[] | null;
  delivered_destination: string | null;
  delivered_why: string | null;
  delivered_arrival_signals: readonly string[] | null;
  policy_key: string | null;
  policy_version: number | null;
  effective_seconds: number | null;
}>;

export type ExplorerSuggestedWaypointDetailRow = Readonly<{
  suggested_waypoint_id: string;
  current_version_id: string;
  destination: string;
  why: string;
  arrival_signals: readonly string[];
  received_at: string;
  read: boolean;
  read_at: string | null;
  receipt_acknowledged: boolean;
  acknowledged_at: string | null;
  channel_category: "open";
}>;

export type SuggestedWaypointRpcPayload =
  | SuggestedWaypointCommandRow
  | SuggestedWaypointListRow
  | GuideSuggestedWaypointDetailRow
  | ExplorerSuggestedWaypointDetailRow;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 40 &&
    Number.isFinite(Date.parse(value))
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

function isPageSize(value: unknown): value is SuggestedWaypointPageSize {
  return isSuggestedWaypointPageSize(value);
}

function isExactCallEnvelope(value: unknown): value is {
  functionName: unknown;
  args: Record<string, unknown>;
} {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ["functionName", "args"]) &&
    isPlainObject(value.args)
  );
}

function allUuidArgs(
  args: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.every((key) => isUuid(args[key]));
}

export function validateSuggestedWaypointHumanRpcCall(
  value: unknown,
): SuggestedWaypointHumanRpcCall | null {
  if (!isExactCallEnvelope(value) || typeof value.functionName !== "string") {
    return null;
  }
  const args = value.args;
  switch (value.functionName) {
    case "solmind_save_suggested_waypoint_draft":
      if (
        !hasExactKeys(args, [
          "p_actor_user_account_id",
          "p_operation_id",
          "p_guide_explorer_relationship_id",
          "p_suggested_waypoint_id",
          "p_expected_revision",
          "p_destination",
          "p_why",
          "p_arrival_signals",
        ]) ||
        !allUuidArgs(args, [
          "p_actor_user_account_id",
          "p_operation_id",
          "p_guide_explorer_relationship_id",
          "p_suggested_waypoint_id",
        ]) ||
        !isSafeInteger(args.p_expected_revision) ||
        !isBoundedText(args.p_destination, 1, 160) ||
        !isBoundedText(args.p_why, 1, 1000) ||
        !isArrivalSignals(args.p_arrival_signals)
      ) {
        return null;
      }
      break;
    case "solmind_schedule_suggested_waypoint_send":
      if (
        !hasExactKeys(args, [
          "p_actor_user_account_id",
          "p_operation_id",
          "p_suggested_waypoint_id",
          "p_suggested_waypoint_version_id",
          "p_expected_revision",
        ]) ||
        !allUuidArgs(args, [
          "p_actor_user_account_id",
          "p_operation_id",
          "p_suggested_waypoint_id",
          "p_suggested_waypoint_version_id",
        ]) ||
        !isSafeInteger(args.p_expected_revision, 1)
      ) {
        return null;
      }
      break;
    case "solmind_pull_back_suggested_waypoint":
      if (
        !hasExactKeys(args, [
          "p_actor_user_account_id",
          "p_operation_id",
          "p_suggested_waypoint_id",
          "p_expected_revision",
          "p_expected_pending_version_id",
        ]) ||
        !allUuidArgs(args, [
          "p_actor_user_account_id",
          "p_operation_id",
          "p_suggested_waypoint_id",
          "p_expected_pending_version_id",
        ]) ||
        !isSafeInteger(args.p_expected_revision, 1)
      ) {
        return null;
      }
      break;
    case "solmind_mark_suggested_waypoint_read":
      if (
        !hasExactKeys(args, [
          "p_actor_user_account_id",
          "p_operation_id",
          "p_suggested_waypoint_id",
          "p_version_id",
        ]) ||
        !allUuidArgs(args, Object.keys(args))
      ) {
        return null;
      }
      break;
    case "solmind_acknowledge_suggested_waypoint_receipt":
      if (
        !hasExactKeys(args, [
          "p_actor_user_account_id",
          "p_operation_id",
          "p_suggested_waypoint_id",
          "p_expected_current_version_id",
        ]) ||
        !allUuidArgs(args, Object.keys(args))
      ) {
        return null;
      }
      break;
    case "solmind_list_guide_suggested_waypoints":
      if (
        !hasExactKeys(args, [
          "p_actor_user_account_id",
          "p_guide_explorer_relationship_id",
          "p_page_size",
          "p_cursor",
        ]) ||
        !allUuidArgs(args, [
          "p_actor_user_account_id",
          "p_guide_explorer_relationship_id",
        ]) ||
        !isPageSize(args.p_page_size) ||
        !isSuggestedWaypointOptionalCursor(args.p_cursor)
      ) {
        return null;
      }
      break;
    case "solmind_get_guide_suggested_waypoint":
      if (
        !hasExactKeys(args, [
          "p_actor_user_account_id",
          "p_guide_explorer_relationship_id",
          "p_suggested_waypoint_id",
        ]) ||
        !allUuidArgs(args, Object.keys(args))
      ) {
        return null;
      }
      break;
    case "solmind_list_explorer_suggested_waypoints":
      if (
        !hasExactKeys(args, [
          "p_actor_user_account_id",
          "p_page_size",
          "p_cursor",
        ]) ||
        !isUuid(args.p_actor_user_account_id) ||
        !isPageSize(args.p_page_size) ||
        !isSuggestedWaypointOptionalCursor(args.p_cursor)
      ) {
        return null;
      }
      break;
    case "solmind_get_explorer_suggested_waypoint":
      if (
        !hasExactKeys(args, [
          "p_actor_user_account_id",
          "p_suggested_waypoint_id",
        ]) ||
        !allUuidArgs(args, Object.keys(args))
      ) {
        return null;
      }
      break;
    default:
      return null;
  }
  return value as unknown as SuggestedWaypointHumanRpcCall;
}

export function validateSuggestedWaypointWorkerRpcCall(
  value: unknown,
): SuggestedWaypointWorkerRpcCall | null {
  if (
    !isExactCallEnvelope(value) ||
    value.functionName !== "solmind_deliver_suggested_waypoint" ||
    !hasExactKeys(value.args, [
      "p_operation_id",
      "p_suggested_waypoint_id",
      "p_expected_pending_version_id",
    ]) ||
    !allUuidArgs(value.args, Object.keys(value.args))
  ) {
    return null;
  }
  return value as unknown as SuggestedWaypointWorkerRpcCall;
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function hasPairedPresence(left: unknown, right: unknown): boolean {
  return (left === null) === (right === null);
}

function isGuideProjectionCoherent(value: Record<string, unknown>): boolean {
  if (
    !hasPairedPresence(value.current_version_id, value.delivered_at) ||
    !hasPairedPresence(value.acknowledged_version_id, value.acknowledged_at) ||
    (value.acknowledged_version_id !== null &&
      value.acknowledged_version_id !== value.current_version_id)
  ) {
    return false;
  }

  switch (value.authoring_mode) {
    case "draft":
      return (
        value.channel_category === "not_delivered" &&
        value.pending_deadline_at === null &&
        value.pull_back_available === false
      );
    case "pending":
      return (
        value.channel_category === "pending" &&
        value.pending_deadline_at !== null
      );
    case "delivered":
      return (
        value.channel_category === "open" &&
        value.pending_deadline_at === null &&
        value.pull_back_available === false &&
        value.current_version_id !== null &&
        value.delivered_at !== null
      );
    default:
      return false;
  }
}

function isExplorerEngagementCoherent(
  value: Record<string, unknown>,
  includeReadAt: boolean,
): boolean {
  if (
    typeof value.receipt_acknowledged !== "boolean" ||
    value.receipt_acknowledged !== (value.acknowledged_at !== null)
  ) {
    return false;
  }
  return (
    !includeReadAt ||
    (typeof value.read === "boolean" &&
      value.read === (value.read_at !== null))
  );
}

type SuggestedWaypointCommandRpcFunction =
  | "solmind_save_suggested_waypoint_draft"
  | "solmind_schedule_suggested_waypoint_send"
  | "solmind_pull_back_suggested_waypoint"
  | "solmind_deliver_suggested_waypoint"
  | "solmind_mark_suggested_waypoint_read"
  | "solmind_acknowledge_suggested_waypoint_receipt";

const COMMAND_OUTCOMES_BY_FUNCTION: Readonly<
  Record<SuggestedWaypointCommandRpcFunction, ReadonlySet<SuggestedWaypointCommandOutcome>>
> = Object.freeze({
  solmind_save_suggested_waypoint_draft: new Set<SuggestedWaypointCommandOutcome>([
    "applied",
    "idempotent",
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "stale",
  ]),
  solmind_schedule_suggested_waypoint_send: new Set<SuggestedWaypointCommandOutcome>([
    "applied",
    "idempotent",
    "invalid_transition",
    "operation_conflict",
    "policy_unavailable",
    "relationship_unavailable",
    "stale",
  ]),
  solmind_pull_back_suggested_waypoint: new Set<SuggestedWaypointCommandOutcome>([
    "applied",
    "idempotent",
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "stale",
    "too_late",
  ]),
  solmind_deliver_suggested_waypoint: new Set<SuggestedWaypointCommandOutcome>([
    "applied",
    "idempotent",
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "too_late",
  ]),
  solmind_mark_suggested_waypoint_read: new Set<SuggestedWaypointCommandOutcome>([
    "applied",
    "idempotent",
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
  ]),
  solmind_acknowledge_suggested_waypoint_receipt: new Set<SuggestedWaypointCommandOutcome>([
    "applied",
    "idempotent",
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "stale",
  ]),
});

function isCommandOutcome(
  value: unknown,
): value is SuggestedWaypointCommandOutcome {
  return (
    typeof value === "string" &&
    (SUGGESTED_WAYPOINT_COMMAND_OUTCOMES as readonly string[]).includes(value)
  );
}

function isCommittedOutcome(
  value: unknown,
): value is "applied" | "idempotent" {
  return value === "applied" || value === "idempotent";
}

function hasValidCommonCommandValues(
  value: Record<string, unknown>,
): boolean {
  if (!isCommandOutcome(value.outcome_code) || !isUuid(value.operation_id)) {
    return false;
  }

  switch (value.outcome_code) {
    case "relationship_unavailable":
      return (
        value.suggested_waypoint_id === null &&
        value.authoring_revision === null &&
        value.current_version_id === null &&
        value.committed_at === null
      );
    case "operation_conflict":
      return (
        isUuid(value.suggested_waypoint_id) &&
        value.authoring_revision === null &&
        value.current_version_id === null &&
        value.committed_at === null
      );
    case "policy_unavailable":
      return (
        isUuid(value.suggested_waypoint_id) &&
        isSafeInteger(value.authoring_revision, 1) &&
        value.current_version_id === null &&
        value.committed_at === null
      );
    case "stale":
    case "too_late":
    case "invalid_transition":
      return (
        isUuid(value.suggested_waypoint_id) &&
        isSafeInteger(value.authoring_revision, 1) &&
        isNullableUuid(value.current_version_id) &&
        value.committed_at === null
      );
    case "applied":
    case "idempotent":
      return (
        isUuid(value.suggested_waypoint_id) &&
        isSafeInteger(value.authoring_revision, 1) &&
        isNullableUuid(value.current_version_id) &&
        isTimestamp(value.committed_at)
      );
  }
}

function isCommandRow(
  value: unknown,
  functionName: SuggestedWaypointCommandRpcFunction,
  extraKeys: readonly string[],
): value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    return false;
  }
  if (
    !hasExactKeys(value, [
      "outcome_code",
      "operation_id",
      "suggested_waypoint_id",
      "authoring_revision",
      "current_version_id",
      "committed_at",
      ...extraKeys,
    ])
  ) {
    return false;
  }
  return (
    isCommandOutcome(value.outcome_code) &&
    COMMAND_OUTCOMES_BY_FUNCTION[functionName].has(value.outcome_code) &&
    hasValidCommonCommandValues(value)
  );
}

function allExtensionsAreNull(
  value: Record<string, unknown>,
  extraKeys: readonly string[],
): boolean {
  return extraKeys.every((key) => value[key] === null);
}

function isGuideListItem(value: unknown): value is GuideSuggestedWaypointListItem {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, [
      "suggested_waypoint_id",
      "authoring_mode",
      "authoring_revision",
      "destination_preview",
      "pending_deadline_at",
      "pull_back_available",
      "channel_category",
      "current_version_id",
      "delivered_at",
      "acknowledged_version_id",
      "acknowledged_at",
    ])
  ) {
    return false;
  }
  return (
    isUuid(value.suggested_waypoint_id) &&
    ["draft", "pending", "delivered"].includes(String(value.authoring_mode)) &&
    isSafeInteger(value.authoring_revision, 1) &&
    isBoundedText(value.destination_preview, 1, 160) &&
    isNullableTimestamp(value.pending_deadline_at) &&
    typeof value.pull_back_available === "boolean" &&
    ["not_delivered", "pending", "open"].includes(
      String(value.channel_category),
    ) &&
    isNullableUuid(value.current_version_id) &&
    isNullableTimestamp(value.delivered_at) &&
    isNullableUuid(value.acknowledged_version_id) &&
    isNullableTimestamp(value.acknowledged_at) &&
    isGuideProjectionCoherent(value)
  );
}

function isExplorerListItem(
  value: unknown,
): value is ExplorerSuggestedWaypointListItem {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, [
      "suggested_waypoint_id",
      "current_version_id",
      "destination_preview",
      "received_at",
      "read",
      "receipt_acknowledged",
      "acknowledged_at",
      "channel_category",
    ])
  ) {
    return false;
  }
  return (
    isUuid(value.suggested_waypoint_id) &&
    isUuid(value.current_version_id) &&
    isBoundedText(value.destination_preview, 1, 160) &&
    isTimestamp(value.received_at) &&
    typeof value.read === "boolean" &&
    typeof value.receipt_acknowledged === "boolean" &&
    isNullableTimestamp(value.acknowledged_at) &&
    value.channel_category === "open" &&
    isExplorerEngagementCoherent(value, false)
  );
}

function isListRow(value: unknown, role: "guide" | "explorer"): boolean {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, ["items", "next_cursor", "total_count"]) ||
    !Array.isArray(value.items) ||
    !isSuggestedWaypointOptionalCursor(value.next_cursor) ||
    !isSafeInteger(value.total_count) ||
    value.total_count < value.items.length ||
    (value.next_cursor !== null && value.total_count <= value.items.length)
  ) {
    return false;
  }
  return value.items.every((item) =>
    role === "guide" ? isGuideListItem(item) : isExplorerListItem(item),
  );
}

function isNullableBoundedText(
  value: unknown,
  maximum: number,
): value is string | null {
  return value === null || isBoundedText(value, 1, maximum);
}

function isNullableSignals(value: unknown): value is readonly string[] | null {
  return value === null || isArrivalSignals(value);
}

function isGuideDetailRow(value: unknown): boolean {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, [
      "suggested_waypoint_id",
      "authoring_mode",
      "authoring_revision",
      "destination_preview",
      "pending_deadline_at",
      "pull_back_available",
      "channel_category",
      "current_version_id",
      "pending_version_id",
      "delivered_at",
      "acknowledged_version_id",
      "acknowledged_at",
      "draft_or_pending_destination",
      "draft_or_pending_why",
      "draft_or_pending_arrival_signals",
      "delivered_destination",
      "delivered_why",
      "delivered_arrival_signals",
      "policy_key",
      "policy_version",
      "effective_seconds",
    ]) ||
    !isGuideListItem({
      suggested_waypoint_id: value.suggested_waypoint_id,
      authoring_mode: value.authoring_mode,
      authoring_revision: value.authoring_revision,
      destination_preview: value.destination_preview,
      pending_deadline_at: value.pending_deadline_at,
      pull_back_available: value.pull_back_available,
      channel_category: value.channel_category,
      current_version_id: value.current_version_id,
      delivered_at: value.delivered_at,
      acknowledged_version_id: value.acknowledged_version_id,
      acknowledged_at: value.acknowledged_at,
    })
  ) {
    return false;
  }
  const shapeIsValid = (
    (value.pending_version_id === null || isUuid(value.pending_version_id)) &&
    isNullableBoundedText(value.draft_or_pending_destination, 160) &&
    isNullableBoundedText(value.draft_or_pending_why, 1000) &&
    isNullableSignals(value.draft_or_pending_arrival_signals) &&
    isNullableBoundedText(value.delivered_destination, 160) &&
    isNullableBoundedText(value.delivered_why, 1000) &&
    isNullableSignals(value.delivered_arrival_signals) &&
    (value.policy_key === null ||
      value.policy_key === "suggested_waypoint_send_grace_seconds") &&
    (value.policy_version === null || isSafeInteger(value.policy_version, 1)) &&
    (value.effective_seconds === null ||
      (isSafeInteger(value.effective_seconds, 60) &&
        value.effective_seconds <= 3600))
  );
  if (!shapeIsValid) {
    return false;
  }

  const draftOrPendingPresent =
    value.draft_or_pending_destination !== null &&
    value.draft_or_pending_why !== null &&
    value.draft_or_pending_arrival_signals !== null;
  const draftOrPendingAbsent =
    value.draft_or_pending_destination === null &&
    value.draft_or_pending_why === null &&
    value.draft_or_pending_arrival_signals === null;
  const deliveredPresent =
    value.delivered_destination !== null &&
    value.delivered_why !== null &&
    value.delivered_arrival_signals !== null;
  const deliveredAbsent =
    value.delivered_destination === null &&
    value.delivered_why === null &&
    value.delivered_arrival_signals === null;
  const policyPresent =
    value.policy_key === "suggested_waypoint_send_grace_seconds" &&
    value.policy_version !== null &&
    value.effective_seconds !== null;
  const policyAbsent =
    value.policy_key === null &&
    value.policy_version === null &&
    value.effective_seconds === null;
  const deliveredContentCoherent =
    (value.current_version_id === null && deliveredAbsent) ||
    (value.current_version_id !== null && deliveredPresent);

  if (
    (!draftOrPendingPresent && !draftOrPendingAbsent) ||
    (!deliveredPresent && !deliveredAbsent)
  ) {
    return false;
  }

  switch (value.authoring_mode) {
    case "draft":
      return (
        value.pending_version_id === null &&
        draftOrPendingPresent &&
        deliveredContentCoherent &&
        policyAbsent
      );
    case "pending":
      return (
        isUuid(value.pending_version_id) &&
        draftOrPendingPresent &&
        deliveredContentCoherent &&
        policyPresent
      );
    case "delivered":
      return (
        value.pending_version_id === null &&
        draftOrPendingAbsent &&
        deliveredPresent &&
        policyAbsent
      );
    default:
      return false;
  }
}

function isExplorerDetailRow(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, [
      "suggested_waypoint_id",
      "current_version_id",
      "destination",
      "why",
      "arrival_signals",
      "received_at",
      "read",
      "read_at",
      "receipt_acknowledged",
      "acknowledged_at",
      "channel_category",
    ]) &&
    isUuid(value.suggested_waypoint_id) &&
    isUuid(value.current_version_id) &&
    isBoundedText(value.destination, 1, 160) &&
    isBoundedText(value.why, 1, 1000) &&
    isArrivalSignals(value.arrival_signals) &&
    isTimestamp(value.received_at) &&
    typeof value.read === "boolean" &&
    isNullableTimestamp(value.read_at) &&
    typeof value.receipt_acknowledged === "boolean" &&
    isNullableTimestamp(value.acknowledged_at) &&
    value.channel_category === "open" &&
    isExplorerEngagementCoherent(value, true)
  );
}

function deepFrozenCopy<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFrozenCopy(item))) as T;
  }
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      copy[key] = deepFrozenCopy(nested);
    }
    return Object.freeze(copy) as T;
  }
  return value;
}

export function validateSuggestedWaypointRpcPayload(
  functionName: SuggestedWaypointRpcFunction,
  data: unknown,
): SuggestedWaypointRpcPayload | null {
  if (!Array.isArray(data) || data.length !== 1) {
    return null;
  }
  const row: unknown = data[0];
  let valid = false;
  switch (functionName) {
    case "solmind_save_suggested_waypoint_draft":
      valid =
        isCommandRow(row, functionName, ["draft_saved_at"]) &&
        (isCommittedOutcome(row.outcome_code)
          ? isTimestamp(row.draft_saved_at) &&
            row.draft_saved_at === row.committed_at &&
            (row.outcome_code === "idempotent" ||
              row.current_version_id === null)
          : row.draft_saved_at === null);
      break;
    case "solmind_schedule_suggested_waypoint_send":
      valid =
        isCommandRow(row, functionName, [
          "pending_version_id",
          "deadline_at",
          "policy_key",
          "policy_version",
          "effective_seconds",
        ]) &&
        (isCommittedOutcome(row.outcome_code)
          ? isUuid(row.pending_version_id) &&
            isTimestamp(row.deadline_at) &&
            row.policy_key === "suggested_waypoint_send_grace_seconds" &&
            isSafeInteger(row.policy_version, 1) &&
            isSafeInteger(row.effective_seconds, 60) &&
            row.effective_seconds <= 3600 &&
            (row.outcome_code === "idempotent" ||
              row.current_version_id === null)
          : allExtensionsAreNull(row, [
              "pending_version_id",
              "deadline_at",
              "policy_key",
              "policy_version",
              "effective_seconds",
            ]));
      break;
    case "solmind_pull_back_suggested_waypoint":
      valid =
        isCommandRow(row, functionName, ["draft_restored_at"]) &&
        (isCommittedOutcome(row.outcome_code)
          ? isTimestamp(row.draft_restored_at) &&
            row.draft_restored_at === row.committed_at &&
            (row.outcome_code === "idempotent" ||
              row.current_version_id === null)
          : row.draft_restored_at === null);
      break;
    case "solmind_deliver_suggested_waypoint":
      valid =
        isCommandRow(row, functionName, [
          "delivered_version_id",
          "delivered_at",
        ]) &&
        (isCommittedOutcome(row.outcome_code)
          ? isUuid(row.delivered_version_id) &&
            row.delivered_version_id === row.current_version_id &&
            isTimestamp(row.delivered_at) &&
            row.delivered_at === row.committed_at
          : allExtensionsAreNull(row, [
              "delivered_version_id",
              "delivered_at",
            ]));
      break;
    case "solmind_mark_suggested_waypoint_read":
      valid =
        isCommandRow(row, functionName, ["read_at"]) &&
        (isCommittedOutcome(row.outcome_code)
          ? isTimestamp(row.read_at) &&
            row.read_at === row.committed_at &&
            row.current_version_id !== null
          : row.read_at === null);
      break;
    case "solmind_acknowledge_suggested_waypoint_receipt":
      valid =
        isCommandRow(row, functionName, [
          "acknowledged_version_id",
          "acknowledged_at",
        ]) &&
        (isCommittedOutcome(row.outcome_code)
          ? isUuid(row.acknowledged_version_id) &&
            row.acknowledged_version_id === row.current_version_id &&
            isTimestamp(row.acknowledged_at) &&
            row.acknowledged_at === row.committed_at
          : allExtensionsAreNull(row, [
              "acknowledged_version_id",
              "acknowledged_at",
            ]));
      break;
    case "solmind_list_guide_suggested_waypoints":
      valid = isListRow(row, "guide");
      break;
    case "solmind_get_guide_suggested_waypoint":
      valid = isGuideDetailRow(row);
      break;
    case "solmind_list_explorer_suggested_waypoints":
      valid = isListRow(row, "explorer");
      break;
    case "solmind_get_explorer_suggested_waypoint":
      valid = isExplorerDetailRow(row);
      break;
  }
  return valid ? deepFrozenCopy(row as SuggestedWaypointRpcPayload) : null;
}

export function isSuggestedWaypointRpcPayloadBoundToCall(
  call: SuggestedWaypointRpcCall,
  payload: SuggestedWaypointRpcPayload,
): boolean {
  const row = payload as unknown as Record<string, unknown>;
  const args = call.args as unknown as Record<string, unknown>;

  const isCommand = "outcome_code" in row;
  const committed = isCommand && isCommittedOutcome(row.outcome_code);
  const commonCommandBinding =
    !isCommand ||
    (row.operation_id === args.p_operation_id &&
      (row.suggested_waypoint_id === null ||
        row.suggested_waypoint_id === args.p_suggested_waypoint_id));

  if (!commonCommandBinding) {
    return false;
  }

  switch (call.functionName) {
    case "solmind_save_suggested_waypoint_draft":
    case "solmind_pull_back_suggested_waypoint":
      return true;
    case "solmind_schedule_suggested_waypoint_send":
      return (
        !committed ||
        row.pending_version_id === args.p_suggested_waypoint_version_id
      );
    case "solmind_deliver_suggested_waypoint":
      return (
        !committed ||
        row.delivered_version_id === args.p_expected_pending_version_id
      );
    case "solmind_mark_suggested_waypoint_read":
      return !committed || row.current_version_id === args.p_version_id;
    case "solmind_acknowledge_suggested_waypoint_receipt":
      return (
        !committed ||
        row.acknowledged_version_id === args.p_expected_current_version_id
      );
    case "solmind_get_guide_suggested_waypoint":
    case "solmind_get_explorer_suggested_waypoint":
      return row.suggested_waypoint_id === args.p_suggested_waypoint_id;
    case "solmind_list_guide_suggested_waypoints":
    case "solmind_list_explorer_suggested_waypoints":
      return true;
  }
}
