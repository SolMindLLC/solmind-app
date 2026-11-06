import { COMPASS_SUGGESTION_REPLY_HOLDS } from "./explorerCompassSuggestionReplies";
import { parseExplorerWaypointCapacity, type ExplorerConversationState } from "./explorerConversationContract";

// Paul's approved wording, decision queue 2026-11-06 15:13:41 CST.
// These four sentences change only with his approval; placeholders use server facts.
export const WAYPOINT_ACTIVE_LIMIT_REASON =
  "You have {activeCount} active Waypoints across your conversations. To help keep your focus manageable, your total must be below {activeLimit} before adding or bringing back another. Reached and Released Waypoints do not count. Review and confirm Reached for Waypoints you have reached, or release those you no longer want to pursue.";
export const WAYPOINT_HISTORY_LIMIT_REASON =
  "This conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. No new Waypoint or version can be saved here. Marking one Reached or Released does not make room for another version. You can still read the Waypoints shown here, use Reached or Release where available, or end an active conversation.";
export const WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON =
  '"That\'s right" is unavailable because you have {activeCount} active Waypoints across your conversations. To help keep your focus manageable, your total must be below {activeLimit} before adding another. This limit does not block other replies or typing what you would change.';
export const WAYPOINT_DRAFT_HISTORY_LIMIT_REASON =
  '"That\'s right" is unavailable because this conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. This limit does not block other replies or typing what you would change.';

export function waypointCapacityMessage(
  state: Pick<ExplorerConversationState, "waypointCapacity">,
  increasesActive = true,
  forming = false,
): string | null {
  const capacity = parseExplorerWaypointCapacity(state.waypointCapacity);
  if (capacity === null) {
    return forming ? COMPASS_SUGGESTION_REPLY_HOLDS.unavailable
      : "The conversation could not be loaded. Please try again.";
  }
  if (!capacity.historyRoom) return forming ? WAYPOINT_DRAFT_HISTORY_LIMIT_REASON : WAYPOINT_HISTORY_LIMIT_REASON;
  if (increasesActive && capacity.activeCount >= capacity.activeLimit) {
    return (forming ? WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON : WAYPOINT_ACTIVE_LIMIT_REASON)
      .replace("{activeCount}", String(capacity.activeCount))
      .replace("{activeLimit}", String(capacity.activeLimit));
  }
  return null;
}
