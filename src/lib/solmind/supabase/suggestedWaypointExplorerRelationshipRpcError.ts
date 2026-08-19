// PRJ01_V-WS05-WI022-S03 exact Explorer-list relationship invariant error.
//
// This server-only classifier recognizes one value-free database exception for
// one exact function. Every near match and every other Suggested Waypoint RPC
// remains on the generic failure path.

import "server-only";

import { type SuggestedWaypointRpcFunction } from "./suggestedWaypointRpcContract";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: suggestedWaypointExplorerRelationshipRpcError must not be imported in browser code.",
  );
}

const EXPLORER_RELATIONSHIP_UNAVAILABLE =
  "solmind_suggested_waypoint_explorer_relationship_unavailable";

function readExactErrorField(
  error: unknown,
  field: "code" | "message",
): string | null {
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    return null;
  }
  try {
    const value = (error as Record<string, unknown>)[field];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export function isSuggestedWaypointExplorerRelationshipUnavailableRpcError(
  functionName: SuggestedWaypointRpcFunction,
  error: unknown,
): boolean {
  return (
    functionName === "solmind_list_explorer_suggested_waypoints" &&
    readExactErrorField(error, "code") === "P0001" &&
    readExactErrorField(error, "message") === EXPLORER_RELATIONSHIP_UNAVAILABLE
  );
}
