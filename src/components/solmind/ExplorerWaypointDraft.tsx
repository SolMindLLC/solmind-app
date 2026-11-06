import type { ExplorerConversationState } from "@/lib/solmind/explorerConversationContract";
import type { ExplorerConversationFormationIntent } from "@/lib/solmind/explorerConversationFormation";
import { COMPASS_SUGGESTION_REPLY_HOLDS } from "@/lib/solmind/explorerCompassSuggestionReplies";
import { completeWaypointDraft, formingWaypointForMessage, waypointLimitReached, WAYPOINT_DRAFT_LIMIT_REASON, WAYPOINT_DRAFT_WORDING as W } from "@/lib/solmind/explorerWaypointDraft";
import { suggestionReplyButtons } from "./ExplorerCompassSuggestionReplies";

// Saved proposed wording only, within the latest suggesting message's list item.
export function ExplorerWaypointDraft({ state, messageId, held, followUpHeld, onCommand }: Readonly<{
  state: ExplorerConversationState;
  messageId: string;
  held: boolean;
  followUpHeld: boolean;
  onCommand: (intent: ExplorerConversationFormationIntent) => void;
}>) {
  const draft = formingWaypointForMessage(state, messageId);
  if (draft === null) return null;
  const availability = state.compassSuggestionReplies ?? "unavailable";
  const title = draft.title ?? W.unnamed;
  const atLimit = waypointLimitReached(state);
  const showLimitReason = atLimit && state.sessionStatus !== "ended" && availability === "available";
  return (
    <div aria-describedby={showLimitReason ? `waypoint-suggestion-limit-${draft.id}` : undefined}
      aria-label={`Reply to Waypoint suggestion: ${title}`} className="mt-3 grid gap-3 rounded-2xl border border-dashed border-amber-200/50 bg-amber-300/[0.04] p-3" role="group">
      <div className="flex items-start justify-between gap-3">
        <h3 className="whitespace-pre-wrap font-serif text-lg text-stone-50 [overflow-wrap:anywhere]">{title}</h3>
        <span className="rounded-full border border-dashed border-amber-200/50 px-2.5 py-1 text-xs font-semibold text-amber-100">{W.forming}</span>
      </div>
      <dl className="grid gap-2 text-sm leading-6 text-stone-100">
        {([
          [W.destination, draft.destination],
          [W.whyItMatters, draft.whyItMatters],
          [W.arrivalSignal, draft.arrivalSignal],
        ] as const).map(([label, wording]) => (
          <div key={label}>
            <dt className="font-semibold text-amber-200">{label}</dt>
            <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{wording}</dd>
          </div>
        ))}
      </dl>
      {state.sessionStatus === "ended" ? null : availability === "available" ? suggestionReplyButtons({ held: held || state.pendingTurn,
        followUpHeld: followUpHeld || draft.title === null, rightHeld: atLimit || !completeWaypointDraft(draft),
        onReply: response => onCommand({ kind: "respond_waypoint_draft", draftId: draft.id, response }) }) : (
        <p className="text-sm leading-6 text-stone-300">{COMPASS_SUGGESTION_REPLY_HOLDS[availability]}</p>
      )}
      {showLimitReason && (
        <p className="text-sm leading-6 text-stone-300" id={`waypoint-suggestion-limit-${draft.id}`}>
          {WAYPOINT_DRAFT_LIMIT_REASON}
        </p>
      )}
    </div>
  );
}
