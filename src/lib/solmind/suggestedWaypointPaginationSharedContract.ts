// Shared browser-safe Suggested Waypoint pagination contract.
//
// This module owns syntax only. Opaque cursors never convey authority; every
// server owner must recheck the current actor and relationship before use.

export const SUGGESTED_WAYPOINT_PAGE_SIZES = Object.freeze([
  5, 10, 20, 50, 100,
] as const);

export const SUGGESTED_WAYPOINT_DEFAULT_PAGE_SIZE = 10 as const;
export const SUGGESTED_WAYPOINT_REFRESH_REQUIRED = "refresh_required" as const;

export type SuggestedWaypointPageSize =
  (typeof SUGGESTED_WAYPOINT_PAGE_SIZES)[number];

export type SuggestedWaypointPaginationRequest = Readonly<{
  pageSize: SuggestedWaypointPageSize;
  cursor: string | null;
}>;

const PADDED_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const ALLOWED_QUERY_KEYS = Object.freeze(["cursor", "pageSize"] as const);

export function isSuggestedWaypointPageSize(
  value: unknown,
): value is SuggestedWaypointPageSize {
  return (
    typeof value === "number" &&
    (SUGGESTED_WAYPOINT_PAGE_SIZES as readonly number[]).includes(value)
  );
}

export function isSuggestedWaypointOpaqueCursor(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value.length % 4 === 0 &&
    PADDED_BASE64_PATTERN.test(value)
  );
}

export function isSuggestedWaypointOptionalCursor(
  value: unknown,
): value is string | null {
  return value === null || isSuggestedWaypointOpaqueCursor(value);
}

export function parseSuggestedWaypointPaginationSearchParams(
  searchParams: URLSearchParams,
): SuggestedWaypointPaginationRequest | null {
  for (const key of searchParams.keys()) {
    if (
      !ALLOWED_QUERY_KEYS.includes(
        key as (typeof ALLOWED_QUERY_KEYS)[number],
      ) ||
      searchParams.getAll(key).length !== 1
    ) {
      return null;
    }
  }

  const pageSizeText = searchParams.get("pageSize");
  const pageSize =
    pageSizeText === null
      ? SUGGESTED_WAYPOINT_DEFAULT_PAGE_SIZE
      : SUGGESTED_WAYPOINT_PAGE_SIZES.find(
          (candidate) => String(candidate) === pageSizeText,
        );
  if (pageSize === undefined) {
    return null;
  }

  const cursor = searchParams.get("cursor");
  if (!isSuggestedWaypointOptionalCursor(cursor)) {
    return null;
  }

  return Object.freeze({ pageSize, cursor });
}
