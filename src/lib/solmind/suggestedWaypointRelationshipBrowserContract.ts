// PRJ01_V-WS05-WI022-S03 browser-safe Suggested Waypoint relationship page.
//
// The server route remains authoritative. This narrow parser prevents a
// malformed or widened response from entering the Guide UI.

export const SUGGESTED_WAYPOINT_RELATIONSHIP_DENIED =
  "SolMind Suggested Waypoint relationships are unavailable." as const;
export const SUGGESTED_WAYPOINT_RELATIONSHIP_FAILED =
  "SolMind Suggested Waypoint relationships could not be loaded." as const;

export const SUGGESTED_WAYPOINT_RELATIONSHIP_PAGE_SIZES = Object.freeze([
  5, 10, 20, 50, 100,
] as const);

export type SuggestedWaypointRelationshipPageSize =
  (typeof SUGGESTED_WAYPOINT_RELATIONSHIP_PAGE_SIZES)[number];

export type SuggestedWaypointRelationshipBrowserItem = Readonly<{
  guide_explorer_relationship_id: string;
  explorer_display_name: string;
  relationship_created_at: string;
}>;

export type SuggestedWaypointRelationshipBrowserPage = Readonly<{
  items: readonly SuggestedWaypointRelationshipBrowserItem[];
  next_cursor: string | null;
  total_count: number;
}>;

export type SuggestedWaypointRelationshipBrowserResult =
  | Readonly<{
      ok: true;
      data: SuggestedWaypointRelationshipBrowserPage;
      error: null;
    }>
  | Readonly<{
      ok: false;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_RELATIONSHIP_DENIED
        | typeof SUGGESTED_WAYPOINT_RELATIONSHIP_FAILED;
    }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
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

export function isSuggestedWaypointRelationshipId(
  value: unknown,
): value is string {
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

function freezePage(
  page: SuggestedWaypointRelationshipBrowserPage,
): SuggestedWaypointRelationshipBrowserPage {
  return Object.freeze({
    items: Object.freeze(page.items.map((item) => Object.freeze({ ...item }))),
    next_cursor: page.next_cursor,
    total_count: page.total_count,
  });
}

export function parseSuggestedWaypointRelationshipBrowserResult(
  value: unknown,
): SuggestedWaypointRelationshipBrowserResult | null {
  if (!isPlainObject(value) || !hasExactKeys(value, ["ok", "data", "error"])) {
    return null;
  }

  if (value.ok === false) {
    if (
      value.data !== null ||
      (value.error !== SUGGESTED_WAYPOINT_RELATIONSHIP_DENIED &&
        value.error !== SUGGESTED_WAYPOINT_RELATIONSHIP_FAILED)
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
  const items: SuggestedWaypointRelationshipBrowserItem[] = [];
  for (const item of value.data.items) {
    if (
      !isPlainObject(item) ||
      !hasExactKeys(item, [
        "guide_explorer_relationship_id",
        "explorer_display_name",
        "relationship_created_at",
      ]) ||
      !isSuggestedWaypointRelationshipId(
        item.guide_explorer_relationship_id,
      ) ||
      seen.has(item.guide_explorer_relationship_id) ||
      !isDisplayName(item.explorer_display_name) ||
      !isTimestamp(item.relationship_created_at)
    ) {
      return null;
    }
    seen.add(item.guide_explorer_relationship_id);
    items.push({
      guide_explorer_relationship_id: item.guide_explorer_relationship_id,
      explorer_display_name: item.explorer_display_name,
      relationship_created_at: item.relationship_created_at,
    });
  }

  return Object.freeze({
    ok: true,
    data: freezePage({
      items,
      next_cursor: value.data.next_cursor,
      total_count: value.data.total_count,
    }),
    error: null,
  });
}

export function availableSuggestedWaypointRelationshipPageSizes(
  totalCount: number,
): readonly SuggestedWaypointRelationshipPageSize[] {
  if (!Number.isSafeInteger(totalCount) || totalCount <= 5) {
    return Object.freeze([]);
  }

  return Object.freeze(
    SUGGESTED_WAYPOINT_RELATIONSHIP_PAGE_SIZES.filter((size, index) =>
      index < 2 ? true : totalCount > size,
    ),
  );
}
