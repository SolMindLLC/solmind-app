// PRJ01_V-WS05-WI022-S03 browser-safe Guide Suggested Waypoint list.
//
// The authenticated server route remains authoritative. This exact parser
// prevents widened, malformed, duplicate, or lifecycle-incoherent response
// data from entering the Guide UI.

import {
  SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
  SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED,
  SUGGESTED_WAYPOINT_GUIDE_LIST_PAGE_SIZES,
  type SuggestedWaypointGuideListPageSize,
} from "./suggestedWaypointGuideListSharedContract";

export {
  SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
  SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED,
  SUGGESTED_WAYPOINT_GUIDE_LIST_PAGE_SIZES,
  type SuggestedWaypointGuideListPageSize,
};

export type SuggestedWaypointGuideListItem = Readonly<{
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

export type SuggestedWaypointGuideListPage = Readonly<{
  items: readonly SuggestedWaypointGuideListItem[];
  next_cursor: string | null;
  total_count: number;
}>;

export type SuggestedWaypointGuideListBrowserResult =
  | Readonly<{
      ok: true;
      data: SuggestedWaypointGuideListPage;
      error: null;
    }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED
        | typeof SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED;
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

export function isSuggestedWaypointId(value: unknown): value is string {
  return isUuid(value);
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
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

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function isLifecycleCoherent(value: Record<string, unknown>): boolean {
  if (
    (value.current_version_id === null) !== (value.delivered_at === null) ||
    (value.acknowledged_version_id === null) !==
      (value.acknowledged_at === null) ||
    (value.acknowledged_version_id !== null &&
      value.acknowledged_version_id !== value.current_version_id)
  ) {
    return false;
  }

  if (value.authoring_mode === "draft") {
    return (
      value.channel_category === "not_delivered" &&
      value.pending_deadline_at === null &&
      value.pull_back_available === false
    );
  }
  if (value.authoring_mode === "pending") {
    return (
      value.channel_category === "pending" &&
      value.pending_deadline_at !== null
    );
  }
  return (
    value.authoring_mode === "delivered" &&
    value.channel_category === "open" &&
    value.pending_deadline_at === null &&
    value.pull_back_available === false &&
    value.current_version_id !== null &&
    value.delivered_at !== null
  );
}

function parseItem(value: unknown): SuggestedWaypointGuideListItem | null {
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
    ]) ||
    !isUuid(value.suggested_waypoint_id) ||
    !["draft", "pending", "delivered"].includes(String(value.authoring_mode)) ||
    typeof value.authoring_revision !== "number" ||
    !Number.isSafeInteger(value.authoring_revision) ||
    value.authoring_revision < 1 ||
    !isDestinationPreview(value.destination_preview) ||
    !isNullableTimestamp(value.pending_deadline_at) ||
    typeof value.pull_back_available !== "boolean" ||
    !["not_delivered", "pending", "open"].includes(String(value.channel_category)) ||
    !isNullableUuid(value.current_version_id) ||
    !isNullableTimestamp(value.delivered_at) ||
    !isNullableUuid(value.acknowledged_version_id) ||
    !isNullableTimestamp(value.acknowledged_at) ||
    !isLifecycleCoherent(value)
  ) {
    return null;
  }

  return Object.freeze({
    suggested_waypoint_id: value.suggested_waypoint_id,
    authoring_mode: value.authoring_mode as SuggestedWaypointGuideListItem["authoring_mode"],
    authoring_revision: value.authoring_revision,
    destination_preview: value.destination_preview,
    pending_deadline_at: value.pending_deadline_at,
    pull_back_available: value.pull_back_available,
    channel_category: value.channel_category as SuggestedWaypointGuideListItem["channel_category"],
    current_version_id: value.current_version_id,
    delivered_at: value.delivered_at,
    acknowledged_version_id: value.acknowledged_version_id,
    acknowledged_at: value.acknowledged_at,
  });
}

export function parseSuggestedWaypointGuideListBrowserResult(
  value: unknown,
): SuggestedWaypointGuideListBrowserResult | null {
  if (!isPlainObject(value) || !hasExactKeys(value, ["ok", "data", "error"])) {
    return null;
  }

  if (value.ok === false) {
    if (
      value.data !== null ||
      (value.error !== SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED &&
        value.error !== SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED)
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

  const seen = new Set<string>();
  const items: SuggestedWaypointGuideListItem[] = [];
  for (const candidate of value.data.items) {
    const item = parseItem(candidate);
    if (item === null || seen.has(item.suggested_waypoint_id)) {
      return null;
    }
    seen.add(item.suggested_waypoint_id);
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

export function availableSuggestedWaypointGuideListPageSizes(
  totalCount: number,
): readonly SuggestedWaypointGuideListPageSize[] {
  if (!Number.isSafeInteger(totalCount) || totalCount <= 5) {
    return Object.freeze([]);
  }
  return Object.freeze(
    SUGGESTED_WAYPOINT_GUIDE_LIST_PAGE_SIZES.filter((size, index) =>
      index < 2 ? true : totalCount > size,
    ),
  );
}
