// Synthetic saved state for the connected Compass & Waypoint card (chat step
// slices S1 and S2): an arranged Compass with a Priority, the needle, points
// on 5 of the 8 positions, a point not yet arranged, an Other paths point and
// a combined (hidden) original, and one Waypoint at each stage, each with an
// earlier version in the test-only history fixture. The wire fixture contains
// current heads only. No real person's words. The unit test
// src/lib/solmind/__tests__/explorerConnectedCard.test.ts proves that the
// closed browser parser accepts it.
import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";

export const CARD_CONVERSATION = "10000000-0000-4000-8000-0000000000c1";
const message = (index: number, role: "explorer" | "virtualGuide", body: string) => ({
  id: `${role === "explorer" ? "2" : "3"}0000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`,
  role,
  body,
  createdAt: `2026-11-03T14:${String(index).padStart(2, "0")}:00.000Z`,
});
const MESSAGES = [
  message(1, "explorer", "A synthetic test message: I keep putting off a talk with my sister."),
  message(2, "virtualGuide", "A synthetic saved reply: what would you most want from that talk?"),
  message(3, "explorer", "A synthetic test message: to be heard, and to plan what to say."),
  message(4, "virtualGuide", "A synthetic saved reply: rest and money both came up too."),
];
const EXPLORER_SOURCE = MESSAGES[0].id;
const GUIDE_SOURCE = MESSAGES[1].id;

export const CARD_POINTS = Object.freeze({
  priority: "40000000-0000-4000-8000-0000000000c1",
  attention: "40000000-0000-4000-8000-0000000000c2",
  longLabel: "40000000-0000-4000-8000-0000000000c3",
  detour: "40000000-0000-4000-8000-0000000000c4",
  excursion: "40000000-0000-4000-8000-0000000000c5",
  otherPath: "40000000-0000-4000-8000-0000000000c6",
  unarranged: "40000000-0000-4000-8000-0000000000c7",
  merged: "40000000-0000-4000-8000-0000000000c8",
});
export const CARD_LABELS = Object.freeze({
  priority: "Talk with my sister",
  attention: "What I need from it",
  longLabel: "Making room to rest after a long work week",
  detour: "Money worries",
  excursion: "Planning what to say",
  otherPath: "Avoiding hard talks",
  unarranged: "Asking for help",
  merged: "The talk I keep delaying",
});

const WAYPOINT = (suffix: string) => `60000000-0000-4000-8000-0000000000${suffix}`;
export const CARD_WAYPOINTS = Object.freeze({
  formedEarlier: WAYPOINT("a0"),
  formed: WAYPOINT("a1"),
  reachedEarlier: WAYPOINT("b0"),
  reached: WAYPOINT("b1"),
  releasedEarlier: WAYPOINT("c0"),
  released: WAYPOINT("c1"),
});

export const cardHistoryState = (overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState => ({
  version: EXPLORER_CONVERSATION_VERSION,
  conversationId: CARD_CONVERSATION,
  revision: 12,
  pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null,
  waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: true },
  waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 3, hasMore: false },
  providerState: "unavailable",
  messages: MESSAGES,
  compassItems: [
    { id: CARD_POINTS.priority, sourceMessageId: EXPLORER_SOURCE, label: CARD_LABELS.priority, anchor: "apex", emphasis: 3, mergedIntoItemId: null },
    { id: CARD_POINTS.attention, sourceMessageId: MESSAGES[2].id, label: CARD_LABELS.attention, anchor: "upper_left", emphasis: 2, mergedIntoItemId: null },
    { id: CARD_POINTS.longLabel, sourceMessageId: MESSAGES[3].id, label: CARD_LABELS.longLabel, anchor: "upper_right", emphasis: 2, mergedIntoItemId: null },
    { id: CARD_POINTS.detour, sourceMessageId: MESSAGES[3].id, label: CARD_LABELS.detour, anchor: "side_left", emphasis: 1, mergedIntoItemId: null },
    { id: CARD_POINTS.excursion, sourceMessageId: MESSAGES[2].id, label: CARD_LABELS.excursion, anchor: "lower_center", emphasis: 1, mergedIntoItemId: null },
    { id: CARD_POINTS.otherPath, sourceMessageId: GUIDE_SOURCE, label: CARD_LABELS.otherPath, anchor: null, emphasis: 1, mergedIntoItemId: null },
    { id: CARD_POINTS.unarranged, sourceMessageId: MESSAGES[2].id, label: CARD_LABELS.unarranged, anchor: null, emphasis: null, mergedIntoItemId: null },
    { id: CARD_POINTS.merged, sourceMessageId: EXPLORER_SOURCE, label: CARD_LABELS.merged, anchor: null, emphasis: null, mergedIntoItemId: CARD_POINTS.priority },
  ],
  priorityId: CARD_POINTS.priority,
  attentionId: CARD_POINTS.attention,
  waypoints: [
    { id: CARD_WAYPOINTS.formedEarlier, isCurrent: false, createdAt: "2026-11-02T10:00:00.000Z", sourceMessageId: EXPLORER_SOURCE, title: "Ask my sister for a calm hour", destination: "Ask my sister for a calm hour",
      meaning: "So we can talk without rushing", arrivalSignal: "We have a day and a time", status: "chosen" },
    { id: CARD_WAYPOINTS.reachedEarlier, isCurrent: false, createdAt: "2026-11-02T11:00:00.000Z", sourceMessageId: MESSAGES[2].id, title: "Write down what I need", destination: "Write down what I need",
      meaning: "So I do not lose my point", arrivalSignal: "I have three lines on paper", status: "reached",
      reachedEvidence: "I wrote three lines on Sunday.", reachedAt: "2026-11-02T20:00:00.000Z" },
    { id: CARD_WAYPOINTS.releasedEarlier, isCurrent: false, createdAt: "2026-11-02T12:00:00.000Z", sourceMessageId: MESSAGES[3].id, title: "Fix the budget this month", destination: "Fix the budget this month",
      meaning: "Money worry keeps me up", arrivalSignal: "The budget sheet is done",
      status: "chosen", release: { operationId: "70000000-0000-4000-8000-0000000000c1", releasedAt: "2026-11-02T21:00:00.000Z" } },
    { id: CARD_WAYPOINTS.formed, isCurrent: true, createdAt: "2026-11-03T14:10:00.000Z", sourceMessageId: EXPLORER_SOURCE, title: "Ask my sister for a calm evening", destination: "Ask my sister for a calm evening",
      meaning: "So we can talk without rushing", arrivalSignal: "We have a day and a time", status: "chosen",
      lifecycle: { predecessorWaypointId: CARD_WAYPOINTS.formedEarlier, creationReason: "revision", clarifications: [
        { component: "destination", questionKey: "waypoint.destination.v1", answer: "Ask my sister for a calm evening", recordedAt: "2026-11-03T14:10:00.000Z" },
      ] } },
    { id: CARD_WAYPOINTS.reached, isCurrent: true, createdAt: "2026-11-03T14:15:00.000Z", sourceMessageId: MESSAGES[2].id, title: "Say what I need in one sentence", destination: "Say what I need in one sentence",
      meaning: "So I do not lose my point", arrivalSignal: "I can say it out loud once", status: "reached",
      reachedEvidence: "I said it out loud this morning.", reachedAt: "2026-11-03T14:20:00.000Z",
      lifecycle: { predecessorWaypointId: CARD_WAYPOINTS.reachedEarlier, creationReason: "revisit", clarifications: [
        { component: "destination", questionKey: "waypoint.destination.v1", answer: "Say what I need in one sentence", recordedAt: "2026-11-03T14:15:00.000Z" },
        { component: "arrivalSignal", questionKey: "waypoint.arrivalSignal.v1", answer: "I can say it out loud once", recordedAt: "2026-11-03T14:15:00.000Z" },
      ] } },
    { id: CARD_WAYPOINTS.released, isCurrent: true, createdAt: "2026-11-03T14:25:00.000Z", sourceMessageId: MESSAGES[3].id, title: "Fix the budget this month", destination: "Fix the budget this month",
      meaning: "It can wait until the talk is done", arrivalSignal: "The budget sheet is done",
      status: "chosen", release: { operationId: "70000000-0000-4000-8000-0000000000c2", releasedAt: "2026-11-03T14:30:00.000Z" },
      lifecycle: { predecessorWaypointId: CARD_WAYPOINTS.releasedEarlier, creationReason: "revisit", clarifications: [
        { component: "meaning", questionKey: "waypoint.meaning.v1", answer: "It can wait until the talk is done", recordedAt: "2026-11-03T14:25:00.000Z" },
      ] } },
  ],
  route: [],
  sessionStatus: "active",
  ending: null,
  ...overrides,
});

// Conversation wire state is partial; older versions stay in the history fixture.
export function cardState(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  const original = cardHistoryState();
  const waypoints = overrides.waypoints ?? original.waypoints.filter(item => item.isCurrent);
  return { ...original, waypoints,
    waypointProjection: { kind: "current_heads", limit: 20, totalHeads: waypoints.length, hasMore: false }, ...overrides };
}

// Account-wide capacity can be full while only three local heads are displayed.
export function cardStateAtWaypointLimit(): ExplorerConversationState {
  const state = cardState();
  return { ...state, waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: true } };
}
