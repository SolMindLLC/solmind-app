import type { ExplorerCompassChangeBundle, ExplorerConversationState } from "./explorerConversationContract";

// Approved by Paul, 2026-11-12. Labels are plain text; exported names stay stable.
export const COMPASS_EARLY_TOPIC_DRAFT = "New on your Compass: [label]. This may be an early topic, so it starts at the top; it may not be what matters most to you.";
export const COMPASS_NOT_YET_CLEAR_DRAFT = "New on your Compass: [label]. It is not yet clear how much it matters to you.";
export const COMPASS_CHANGE_PREVIEW_COUNT = 2;
export const COMPASS_SHOW_ALL_CHANGES = "Show all Compass changes";

export function compassChangeText(change: ExplorerCompassChangeBundle["changes"][number]): string {
  const template = change.noticeKind === "early_topic" ? COMPASS_EARLY_TOPIC_DRAFT : COMPASS_NOT_YET_CLEAR_DRAFT;
  return template.replace("[label]", () => change.label);
}

export type CompassChangeVisit = Readonly<{
  conversationId: string | null;
  seenOperations: readonly string[];
  seenReplies: readonly string[];
  visible: readonly ExplorerCompassChangeBundle[];
  announcement: string;
}>;

// First saved state is a baseline. A newly started conversation may acquire its
// id after that empty baseline. Other conversation changes start a fresh visit.
export function advanceCompassChangeVisit(
  visit: CompassChangeVisit | null,
  state: ExplorerConversationState,
): CompassChangeVisit {
  const bundles = state.compassChanges ?? [];
  if (visit === null || (visit.conversationId !== null && visit.conversationId !== state.conversationId)) {
    return { conversationId: state.conversationId,
      seenOperations: bundles.map(bundle => bundle.operationId),
      seenReplies: bundles.map(bundle => bundle.replyMessageId), visible: [], announcement: "" };
  }
  const operations = new Set(visit.seenOperations);
  const replies = new Set(visit.seenReplies);
  const added: ExplorerCompassChangeBundle[] = [];
  for (const bundle of bundles) {
    if (operations.has(bundle.operationId) || replies.has(bundle.replyMessageId)) continue;
    operations.add(bundle.operationId);
    replies.add(bundle.replyMessageId);
    added.push(bundle);
  }
  if (added.length === 0 && visit.conversationId === state.conversationId) return visit;
  return { conversationId: state.conversationId, seenOperations: [...operations], seenReplies: [...replies],
    visible: [...visit.visible, ...added],
    announcement: added.length === 0 ? visit.announcement : added.flatMap(bundle => bundle.changes.map(compassChangeText)).join(" ") };
}
