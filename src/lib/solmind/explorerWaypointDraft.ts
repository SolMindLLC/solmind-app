import { waypointHasCapacity, type ExplorerConversationState, type ExplorerConversationWaypointDraft } from "./explorerConversationContract";
import { waypointCapacityMessage } from "./explorerWaypointCapacity";

export const WAYPOINT_DRAFT_WORDING = Object.freeze({
  forming: "Forming",
  destination: "Where you're heading:",
  whyItMatters: "Why it matters:",
  arrivalSignal: "Reached looks like:",
  unnamed: "Waypoint",
});

export function waypointLimitReached(state: ExplorerConversationState): boolean {
  // Account capacity and conversation history room are authoritative server data.
  return !waypointHasCapacity(state);
}

export function waypointDraftLimitReason(state: ExplorerConversationState): string | null {
  return waypointCapacityMessage(state, true, true);
}

export function formingWaypointForMessage(state: ExplorerConversationState, messageId: string) {
  const draft = state.waypointDraft;
  return draft != null && draft.suggestionMessageId === messageId &&
    state.messages.some(message => message.id === messageId && message.role === "virtualGuide") ? draft : null;
}

export function completeWaypointDraft(draft: ExplorerConversationWaypointDraft): boolean {
  return draft.title !== null && draft.destination !== null && draft.whyItMatters !== null && draft.arrivalSignal !== null;
}
