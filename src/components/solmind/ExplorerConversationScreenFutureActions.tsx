import type { ScreenCompass } from "@/lib/solmind/explorerConversationScreenDisplay";
import { SOLMIND_TERMS } from "@/lib/solmind/terms";

import { IconFlag } from "./ExplorerConversationScreenIcons";
import {
  NotYetImplementedNote,
  PlaceholderSlot,
  QUIET_BUTTON,
  SECONDARY_BUTTON,
  UnwiredControl,
  joinClasses,
  noteId,
} from "./ExplorerConversationScreenNotYetImplemented";

// "What you will be able to do": examples of future Compass and Waypoint
// actions, kept apart from the short Waypoint card so the card stays
// contiguous. Every control here is unwired and explains itself.

const QUIET_BORDERED = joinClasses(QUIET_BUTTON, "border border-amber-300/25");

type FutureActionsProps = Readonly<{ scope: string; compass: ScreenCompass; guideName: string }>;

export function FutureActionsSection({ scope, compass, guideName }: FutureActionsProps) {
  const titleId = `${scope}-future-actions-title`;
  const attention = compass.points.find((point) => point.id === compass.attentionId) ?? null;

  return (
    <section aria-labelledby={titleId} className="border-t border-stone-800/80 px-4 py-4">
      <h3 className="font-serif text-lg text-stone-50" id={titleId}>
        What you will be able to do
      </h3>
      <PlaceholderSlot className="mt-3" title="On your Compass">
        <NotYetImplementedNote id={noteId(scope, "compass")} noteKey="compass" />
        <NotYetImplementedNote id={noteId(scope, "formingPoint")} noteKey="formingPoint" />
        <NotYetImplementedNote id={noteId(scope, "needle")} noteKey="needle" />
        <NotYetImplementedNote id={noteId(scope, "compactView")} noteKey="compactView" />
        <UnwiredControl className={joinClasses(QUIET_BUTTON, "border border-stone-700")} noteKey="otherPaths" scope={scope}>
          Other paths ({compass.otherPathsCount})
        </UnwiredControl>
        <p className="text-xs font-medium text-stone-300">Priority suggestion</p>
        <NotYetImplementedNote id={noteId(scope, "prioritySuggestion")} noteKey="prioritySuggestion" />
        <UnwiredControl className={SECONDARY_BUTTON} noteKey="makePriority" scope={scope}>
          Make &ldquo;{attention?.label}&rdquo; my Priority
        </UnwiredControl>
      </PlaceholderSlot>
      <PlaceholderSlot className="mt-3" title="With this Waypoint">
        <NotYetImplementedNote id={noteId(scope, "reachedSuggestion")} noteKey="reachedSuggestion" />
        <UnwiredControl className={SECONDARY_BUTTON} noteKey="confirmReached" scope={scope}>
          <IconFlag />
          Confirm Reached
        </UnwiredControl>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <UnwiredControl className={SECONDARY_BUTTON} noteKey="release" scope={scope}>
            Release
          </UnwiredControl>
          <UnwiredControl className={SECONDARY_BUTTON} noteKey="revisit" scope={scope}>
            Revisit
          </UnwiredControl>
        </div>
      </PlaceholderSlot>
      <PlaceholderSlot className="mt-3" title={`Sharing with ${guideName}`}>
        <UnwiredControl className={QUIET_BORDERED} guideName={guideName} noteKey="shareForming" scope={scope}>
          Share this forming Waypoint with {guideName}
        </UnwiredControl>
        <UnwiredControl className={QUIET_BORDERED} guideName={guideName} noteKey="shareReason" scope={scope}>
          Add a reason for {guideName}
        </UnwiredControl>
        <UnwiredControl className={QUIET_BORDERED} noteKey="stopSharing" scope={scope}>
          Stop sharing
        </UnwiredControl>
      </PlaceholderSlot>
      <PlaceholderSlot className="mt-3" title={`${SOLMIND_TERMS.guideRole} suggestions and input`}>
        <NotYetImplementedNote id={noteId(scope, "guideSuggestions")} noteKey="guideSuggestions" />
        <NotYetImplementedNote guideName={guideName} id={noteId(scope, "guideInput")} noteKey="guideInput" />
      </PlaceholderSlot>
    </section>
  );
}
