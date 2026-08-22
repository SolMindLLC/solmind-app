// PRJ01_V-WS05-WI022-S03 browser-safe Guide Suggested Waypoint detail.
//
// The authenticated server route remains authoritative. This exact parser
// rejects widened, malformed, or lifecycle-incoherent detail before it reaches
// the Guide UI. Explorer-private engagement and Waypoint data are not part of
// this contract.

import {
  SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
  SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED,
  parseSuggestedWaypointGuideListBrowserResult,
  type SuggestedWaypointGuideListItem,
} from "./suggestedWaypointGuideListBrowserContract";
import { snapshotSuggestedWaypointGuideDraftContent } from "./suggestedWaypointGuideDraftContentBrowserContract";

export const SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED =
  SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED;
export const SUGGESTED_WAYPOINT_GUIDE_DETAIL_FAILED =
  SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED;

export type SuggestedWaypointGuideDetail = SuggestedWaypointGuideListItem &
  Readonly<{
    draft_or_pending_destination: string | null;
    draft_or_pending_why: string | null;
    draft_or_pending_arrival_signals: readonly string[] | null;
    delivered_destination: string | null;
    delivered_why: string | null;
    delivered_arrival_signals: readonly string[] | null;
    pending_version_id: string | null;
    policy_key: "suggested_waypoint_send_grace_seconds" | null;
    policy_version: number | null;
    effective_seconds: number | null;
  }>;

export type SuggestedWaypointGuideDetailBrowserResult =
  | Readonly<{ ok: true; data: SuggestedWaypointGuideDetail; error: null }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED
        | typeof SUGGESTED_WAYPOINT_GUIDE_DETAIL_FAILED;
    }>;

const DETAIL_KEYS = Object.freeze([
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
] as const);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIST_KEYS = Object.freeze([
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
] as const);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function listProjection(value: Record<string, unknown>): SuggestedWaypointGuideListItem | null {
  const projected: Record<string, unknown> = {};
  for (const key of LIST_KEYS) {
    projected[key] = value[key];
  }
  const parsed = parseSuggestedWaypointGuideListBrowserResult({
    ok: true,
    data: { items: [projected], next_cursor: null, total_count: 1 },
    error: null,
  });
  return parsed?.ok ? parsed.data.items[0] ?? null : null;
}

function parseDetail(value: unknown): SuggestedWaypointGuideDetail | null {
  if (!isPlainObject(value) || !hasExactKeys(value, DETAIL_KEYS)) {
    return null;
  }
  const base = listProjection(value);
  if (
    base === null ||
    (value.pending_version_id !== null && !isUuid(value.pending_version_id)) ||
    (value.policy_key !== null &&
      value.policy_key !== "suggested_waypoint_send_grace_seconds") ||
    (value.policy_version !== null &&
      (!Number.isSafeInteger(value.policy_version) ||
        Number(value.policy_version) < 1)) ||
    (value.effective_seconds !== null &&
      (!Number.isSafeInteger(value.effective_seconds) ||
        Number(value.effective_seconds) < 60 ||
        Number(value.effective_seconds) > 3600))
  ) {
    return null;
  }

  const privateContentPresent =
    value.draft_or_pending_destination !== null &&
    value.draft_or_pending_why !== null &&
    value.draft_or_pending_arrival_signals !== null;
  const privateContentAbsent =
    value.draft_or_pending_destination === null &&
    value.draft_or_pending_why === null &&
    value.draft_or_pending_arrival_signals === null;
  const deliveredContentPresent =
    value.delivered_destination !== null &&
    value.delivered_why !== null &&
    value.delivered_arrival_signals !== null;
  const deliveredContentAbsent =
    value.delivered_destination === null &&
    value.delivered_why === null &&
    value.delivered_arrival_signals === null;
  const privateContent = privateContentPresent
    ? snapshotSuggestedWaypointGuideDraftContent({
        destination: value.draft_or_pending_destination,
        why: value.draft_or_pending_why,
        arrivalSignals: value.draft_or_pending_arrival_signals,
      })
    : null;
  const deliveredContent = deliveredContentPresent
    ? snapshotSuggestedWaypointGuideDraftContent({
        destination: value.delivered_destination,
        why: value.delivered_why,
        arrivalSignals: value.delivered_arrival_signals,
      })
    : null;
  const deliveredContentCoherent =
    (base.current_version_id === null && deliveredContentAbsent) ||
    (base.current_version_id !== null && deliveredContentPresent && deliveredContent?.ok === true);
  const policyPresent =
    value.policy_key === "suggested_waypoint_send_grace_seconds" &&
    value.policy_version !== null &&
    value.effective_seconds !== null;
  const policyAbsent =
    value.policy_key === null &&
    value.policy_version === null &&
    value.effective_seconds === null;

  const coherent =
    (privateContentAbsent || privateContent?.ok === true) &&
    deliveredContentCoherent &&
    (base.authoring_mode === "draft"
      ? value.pending_version_id === null && privateContentPresent && policyAbsent
      : base.authoring_mode === "pending"
        ? isUuid(value.pending_version_id) && privateContentPresent && policyPresent
        : value.pending_version_id === null &&
          privateContentAbsent &&
          deliveredContentPresent &&
          policyAbsent);
  if (!coherent) {
    return null;
  }

  return Object.freeze({
    ...base,
    draft_or_pending_destination: privateContent?.ok ? privateContent.data.destination : null,
    draft_or_pending_why: privateContent?.ok ? privateContent.data.why : null,
    draft_or_pending_arrival_signals: privateContent?.ok
      ? privateContent.data.arrivalSignals
      : null,
    delivered_destination: deliveredContent?.ok ? deliveredContent.data.destination : null,
    delivered_why: deliveredContent?.ok ? deliveredContent.data.why : null,
    delivered_arrival_signals: deliveredContent?.ok
      ? deliveredContent.data.arrivalSignals
      : null,
    pending_version_id: value.pending_version_id as string | null,
    policy_key: value.policy_key as SuggestedWaypointGuideDetail["policy_key"],
    policy_version: value.policy_version as number | null,
    effective_seconds: value.effective_seconds as number | null,
  });
}

export function parseSuggestedWaypointGuideDetailBrowserResult(
  value: unknown,
): SuggestedWaypointGuideDetailBrowserResult | null {
  if (!isPlainObject(value) || !hasExactKeys(value, ["ok", "data", "error"])) {
    return null;
  }
  if (value.ok === false) {
    if (
      value.data !== null ||
      (value.error !== SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED &&
        value.error !== SUGGESTED_WAYPOINT_GUIDE_DETAIL_FAILED)
    ) {
      return null;
    }
    return Object.freeze({ ok: false, data: null, error: value.error });
  }
  if (value.ok !== true || value.error !== null) {
    return null;
  }
  const detail = parseDetail(value.data);
  return detail === null
    ? null
    : Object.freeze({ ok: true, data: detail, error: null });
}
