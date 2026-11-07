import { COMPASS_SUGGESTION_REPLY_HOLDS } from "./explorerCompassSuggestionReplies";
import { parseExplorerWaypointCapacity, type ExplorerConversationState, type ExplorerWaypointCapacityPurpose } from "./explorerConversationContract";

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

// Lane 12 (Paul's rule, decision queue 2026-11-05 19:38:45 CST): at most five different Waypoints form in one
// conversation. Paul's approved wording (decision queue 2026-11-07 08:02:45 CST; GPT-6 Astra's REV313 drafts with the
// decision card's "end this conversation" release sentence); these two sentences change only with his approval.
export const WAYPOINT_CONVERSATION_LIMIT_REASON =
  "This conversation has reached its limit of five different Waypoints, to help keep each conversation focused. Reached and Released Waypoints still count. You can keep talking here and work with your existing Waypoints. To form another Waypoint, end this conversation when you choose, then open With your Virtual Guide and send a message to start another.";
export const WAYPOINT_DRAFT_CONVERSATION_LIMIT_REASON =
  '"That\'s right" is unavailable because this conversation has reached its five-Waypoint limit, to help keep each conversation focused. Reached and Released Waypoints still count. This limit does not block the other replies or typing. To form another Waypoint, end this conversation when you choose, then open With your Virtual Guide and send a message to start another.';

// Explanation order, for the first limit that applies: the 200-version guard, then (for a new Waypoint only) this
// conversation's five, then (for a new Waypoint or a revisit) the 20 active Waypoints. The five come before the active
// limit because releasing an active Waypoint never makes room in this conversation. A revision checks history only.
export function waypointCapacityMessage(
  state: Pick<ExplorerConversationState, "waypointCapacity">,
  purpose: ExplorerWaypointCapacityPurpose = "new",
  forming = false,
): string | null {
  const capacity = parseExplorerWaypointCapacity(state.waypointCapacity);
  if (capacity === null) {
    return forming ? COMPASS_SUGGESTION_REPLY_HOLDS.unavailable
      : "The conversation could not be loaded. Please try again.";
  }
  if (!capacity.historyRoom) return forming ? WAYPOINT_DRAFT_HISTORY_LIMIT_REASON : WAYPOINT_HISTORY_LIMIT_REASON;
  if (purpose === "new" && !capacity.conversationRoom) {
    return forming ? WAYPOINT_DRAFT_CONVERSATION_LIMIT_REASON : WAYPOINT_CONVERSATION_LIMIT_REASON;
  }
  if (purpose !== "revision" && capacity.activeCount >= capacity.activeLimit) {
    return (forming ? WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON : WAYPOINT_ACTIVE_LIMIT_REASON)
      .replace("{activeCount}", String(capacity.activeCount))
      .replace("{activeLimit}", String(capacity.activeLimit));
  }
  return null;
}

// The quiet notice beside the connected Waypoint list: only this conversation's five-Waypoint limit, which applies
// even with no forming draft. Missing or malformed capacity shows nothing here (the controls explain it instead).
export function waypointConversationLimitNotice(state: Pick<ExplorerConversationState, "waypointCapacity">): string | null {
  const capacity = parseExplorerWaypointCapacity(state.waypointCapacity);
  return capacity !== null && capacity.historyRoom && !capacity.conversationRoom ? WAYPOINT_CONVERSATION_LIMIT_REASON : null;
}
