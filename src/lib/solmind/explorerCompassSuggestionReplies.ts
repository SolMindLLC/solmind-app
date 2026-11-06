import type { ExplorerConversationCommand, ExplorerConversationState } from "./explorerConversationContract";

export type CompassSuggestionReply = Extract<ExplorerConversationCommand, { kind: "respond_compass_suggestion" }>["response"];

export const COMPASS_SUGGESTION_REPLY_LABELS = Object.freeze({
  right: "That's right",
  close: "Close, not quite",
  not_it: "That's not it",
} satisfies Record<CompassSuggestionReply, string>);

export const COMPASS_SUGGESTION_TURNED_DOWN_LIMIT_REASON =
  'Because this conversation already keeps the most turned-down suggestions it can, "That\'s not it" is not available here. You can still choose another reply or type what you would change.';

export const COMPASS_SUGGESTION_REPLY_HOLDS = Object.freeze({
  support: "To keep this conversation focused on support, suggestion replies are not available in this conversation.",
  adult_policy: "Because SolMind is for adults, suggestion replies are unavailable in this conversation.",
  unavailable: "To keep this conversation safe, suggestion replies wait until SolMind can confirm this conversation's settings.",
});

export function formingSuggestionsForMessage(state: ExplorerConversationState, messageId: string) {
  if (state.sessionStatus === "ended" ||
      !state.messages.some(message => message.id === messageId && message.role === "virtualGuide")) return [];
  // The original source remains separate from the latest saved wording source.
  // An older projection without that pointer cannot safely place a reply row.
  return state.compassItems.filter(item => item.formation === "forming" &&
    item.mergedIntoItemId == null && item.wordingMessageId === messageId);
}
