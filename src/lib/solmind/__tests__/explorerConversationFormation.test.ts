import { describe, expect, it } from "vitest";
import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../explorerConversationContract";
import {
  buildAttentionFormationIntent,
  buildCompassFormationIntent,
  buildPriorityFormationIntent,
  buildReachedFormationIntent,
  buildWaypointFormationIntent,
  findFormationSource,
} from "../explorerConversationFormation";

const source = { id: "saved-message-a", role: "explorer" as const, body: "I want calmer mornings.", createdAt: "2026-10-24T05:00:00.000Z" };
function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return {
    version: EXPLORER_CONVERSATION_VERSION,
    conversationId: "conversation-a", revision: 4, providerState: "unavailable", pendingTurn: false,
    messages: [source], compassItems: [], priorityId: null, attentionId: null, waypoints: [],
    ...overrides,
  };
}
const items = [
  { id: "point-a", sourceMessageId: source.id, label: "Calmer mornings" },
  { id: "point-b", sourceMessageId: source.id, label: "Being heard" },
];
const waypoint = {
  id: "waypoint-a", sourceMessageId: source.id, destination: "A calmer start to the day",
  meaning: "I can connect with my family", arrivalSignal: "I notice an unhurried family breakfast",
  status: "chosen" as const,
};
const draft = {
  sourceMessageId: source.id, destination: waypoint.destination,
  meaning: waypoint.meaning, arrivalSignal: waypoint.arrivalSignal, confirmed: true,
};

describe("Explorer-owned formation command boundaries", () => {
  it("permits empty Discovery without inventing a source, topic, Priority or Waypoint", () => {
    const empty = state({ conversationId: null, messages: [] });
    expect(findFormationSource(empty, source.id)).toBeNull();
    expect(buildCompassFormationIntent(empty, { sourceMessageId: source.id, label: "Morning" }).ok).toBe(false);
    expect(buildWaypointFormationIntent(empty, draft).ok).toBe(false);
    expect(empty.compassItems).toEqual([]);
    expect(empty.priorityId).toBeNull();
    expect(empty.waypoints).toEqual([]);
  });

  it("uses an exact saved source selector and only the Explorer's supplied label", () => {
    const original = state();
    const result = buildCompassFormationIntent(original, { sourceMessageId: source.id, label: "  My own words  " });
    expect(result).toEqual({ ok: true, error: null, command: { kind: "add_compass", sourceMessageId: source.id, label: "My own words" } });
    expect(original.compassItems).toEqual([]);
    expect(original.messages[0]).toBe(source);
    expect(buildCompassFormationIntent(original, { sourceMessageId: ` ${source.id}`, label: "Morning" }).ok).toBe(false);
    expect(buildCompassFormationIntent(original, { sourceMessageId: "another-conversation-message", label: "Morning" }).ok).toBe(false);
  });

  it("can use a saved Virtual Guide source without claiming its interpretation as confirmed fact", () => {
    const guideSource = { ...source, id: "saved-guide-message", role: "virtualGuide" as const, body: "What would calmer mornings look like?" };
    const result = buildCompassFormationIntent(state({ messages: [guideSource] }), { sourceMessageId: guideSource.id, label: "My morning choice" });
    expect(result.ok && result.command.kind).toBe("add_compass");
    expect(result.ok && result.command).toHaveProperty("label", "My morning choice");
    expect(result.command).not.toHaveProperty("priorityId");
  });

  it.each(["", " \t ", "x".repeat(161), "two\nlines", "bad\u0000text", "bad\ud800text", "bad\u0085text", "two\u2028lines", "two\u2029lines"])("rejects an invalid single-line label (%j)", label => {
    expect(buildCompassFormationIntent(state(), { sourceMessageId: source.id, label }).ok).toBe(false);
  });

  it("bounds Compass additions without dropping any existing point or moving Priority", () => {
    const full = state({ compassItems: Array.from({ length: 8 }, (_, index) => ({ ...items[0], id: `point-${index}` })), priorityId: "point-0" });
    expect(buildCompassFormationIntent(full, { sourceMessageId: source.id, label: "Another" }).ok).toBe(false);
    expect(full.compassItems).toHaveLength(8);
    expect(full.priorityId).toBe("point-0");
  });

  it("requires explicit Priority confirmation and leaves attention unchanged", () => {
    const current = state({ compassItems: items, priorityId: items[0].id, attentionId: items[0].id });
    expect(buildPriorityFormationIntent(current, items[1].id, false).ok).toBe(false);
    expect(buildPriorityFormationIntent(current, "unknown", true).ok).toBe(false);
    expect(buildPriorityFormationIntent(current, items[0].id, true).ok).toBe(false);
    expect(buildPriorityFormationIntent(current, items[1].id, true).command).toEqual({ kind: "confirm_priority", itemId: items[1].id });
    expect(current.attentionId).toBe(items[0].id);
    expect(current.priorityId).toBe(items[0].id);
  });

  it("moves attention only by explicit intent and does not confirm a new Priority", () => {
    const current = state({ compassItems: items, priorityId: items[0].id, attentionId: items[0].id });
    expect(buildAttentionFormationIntent(current, items[1].id).command).toEqual({ kind: "set_attention", itemId: items[1].id });
    expect(buildAttentionFormationIntent(current, "unknown").ok).toBe(false);
    expect(buildAttentionFormationIntent(current, items[0].id).ok).toBe(false);
    expect(current.priorityId).toBe(items[0].id);
  });

  it("requires all three Waypoint meanings, exact source and fresh explicit confirmation", () => {
    for (const field of ["destination", "meaning", "arrivalSignal"] as const) {
      expect(buildWaypointFormationIntent(state(), { ...draft, [field]: " " }).ok).toBe(false);
      expect(buildWaypointFormationIntent(state(), { ...draft, [field]: "x".repeat(1001) }).ok).toBe(false);
    }
    expect(buildWaypointFormationIntent(state(), { ...draft, sourceMessageId: "other-source" }).ok).toBe(false);
    expect(buildWaypointFormationIntent(state(), { ...draft, confirmed: false }).ok).toBe(false);
    const result = buildWaypointFormationIntent(state(), draft);
    expect(result.command).toEqual({
      kind: "confirm_waypoint", sourceMessageId: source.id, destination: draft.destination,
      meaning: draft.meaning, arrivalSignal: draft.arrivalSignal,
    });
    expect(result.command).not.toHaveProperty("status");
    expect(result.command).not.toHaveProperty("reached");
  });

  it("preserves Explorer paragraphs and Unicode without hidden semantic rewriting", () => {
    const result = buildWaypointFormationIntent(state(), { ...draft, meaning: "  My words\nA second line 🧭  " });
    expect(result.command).toHaveProperty("meaning", "My words\nA second line 🧭");
    expect(buildWaypointFormationIntent(state(), { ...draft, meaning: "bad\udfff" }).ok).toBe(false);
    expect(buildWaypointFormationIntent(state(), { ...draft, arrivalSignal: "bad\u0007text" }).ok).toBe(false);
    expect(buildWaypointFormationIntent(state(), { ...draft, arrivalSignal: "bad\u009ftext" }).ok).toBe(false);
  });

  it("bounds private Waypoints without changing or exposing existing ones", () => {
    const full = state({ waypoints: Array.from({ length: 20 }, (_, index) => ({ ...waypoint, id: `waypoint-${index}` })) });
    expect(buildWaypointFormationIntent(full, draft).ok).toBe(false);
    expect(full.waypoints).toHaveLength(20);
  });

  it("cannot mark Reached without saved Waypoint, supporting evidence and confirmation", () => {
    const current = state({ waypoints: [waypoint] });
    expect(buildReachedFormationIntent(current, waypoint.id, "We shared an unhurried breakfast.", false).ok).toBe(false);
    expect(buildReachedFormationIntent(current, waypoint.id, " ", true).ok).toBe(false);
    expect(buildReachedFormationIntent(current, waypoint.id, "x".repeat(1001), true).ok).toBe(false);
    expect(buildReachedFormationIntent(current, "other-waypoint", "Evidence", true).ok).toBe(false);
    expect(buildReachedFormationIntent(state({ waypoints: [{ ...waypoint, status: "reached" }] }), waypoint.id, "Evidence", true).ok).toBe(false);
    expect(buildReachedFormationIntent(current, waypoint.id, "  We shared an unhurried breakfast.  ", true).command).toEqual({
      kind: "confirm_reached", waypointId: waypoint.id, evidence: "We shared an unhurried breakfast.",
    });
    expect(current.waypoints[0].status).toBe("chosen");
  });

  it("emits no actor, session, provider, generated identity or sharing fields", () => {
    const result = buildWaypointFormationIntent(state(), draft);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected_formation_intent");
    for (const key of ["actorId", "accountId", "sessionId", "relationshipId", "providerId", "operationId", "expectedRevision", "shared", "sourceBody"]) {
      expect(result.command).not.toHaveProperty(key);
    }
    expect(Object.isFrozen(result.command)).toBe(true);
  });
});
