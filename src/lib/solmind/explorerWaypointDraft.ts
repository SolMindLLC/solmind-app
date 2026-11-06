import { EXPLORER_CONVERSATION_LIMITS, type ExplorerConversationState, type ExplorerConversationWaypointDraft } from "./explorerConversationContract";

export const WAYPOINT_DRAFT_LIMIT_REASON =
  'Because you already have the most Waypoints SolMind keeps, "That\'s right" is not available here. You can still choose another reply or type what you would change.';

export const WAYPOINT_DRAFT_WORDING = Object.freeze({
  forming: "Forming",
  destination: "Where you're heading:",
  whyItMatters: "Why it matters:",
  arrivalSignal: "Reached looks like:",
  unnamed: "Waypoint",
});

export function waypointLimitReached(state: ExplorerConversationState): boolean {
  // State includes every stored row, including Reached, Released and earlier versions.
  return state.waypoints.length >= EXPLORER_CONVERSATION_LIMITS.waypoints;
}

export function formingWaypointForMessage(state: ExplorerConversationState, messageId: string) {
  const draft = state.waypointDraft;
  return draft != null && draft.suggestionMessageId === messageId &&
    state.messages.some(message => message.id === messageId && message.role === "virtualGuide") ? draft : null;
}

export function completeWaypointDraft(draft: ExplorerConversationWaypointDraft): boolean {
  return draft.title !== null && draft.destination !== null && draft.whyItMatters !== null && draft.arrivalSignal !== null;
}
