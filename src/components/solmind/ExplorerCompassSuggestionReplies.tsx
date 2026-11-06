import type { ExplorerConversationState } from "@/lib/solmind/explorerConversationContract";
import type { ExplorerConversationFormationIntent } from "@/lib/solmind/explorerConversationFormation";
import {
  COMPASS_SUGGESTION_REPLY_HOLDS,
  COMPASS_SUGGESTION_REPLY_LABELS,
  COMPASS_SUGGESTION_TURNED_DOWN_LIMIT_REASON,
  formingSuggestionsForMessage,
  type CompassSuggestionReply,
} from "@/lib/solmind/explorerCompassSuggestionReplies";
import { SECONDARY_BUTTON, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";

// Shared by Compass and Waypoint suggestions; selection stays with the browser owner.
export function suggestionReplyButtons({ held, followUpHeld, rightHeld = false, notItHeld = false, onReply }: Readonly<{
  held: boolean;
  followUpHeld: boolean;
  rightHeld?: boolean;
  notItHeld?: boolean;
  onReply: (response: CompassSuggestionReply) => void;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(COMPASS_SUGGESTION_REPLY_LABELS) as CompassSuggestionReply[]).map(response => (
        <button
          className={joinClasses(SECONDARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50")}
          disabled={held || (response !== "right" && followUpHeld) ||
            (response === "right" && rightHeld) || (response === "not_it" && notItHeld)}
          key={response}
          onClick={(event) => {
            onReply(response);
            // Confirmation or rejection can remove this button during its Send.
            event.currentTarget.closest("li")?.focus();
          }}
          type="button"
        >
          {COMPASS_SUGGESTION_REPLY_LABELS[response]}
        </button>
      ))}
    </div>
  );
}

// Presentation only, inside the saved suggesting message's existing list item.
export function ExplorerCompassSuggestionReplies({ state, messageId, held, followUpHeld, onCommand }: Readonly<{
  state: ExplorerConversationState;
  messageId: string;
  held: boolean;
  followUpHeld: boolean;
  onCommand: (intent: ExplorerConversationFormationIntent) => void;
}>) {
  const suggestions = formingSuggestionsForMessage(state, messageId);
  if (suggestions.length === 0) return null;
  const availability = state.compassSuggestionReplies ?? "unavailable";
  if (availability !== "available") {
    return <p className="mt-2 text-sm leading-6 text-stone-300">{COMPASS_SUGGESTION_REPLY_HOLDS[availability]}</p>;
  }
  return suggestions.map(item => (
    <div
      aria-describedby={state.turnedDownLimitReached ? `compass-suggestion-limit-${item.id}` : undefined}
      aria-label={`Reply to Compass suggestion: ${item.label}`}
      className="mt-3 grid gap-2" key={item.id} role="group"
    >
      <p className="text-sm text-stone-200 [overflow-wrap:anywhere]">{item.label}</p>
      {suggestionReplyButtons({ held: held || state.pendingTurn, followUpHeld,
        notItHeld: state.turnedDownLimitReached,
        onReply: response => onCommand({ kind: "respond_compass_suggestion", itemId: item.id, response }) })}
      {state.turnedDownLimitReached && (
        <p className="text-sm leading-6 text-stone-300" id={`compass-suggestion-limit-${item.id}`}>
          {COMPASS_SUGGESTION_TURNED_DOWN_LIMIT_REASON}
        </p>
      )}
    </div>
  ));
}
