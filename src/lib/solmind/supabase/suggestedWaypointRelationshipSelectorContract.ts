// PRJ01_V-WS05-WI022-S03 Suggested Waypoint relationship-selector contract.
//
// This server-only contract is deliberately feature-specific. It is not the
// canonical Guide Explorer roster and must not grow onboarding, appointment,
// Shared Snapshot, Practice, suggestion-count, or private Explorer fields.

import "server-only";

import {
  SUGGESTED_WAYPOINT_PAGE_SIZES,
  isSuggestedWaypointOptionalCursor,
  isSuggestedWaypointPageSize,
  type SuggestedWaypointPageSize,
} from "../suggestedWaypointPaginationSharedContract";

export const SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION =
  "solmind_list_guide_suggested_waypoint_relationships" as const;

export const SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_PAGE_SIZES =
  SUGGESTED_WAYPOINT_PAGE_SIZES;

export type SuggestedWaypointRelationshipSelectorPageSize =
  SuggestedWaypointPageSize;

export type SuggestedWaypointRelationshipSelectorRpcCall = Readonly<{
  functionName: typeof SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION;
  args: Readonly<{
    p_actor_user_account_id: string;
    p_page_size: SuggestedWaypointRelationshipSelectorPageSize;
    p_cursor: string | null;
  }>;
}>;

export type SuggestedWaypointRelationshipSelectorItem = Readonly<{
  guide_explorer_relationship_id: string;
  explorer_display_name: string;
  relationship_created_at: string;
}>;

export type SuggestedWaypointRelationshipSelectorPage = Readonly<{
  items: readonly SuggestedWaypointRelationshipSelectorItem[];
  next_cursor: string | null;
  total_count: number;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

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

function isPageSize(
  value: unknown,
): value is SuggestedWaypointRelationshipSelectorPageSize {
  return isSuggestedWaypointPageSize(value);
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

function isDisplayName(value: unknown): value is string {
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

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 40 &&
    RFC3339_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
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

export function validateSuggestedWaypointRelationshipSelectorRpcCall(
  value: unknown,
): SuggestedWaypointRelationshipSelectorRpcCall | null {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, ["functionName", "args"]) ||
    value.functionName !== SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION ||
    !isPlainObject(value.args) ||
    !hasExactKeys(value.args, [
      "p_actor_user_account_id",
      "p_page_size",
      "p_cursor",
    ]) ||
    !isUuid(value.args.p_actor_user_account_id) ||
    !isPageSize(value.args.p_page_size) ||
    !isSuggestedWaypointOptionalCursor(value.args.p_cursor)
  ) {
    return null;
  }

  return deepFrozenCopy(
    value as unknown as SuggestedWaypointRelationshipSelectorRpcCall,
  );
}

export function validateSuggestedWaypointRelationshipSelectorPayload(
  data: unknown,
): SuggestedWaypointRelationshipSelectorPage | null {
  if (!Array.isArray(data) || data.length !== 1) {
    return null;
  }
  const row: unknown = data[0];
  if (
    !isPlainObject(row) ||
    !hasExactKeys(row, ["items", "next_cursor", "total_count"]) ||
    !Array.isArray(row.items) ||
    !isSuggestedWaypointOptionalCursor(row.next_cursor) ||
    typeof row.total_count !== "number" ||
    !Number.isSafeInteger(row.total_count) ||
    row.total_count < row.items.length ||
    (row.next_cursor !== null && row.total_count <= row.items.length)
  ) {
    return null;
  }

  const seen = new Set<string>();
  for (const item of row.items) {
    if (
      !isPlainObject(item) ||
      !hasExactKeys(item, [
        "guide_explorer_relationship_id",
        "explorer_display_name",
        "relationship_created_at",
      ]) ||
      !isUuid(item.guide_explorer_relationship_id) ||
      seen.has(item.guide_explorer_relationship_id) ||
      !isDisplayName(item.explorer_display_name) ||
      !isTimestamp(item.relationship_created_at)
    ) {
      return null;
    }
    seen.add(item.guide_explorer_relationship_id);
  }

  return deepFrozenCopy(
    row as unknown as SuggestedWaypointRelationshipSelectorPage,
  );
}
