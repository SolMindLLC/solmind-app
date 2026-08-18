// Exact server-only classification for the three Suggested Waypoint list
// functions that intentionally invalidate stale or cross-scope cursors.

import "server-only";

export type SuggestedWaypointRecoverableListFunction =
  | "solmind_list_guide_suggested_waypoints"
  | "solmind_list_explorer_suggested_waypoints"
  | "solmind_list_guide_suggested_waypoint_relationships";

const INVALID_CURSOR_MESSAGE_BY_FUNCTION: Readonly<
  Record<SuggestedWaypointRecoverableListFunction, string>
> = Object.freeze({
  solmind_list_guide_suggested_waypoints:
    "solmind_suggested_waypoint_invalid_cursor",
  solmind_list_explorer_suggested_waypoints:
    "solmind_suggested_waypoint_invalid_cursor",
  solmind_list_guide_suggested_waypoint_relationships:
    "solmind_suggested_waypoint_relationship_selector_invalid_cursor",
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSuggestedWaypointRefreshRequiredRpcError(
  functionName: SuggestedWaypointRecoverableListFunction,
  error: unknown,
): boolean {
  return (
    isPlainObject(error) &&
    error.code === "P0001" &&
    error.message === INVALID_CURSOR_MESSAGE_BY_FUNCTION[functionName]
  );
}
