// PRJ01_V-WS05-WI022-S03 browser-safe Explorer Suggested Waypoint inbox.
//
// The authenticated server route remains authoritative. This exact parser
// admits delivered Explorer projection fields only and rejects Guide-only
// authoring, pending-send, policy, Pull Back, Assistant, or relationship data.

import {
  SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED,
  SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED,
  SUGGESTED_WAYPOINT_EXPLORER_LIST_PAGE_SIZES,
  type SuggestedWaypointExplorerListPageSize,
} from "./suggestedWaypointExplorerListSharedContract";

export {
  SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED,
  SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED,
  SUGGESTED_WAYPOINT_EXPLORER_LIST_PAGE_SIZES,
  type SuggestedWaypointExplorerListPageSize,
};

export type SuggestedWaypointExplorerListItem = Readonly<{
  suggested_waypoint_id: string;
  current_version_id: string;
  destination_preview: string;
  received_at: string;
  read: boolean;
  receipt_acknowledged: boolean;
  acknowledged_at: string | null;
  channel_category: "open";
}>;

export type SuggestedWaypointExplorerListPage = Readonly<{
  items: readonly SuggestedWaypointExplorerListItem[];
  next_cursor: string | null;
  total_count: number;
}>;

export type SuggestedWaypointExplorerListBrowserResult =
  | Readonly<{
      ok: true;
      data: SuggestedWaypointExplorerListPage;
      error: null;
    }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED
        | typeof SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED;
    }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const RFC3339_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isSuggestedWaypointExplorerId(value: unknown): value is string {
  return isUuid(value);
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

function isDestinationPreview(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const length = Array.from(value).length;
  return (
    length >= 1 &&
    length <= 160 &&
    value === value.trim() &&
    value === value.normalize("NFC") &&
    !value.includes("\r") &&
    !value.includes("\n") &&
    !hasForbiddenControl(value)
  );
}

function isCursor(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      value.length % 4 === 0 &&
      BASE64_PATTERN.test(value))
  );
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

function parseItem(value: unknown): SuggestedWaypointExplorerListItem | null {
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
    ]) ||
    !isUuid(value.suggested_waypoint_id) ||
    !isUuid(value.current_version_id) ||
    !isDestinationPreview(value.destination_preview) ||
    !isTimestamp(value.received_at) ||
    typeof value.read !== "boolean" ||
    typeof value.receipt_acknowledged !== "boolean" ||
    (value.acknowledged_at !== null && !isTimestamp(value.acknowledged_at)) ||
    value.receipt_acknowledged !== (value.acknowledged_at !== null) ||
    value.channel_category !== "open"
  ) {
    return null;
  }

  return Object.freeze({
    suggested_waypoint_id: value.suggested_waypoint_id,
    current_version_id: value.current_version_id,
    destination_preview: value.destination_preview,
    received_at: value.received_at,
    read: value.read,
    receipt_acknowledged: value.receipt_acknowledged,
    acknowledged_at: value.acknowledged_at,
    channel_category: "open",
  });
}

export function parseSuggestedWaypointExplorerListBrowserResult(
  value: unknown,
): SuggestedWaypointExplorerListBrowserResult | null {
  if (!isPlainObject(value) || !hasExactKeys(value, ["ok", "data", "error"])) {
    return null;
  }

  if (value.ok === false) {
    if (
      value.data !== null ||
      (value.error !== SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED &&
        value.error !== SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED)
    ) {
      return null;
    }
    return Object.freeze({ ok: false, data: null, error: value.error });
  }

  if (
    value.ok !== true ||
    value.error !== null ||
    !isPlainObject(value.data) ||
    !hasExactKeys(value.data, ["items", "next_cursor", "total_count"]) ||
    !Array.isArray(value.data.items) ||
    !isCursor(value.data.next_cursor) ||
    typeof value.data.total_count !== "number" ||
    !Number.isSafeInteger(value.data.total_count) ||
    value.data.total_count < value.data.items.length ||
    (value.data.next_cursor !== null &&
      value.data.total_count <= value.data.items.length)
  ) {
    return null;
  }

  const suggestionIds = new Set<string>();
  const versionIds = new Set<string>();
  const items: SuggestedWaypointExplorerListItem[] = [];
  for (const candidate of value.data.items) {
    const item = parseItem(candidate);
    if (
      item === null ||
      suggestionIds.has(item.suggested_waypoint_id) ||
      versionIds.has(item.current_version_id)
    ) {
      return null;
    }
    suggestionIds.add(item.suggested_waypoint_id);
    versionIds.add(item.current_version_id);
    items.push(item);
  }

  return Object.freeze({
    ok: true,
    data: Object.freeze({
      items: Object.freeze(items),
      next_cursor: value.data.next_cursor,
      total_count: value.data.total_count,
    }),
    error: null,
  });
}

export function availableSuggestedWaypointExplorerListPageSizes(
  totalCount: number,
): readonly SuggestedWaypointExplorerListPageSize[] {
  if (!Number.isSafeInteger(totalCount) || totalCount <= 5) {
    return Object.freeze([]);
  }
  return Object.freeze(
    SUGGESTED_WAYPOINT_EXPLORER_LIST_PAGE_SIZES.filter((size, index) =>
      index < 2 ? true : totalCount > size,
    ),
  );
}
