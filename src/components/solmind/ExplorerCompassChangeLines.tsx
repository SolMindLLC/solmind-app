import { useState } from "react";
import { advanceCompassChangeVisit, compassChangeText, COMPASS_CHANGE_PREVIEW_COUNT, COMPASS_SHOW_ALL_CHANGES, type CompassChangeVisit } from "@/lib/solmind/explorerCompassChanges";
import type { ExplorerCompassChangeBundle, ExplorerConversationState } from "@/lib/solmind/explorerConversationContract";
import { FOCUS_RING, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";

// Owned by the mounted transcript. Losing saved authority unmounts it; no
// timer, browser storage, or copy is kept outside this visit.
export function useCompassChangeVisit(state: ExplorerConversationState, authorityLost: boolean): CompassChangeVisit {
  const [visit, setVisit] = useState<CompassChangeVisit | null>(null);
  const next = authorityLost ? null : advanceCompassChangeVisit(visit, state);
  if (next !== visit) setVisit(next);
  return next ?? { conversationId: null, seenOperations: [], seenReplies: [], visible: [], announcement: "" };
}

export function CompassChangeLines({ bundles, messageId }: Readonly<{
  bundles: readonly ExplorerCompassChangeBundle[]; messageId: string;
}>) {
  const [expandedOperations, setExpandedOperations] = useState<readonly string[]>([]);
  return bundles.filter(bundle => bundle.replyMessageId === messageId).map(bundle => {
    const expanded = expandedOperations.includes(bundle.operationId);
    const remainderId = `compass-change-rest-${bundle.operationId}`;
    const paragraph = (change: ExplorerCompassChangeBundle["changes"][number]) => (
      <p className="mt-2 text-left text-xs leading-5 text-stone-400 [overflow-wrap:anywhere]" key={change.pointId}>
        {compassChangeText(change)}
      </p>
    );
    return (
      // The transcript is a live log. These paragraphs use the single dedicated
      // announcement region instead, so old lines are not read again with a reply.
      <div aria-live="off" className="mr-auto min-w-0 max-w-full" data-compass-change={bundle.operationId} key={bundle.operationId}>
        {bundle.changes.slice(0, COMPASS_CHANGE_PREVIEW_COUNT).map(paragraph)}
        {bundle.changes.length > COMPASS_CHANGE_PREVIEW_COUNT ? (
          <>
            <button aria-controls={remainderId} aria-expanded={expanded}
              className={joinClasses("mt-2 rounded-md text-left text-xs leading-5 text-stone-400 underline underline-offset-4 hover:text-stone-200", FOCUS_RING)}
              onClick={() => setExpandedOperations(current => current.includes(bundle.operationId) ? current : [...current, bundle.operationId])}
              type="button">
              {COMPASS_SHOW_ALL_CHANGES}
            </button>
            <div hidden={!expanded} id={remainderId}>
              {bundle.changes.slice(COMPASS_CHANGE_PREVIEW_COUNT).map(paragraph)}
            </div>
          </>
        ) : null}
      </div>
    );
  });
}
