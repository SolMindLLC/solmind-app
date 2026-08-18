// Shared route/browser constants for the Explorer Suggested Waypoint inbox.
// This file contains no authority or data-access behavior.

import {
  SUGGESTED_WAYPOINT_PAGE_SIZES,
  isSuggestedWaypointPageSize,
  type SuggestedWaypointPageSize,
} from "./suggestedWaypointPaginationSharedContract";

export const SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED =
  "SolMind Waypoint Suggestions are unavailable." as const;
export const SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED =
  "SolMind Waypoint Suggestions could not be loaded." as const;

export const SUGGESTED_WAYPOINT_EXPLORER_LIST_PAGE_SIZES =
  SUGGESTED_WAYPOINT_PAGE_SIZES;

export type SuggestedWaypointExplorerListPageSize = SuggestedWaypointPageSize;

export function isSuggestedWaypointExplorerListPageSize(
  value: unknown,
): value is SuggestedWaypointExplorerListPageSize {
  return isSuggestedWaypointPageSize(value);
}
