import { describe, expect, it } from "vitest";
import {
  parseExplorerConversationState, parseExplorerWaypointCapacity, waypointHasCapacity,
  type ExplorerConversationState,
} from "../explorerConversationContract";
import { waypointLimitReached } from "../explorerWaypointDraft";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const capacity = () => ({ activeCount: 1, activeLimit: 20, historyRoom: true, conversationRoom: true });
const waypoint = (n = 3) => ({ id: uuid(n), sourceMessageId: uuid(2), isCurrent: true,
  createdAt: "2026-11-06T15:00:00Z", title: "A calm morning", destination: "Time together",
  meaning: "Connection", arrivalSignal: "An unhurried breakfast", status: "chosen" as const });
function state(): ExplorerConversationState {
  return { version: "explorer-conversation.v1", conversationId: uuid(1), revision: 4,
    pendingTurn: false, turnedDownLimitReached: false, providerState: "available",
    compassItems: [], priorityId: null, attentionId: null, waypointDraft: null,
    messages: [{ id: uuid(2), role: "explorer", body: "I want time with family.", createdAt: "2026-11-06T14:00:00Z" }],
    waypoints: [waypoint()], waypointCapacity: capacity(),
    waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 1, hasMore: false } };
}

describe("server-owned active and history capacity", () => {
  it("requires closed capacity and freezes it without deriving the total from displayed heads", () => {
    const input = { ...state(), waypointCapacity: { ...capacity(), activeCount: 25 } };
    const parsed = parseExplorerConversationState(input);
    expect(parsed?.waypointCapacity).toEqual({ activeCount: 25, activeLimit: 20, historyRoom: true, conversationRoom: true });
    expect(Object.isFrozen(parsed?.waypointCapacity)).toBe(true);
    input.waypointCapacity.activeCount = 0;
    expect(parsed?.waypointCapacity.activeCount).toBe(25);
    expect(parsed && waypointHasCapacity(parsed)).toBe(false);
    expect(parsed && waypointHasCapacity(parsed, "revision")).toBe(true);
  });

  it("supplies global capacity before a conversation exists", () => {
    const initial = { ...state(), conversationId: null, revision: 0, messages: [], waypoints: [],
      waypointCapacity: { ...capacity(), activeCount: 20 },
      waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 0, hasMore: false } };
    expect(parseExplorerConversationState(initial)?.waypointCapacity.activeCount).toBe(20);
  });

  it("fails closed on missing, malformed, accessor or expanded capacity", () => {
    const accessor = Object.defineProperty({ activeLimit: 20, historyRoom: true, conversationRoom: true }, "activeCount", {
      enumerable: true, get() { throw new Error("must_not_execute"); },
    });
    for (const malformed of [undefined, null, {}, [], { ...capacity(), extra: true },
      { ...capacity(), activeCount: -1 }, { ...capacity(), activeCount: 1.5 },
      { ...capacity(), activeCount: Number.MAX_SAFE_INTEGER + 1 }, { ...capacity(), activeCount: "20" },
      { ...capacity(), activeLimit: 0 }, { ...capacity(), activeLimit: NaN },
      { ...capacity(), historyRoom: "true", conversationRoom: true }, { ...capacity(), historyRoom: undefined, conversationRoom: true },
      { ...capacity(), [Symbol("hidden")]: true }, accessor,
      { activeCount: 1, activeLimit: 20, historyRoom: true }, { ...capacity(), conversationRoom: "true" },
      { ...capacity(), conversationRoom: null }]) {
      expect(parseExplorerWaypointCapacity(malformed)).toBeNull();
      expect(parseExplorerConversationState({ ...state(), waypointCapacity: malformed })).toBeNull();
      const unsafe = { waypointCapacity: malformed } as ExplorerConversationState;
      expect(waypointHasCapacity(unsafe)).toBe(false);
      expect(waypointHasCapacity(unsafe, "revision")).toBe(false);
    }
    const { waypointCapacity: omitted, ...missing } = state(); void omitted;
    expect(parseExplorerConversationState(missing)).toBeNull();
    for (const field of ["waypointCapacity", "waypointProjection"]) {
      const unsafe = Object.defineProperty(state(), field, { enumerable: true,
        get() { throw new Error("must_not_execute"); } });
      expect(parseExplorerConversationState(unsafe)).toBeNull();
    }
  });

  it("requires history room for all inserts and active room only for increases", () => {
    expect(waypointLimitReached({ ...state(), waypointCapacity: { ...capacity(), activeCount: 20 } })).toBe(true);
    expect(waypointLimitReached({ ...state(), waypointCapacity: { ...capacity(), activeCount: 19 } })).toBe(false);
    const full = { ...state(), waypointCapacity: { ...capacity(), activeCount: 0, historyRoom: false, conversationRoom: true } };
    expect(waypointLimitReached(full)).toBe(true);
    expect(waypointHasCapacity(full, "revision")).toBe(false);
    // Read projection bounds never supply product limits.
    expect(waypointHasCapacity({ waypointCapacity: { activeCount: 6, activeLimit: 7, historyRoom: true, conversationRoom: true } })).toBe(true);
    expect(waypointHasCapacity({ waypointCapacity: { activeCount: 7, activeLimit: 7, historyRoom: true, conversationRoom: true } })).toBe(false);
  });

  it("lane 12: a full conversation refuses only a new Waypoint; revisits and revisions continue existing ones", () => {
    const fiveHere = { ...state(), waypointCapacity: { ...capacity(), conversationRoom: false } };
    expect(waypointHasCapacity(fiveHere)).toBe(false);
    expect(waypointLimitReached(fiveHere)).toBe(true);
    expect(waypointHasCapacity(fiveHere, "revisit")).toBe(true);
    expect(waypointHasCapacity(fiveHere, "revision")).toBe(true);
    const fiveAndTwenty = { ...state(), waypointCapacity: { ...capacity(), activeCount: 20, conversationRoom: false } };
    expect(waypointHasCapacity(fiveAndTwenty, "revisit")).toBe(false);
    expect(waypointHasCapacity(fiveAndTwenty, "revision")).toBe(true);
    expect(parseExplorerConversationState(fiveHere)?.waypointCapacity.conversationRoom).toBe(false);
  });
});

describe("explicitly partial authoritative current-head projection", () => {
  it("accepts a head whose complete revision chain is outside the page and preserves provenance", () => {
    const head = { ...waypoint(203), lifecycle: { predecessorWaypointId: uuid(202), creationReason: "revision",
      clarifications: [{ component: "destination", questionKey: "waypoint.destination.v1", answer: "Time together",
        recordedAt: "2026-11-06T15:00:00Z" }] } };
    const parsed = parseExplorerConversationState({ ...state(), waypoints: [head] });
    expect(parsed?.waypoints[0]).toEqual(head);
    expect(Object.isFrozen(parsed?.waypointProjection)).toBe(true);
    expect(parsed?.waypoints[0].sourceMessageId).toBe(uuid(2));
    expect(parsed?.waypoints[0].lifecycle?.predecessorWaypointId).toBe(uuid(202));
  });

  it("requires consistent metadata and explicit currentness instead of absent local successors", () => {
    const { waypointProjection: omitted, ...missing } = state(); void omitted;
    expect(parseExplorerConversationState(missing)).toBeNull();
    for (const malformed of [null, {}, { ...state().waypointProjection, kind: "all" },
      { ...state().waypointProjection, totalHeads: 0 }, { ...state().waypointProjection, totalHeads: 2 },
      { ...state().waypointProjection, hasMore: true }, { ...state().waypointProjection, limit: 200 },
      { ...state().waypointProjection, totalHeads: 1.5 }, { ...state().waypointProjection, extra: true }]) {
      expect(parseExplorerConversationState({ ...state(), waypointProjection: malformed })).toBeNull();
    }
    for (const item of [{ ...waypoint(), isCurrent: false }, { ...waypoint(), isCurrent: undefined },
      { ...waypoint(), createdAt: undefined }, { ...waypoint(), createdAt: "invalid" },
      { ...waypoint(), sourceMessageId: uuid(999) }]) {
      expect(parseExplorerConversationState({ ...state(), waypoints: [item] })).toBeNull();
    }
  });

  it("bounds maximum Unicode and escaped history independently from two hundred stored records", () => {
    const text = '\\"\n\ud83e\udded'.repeat(200);
    expect(text.length).toBe(1000);
    const heads = Array.from({ length: 20 }, (_, n) => ({ ...waypoint(n + 3),
      title: text, destination: text, meaning: text, arrivalSignal: text }));
    const original = { ...state(), waypoints: heads,
      waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 200, hasMore: true } };
    const parsed = parseExplorerConversationState(original);
    expect(parsed?.waypoints).toHaveLength(20);
    expect(parsed?.waypointProjection.totalHeads).toBe(200);
    expect(JSON.stringify(original).length).toBeLessThan(1_200_000);
    expect(parseExplorerConversationState({ ...original, waypoints: [...heads, waypoint(99)] })).toBeNull();
  });
});
