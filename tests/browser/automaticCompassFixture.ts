import { EXPLORER_COMPASS_ANCHORS, type ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";

// Invented fixtures shared by static and authored browser checks, never a model.
export const automaticId = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const AUTOMATIC_LABEL = "Making time for a quiet walk through the neighborhood after an ordinary day";
export function automaticState(turns = 0): ExplorerConversationState {
  const messages: ExplorerConversationState["messages"][number][] = [];
  const compassItems: ExplorerConversationState["compassItems"][number][] = [];
  const compassChanges: NonNullable<ExplorerConversationState["compassChanges"]>[number][] = [];
  for (let turn = 1; turn <= turns; turn += 1) {
    const createdAt = new Date(Date.UTC(2026, 10, 11, 12, turn)).toISOString();
    const replyMessageId = automaticId(101 + turn * 2);
    messages.push({ id: automaticId(100 + turn * 2), role: "explorer", body: `Invented message ${turn}`, createdAt });
    messages.push({ id: replyMessageId, role: "virtualGuide", body: `Invented reply ${turn}`, createdAt });
    if (turn < 3 || turn > 10) continue;
    const index = turn - 3;
    const anchor = EXPLORER_COMPASS_ANCHORS[index];
    const label = index === 0 ? AUTOMATIC_LABEL : `Ordinary topic ${index + 1}`;
    const pointId = automaticId(500 + index);
    compassItems.push({ id: pointId, sourceMessageId: replyMessageId, formation: "automatic",
      topicId: automaticId(600 + index), label, anchor, emphasis: 1 });
    compassChanges.push({ operationId: automaticId(700 + index), replyMessageId, revision: turn * 2,
      changes: [{ kind: "added", pointId, label, anchor, noticeKind: anchor === "apex" ? "early_topic" : "not_yet_clear" }] });
  }
  return { version: "explorer-conversation.v1", conversationId: turns === 0 ? null : automaticId(1),
    revision: turns * 2, pendingTurn: false, turnedDownLimitReached: false,
    compassMode: "automatic", compassChanges, providerState: "available", compassSuggestionReplies: "available",
    messages, compassItems, priorityId: null, attentionId: compassItems[0]?.id ?? null,
    route: [], sessionStatus: turns === 0 ? null : "active", ending: null, waypoints: [], waypointDraft: null,
    waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 0, hasMore: false } };
}

// Each reply may add at most three points. The third and fourth replies add
// separate bundles so their disclosure controls can be exercised independently.
export function automaticMultiChangeState(turns = 3): ExplorerConversationState {
  if (turns < 3) return automaticState(turns);
  const state = automaticState(turns);
  const source = automaticState(turns >= 4 ? 8 : 5);
  const compassItems = source.compassItems.map((point, index) => ({ ...point,
    sourceMessageId: state.messages[index < 3 ? 5 : 7].id,
    label: index === 2
      ? "Leaving room for an unhurried walk and a familiar conversation after everyday responsibilities, with time to notice what matters along the way"
      : point.label,
  }));
  const compassChanges = [0, ...(turns >= 4 ? [3] : [])].map(start => ({
    operationId: automaticId(700 + start),
    replyMessageId: state.messages[start === 0 ? 5 : 7].id,
    revision: start === 0 ? 6 : 8,
    changes: compassItems.slice(start, start + 3).map(point => ({
      kind: "added" as const, pointId: point.id, label: point.label, anchor: point.anchor!,
      noticeKind: point.anchor === "apex" ? "early_topic" as const : "not_yet_clear" as const,
    })),
  }));
  return { ...state, compassItems, compassChanges, attentionId: compassItems[0].id };
}
