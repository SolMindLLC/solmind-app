// Shared route/browser constants for the Guide Suggested Waypoint list.
// This file contains no authority or data access behavior.

import {
  SUGGESTED_WAYPOINT_PAGE_SIZES,
  isSuggestedWaypointPageSize,
  type SuggestedWaypointPageSize,
} from "./suggestedWaypointPaginationSharedContract";

export const SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED =
  "SolMind Suggested Waypoints are unavailable." as const;
export const SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED =
  "SolMind Suggested Waypoints could not be loaded." as const;

export const SUGGESTED_WAYPOINT_GUIDE_LIST_PAGE_SIZES =
  SUGGESTED_WAYPOINT_PAGE_SIZES;

export type SuggestedWaypointGuideListPageSize = SuggestedWaypointPageSize;

export function isSuggestedWaypointGuideListPageSize(
  value: unknown,
): value is SuggestedWaypointGuideListPageSize {
  return isSuggestedWaypointPageSize(value);
}
