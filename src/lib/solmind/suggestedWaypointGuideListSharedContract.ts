// Shared route/browser constants for the Guide Suggested Waypoint list.
// This file contains no authority or data access behavior.

export const SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED =
  "SolMind Suggested Waypoints are unavailable." as const;
export const SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED =
  "SolMind Suggested Waypoints could not be loaded." as const;

export const SUGGESTED_WAYPOINT_GUIDE_LIST_PAGE_SIZES = Object.freeze([
  5, 10, 20, 50, 100,
] as const);

export type SuggestedWaypointGuideListPageSize =
  (typeof SUGGESTED_WAYPOINT_GUIDE_LIST_PAGE_SIZES)[number];

export function isSuggestedWaypointGuideListPageSize(
  value: unknown,
): value is SuggestedWaypointGuideListPageSize {
  return (
    typeof value === "number" &&
    (SUGGESTED_WAYPOINT_GUIDE_LIST_PAGE_SIZES as readonly number[]).includes(value)
  );
}
