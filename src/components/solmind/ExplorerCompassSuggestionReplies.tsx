import type { ExplorerConversationState } from "@/lib/solmind/explorerConversationContract";
import type { ExplorerConversationFormationIntent } from "@/lib/solmind/explorerConversationFormation";
import {
  COMPASS_SUGGESTION_REPLY_LABELS,
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

// Retained import surface for historical callers; Compass replies are retired.
// The shared button renderer above still belongs to the Waypoint draft row.
export function ExplorerCompassSuggestionReplies(_props: Readonly<{
  state: ExplorerConversationState;
  messageId: string;
  held: boolean;
  followUpHeld: boolean;
  onCommand: (intent: ExplorerConversationFormationIntent) => void;
}>) {
  void _props;
  return null;
}
