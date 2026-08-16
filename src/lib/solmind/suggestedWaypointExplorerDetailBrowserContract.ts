// PRJ01_V-WS05-WI022-S03 browser-safe Explorer Suggested Waypoint detail.
//
// The authenticated server route remains authoritative. This exact parser
// admits immutable delivered/current-version content plus Explorer-private
// engagement only. Guide authoring and operational data fail closed.

import {
  SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED,
  SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED,
  isSuggestedWaypointExplorerId,
} from "./suggestedWaypointExplorerListBrowserContract";

export const SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED =
  SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED;
export const SUGGESTED_WAYPOINT_EXPLORER_DETAIL_FAILED =
  SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED;

export type SuggestedWaypointExplorerDetail = Readonly<{
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

export type SuggestedWaypointExplorerDetailBrowserResult =
  | Readonly<{ ok: true; data: SuggestedWaypointExplorerDetail; error: null }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED
        | typeof SUGGESTED_WAYPOINT_EXPLORER_DETAIL_FAILED;
    }>;

const DETAIL_KEYS = Object.freeze([
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
] as const);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function hasForbiddenControl(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (
      code === 0 ||
      (code >= 1 && code <= 8) ||
      (code >= 11 && code <= 12) ||
      (code >= 14 && code <= 31) ||
      (code >= 127 && code <= 159)
    );
  });
}

function isBoundedText(value: unknown, maximum: number): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const length = Array.from(value).length;
  return (
    length >= 1 &&
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
    if (!isBoundedText(signal, 240) || seen.has(signal)) {
      return false;
    }
    seen.add(signal);
  }
  return true;
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 40 &&
    RFC3339_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function parseDetail(value: unknown): SuggestedWaypointExplorerDetail | null {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, DETAIL_KEYS) ||
    !isSuggestedWaypointExplorerId(value.suggested_waypoint_id) ||
    !isUuid(value.current_version_id) ||
    !isBoundedText(value.destination, 160) ||
    !isBoundedText(value.why, 1000) ||
    !isArrivalSignals(value.arrival_signals) ||
    !isTimestamp(value.received_at) ||
    typeof value.read !== "boolean" ||
    !isNullableTimestamp(value.read_at) ||
    value.read !== (value.read_at !== null) ||
    typeof value.receipt_acknowledged !== "boolean" ||
    !isNullableTimestamp(value.acknowledged_at) ||
    value.receipt_acknowledged !== (value.acknowledged_at !== null) ||
    value.channel_category !== "open"
  ) {
    return null;
  }

  const receivedMs = Date.parse(value.received_at);
  if (
    (value.read_at !== null && Date.parse(value.read_at) < receivedMs) ||
    (value.acknowledged_at !== null && Date.parse(value.acknowledged_at) < receivedMs)
  ) {
    return null;
  }

  return Object.freeze({
    suggested_waypoint_id: value.suggested_waypoint_id,
    current_version_id: value.current_version_id,
    destination: value.destination,
    why: value.why,
    arrival_signals: Object.freeze([...value.arrival_signals]),
    received_at: value.received_at,
    read: value.read,
    read_at: value.read_at,
    receipt_acknowledged: value.receipt_acknowledged,
    acknowledged_at: value.acknowledged_at,
    channel_category: "open",
  });
}

export function parseSuggestedWaypointExplorerDetailBrowserResult(
  value: unknown,
): SuggestedWaypointExplorerDetailBrowserResult | null {
  if (!isPlainObject(value) || !hasExactKeys(value, ["ok", "data", "error"])) {
    return null;
  }
  if (value.ok === false) {
    if (
      value.data !== null ||
      (value.error !== SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED &&
        value.error !== SUGGESTED_WAYPOINT_EXPLORER_DETAIL_FAILED)
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
