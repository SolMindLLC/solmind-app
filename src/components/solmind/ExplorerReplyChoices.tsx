import type { ExplorerConversationState } from "@/lib/solmind/explorerConversationContract";
import { REPLY_CHOICES_GROUP_LABEL, SOMETHING_ELSE_LABEL, latestReplyChoices } from "@/lib/solmind/explorerReplyChoices";
import { FOCUS_RING, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";
import { CHOICE_CLASS, CHOICE_PLAIN, CHOICE_WRAP } from "./ExplorerConversationScreenTranscript";

// Presentation only, inside the latest saved Virtual Guide message's list item.
// The controller owns Send; Something else is a separate local screen action.
export function ExplorerReplyChoices({ state, messageId, disabled, onChoose, onSomethingElse }: Readonly<{
  state: ExplorerConversationState;
  messageId: string;
  disabled: boolean;
  onChoose: (label: string) => void;
  onSomethingElse: () => void;
}>) {
  const latest = latestReplyChoices(state);
  if (latest === null || latest.messageId !== messageId) return null;
  return (
    <div aria-label={REPLY_CHOICES_GROUP_LABEL} className="mt-3 grid gap-2 sm:max-w-md" data-reply-choices="" role="group">
      {latest.labels.map((label, index) => (
        <button
          className={joinClasses(CHOICE_CLASS, CHOICE_WRAP, CHOICE_PLAIN, FOCUS_RING, "disabled:cursor-not-allowed disabled:opacity-50")}
          disabled={disabled}
          key={`${index}:${label}`}
          onClick={(event) => {
            onChoose(label);
            // Keep keyboard focus on the saved message when Send removes the row.
            event.currentTarget.closest("li")?.focus();
          }}
          type="button"
        >
          <span className="grow basis-0 [overflow-wrap:anywhere]" data-choice-label="">
            {label}
          </span>
        </button>
      ))}
      <button
        className={joinClasses("justify-self-start rounded-md px-2 py-2 text-sm text-stone-300 underline underline-offset-4 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-50", FOCUS_RING)}
        disabled={disabled}
        onClick={onSomethingElse}
        type="button"
      >
        {SOMETHING_ELSE_LABEL}
      </button>
    </div>
  );
}
