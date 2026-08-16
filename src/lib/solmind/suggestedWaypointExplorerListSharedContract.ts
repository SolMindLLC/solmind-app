// Shared route/browser constants for the Explorer Suggested Waypoint inbox.
// This file contains no authority or data-access behavior.

export const SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED =
  "SolMind Waypoint Suggestions are unavailable." as const;
export const SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED =
  "SolMind Waypoint Suggestions could not be loaded." as const;

export const SUGGESTED_WAYPOINT_EXPLORER_LIST_PAGE_SIZES = Object.freeze([
  5, 10, 20, 50, 100,
] as const);

export type SuggestedWaypointExplorerListPageSize =
  (typeof SUGGESTED_WAYPOINT_EXPLORER_LIST_PAGE_SIZES)[number];

export function isSuggestedWaypointExplorerListPageSize(
  value: unknown,
): value is SuggestedWaypointExplorerListPageSize {
  return (
    typeof value === "number" &&
    (SUGGESTED_WAYPOINT_EXPLORER_LIST_PAGE_SIZES as readonly number[]).includes(value)
  );
}
