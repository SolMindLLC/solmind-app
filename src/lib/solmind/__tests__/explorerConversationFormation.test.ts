import { describe, expect, it } from "vitest";
import {
  EXPLORER_CONVERSATION_VERSION,
  EXPLORER_COMPASS_ANCHORS,
  type ExplorerCompassArrangementItem,
  type ExplorerConversationState,
} from "../explorerConversationContract";
import {
  buildAttentionFormationIntent,
  buildCompassFormationIntent,
  buildCompassArrangementFormationIntent,
  buildCompassCategoryFormationIntent,
  buildPriorityFormationIntent,
  buildReachedFormationIntent,
  buildWaypointFormationIntent,
  findFormationSource,
  currentCompassHeads,
  compassCategorySources,
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
    const full = state({ compassItems: Array.from({ length: 24 }, (_, index) => ({ ...items[0], id: `point-${index}` })), priorityId: "point-0" });
    expect(buildCompassFormationIntent(full, { sourceMessageId: source.id, label: "Another" }).ok).toBe(false);
    expect(full.compassItems).toHaveLength(24);
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


describe("Explorer-reviewed Compass arrangement intents", () => {
  const arrangement = (): ExplorerCompassArrangementItem[] => [
    { compassItemId: items[0].id, anchor: "apex", emphasis: 3 },
    { compassItemId: items[1].id, anchor: "side_left", emphasis: 1 },
  ];

  it("requires explicit confirmation and freezes the complete intent without supplying authority or captured labels", () => {
    const current = state({ compassItems: items });
    const selected = arrangement();
    expect(buildCompassArrangementFormationIntent(current, null, selected, false).ok).toBe(false);
    const result = buildCompassArrangementFormationIntent(current, null, selected, true);
    expect(result).toEqual({ ok: true, error: null,
      command: { kind: "confirm_compass_arrangement", priorityId: null, items: selected } });
    if (!result.ok || result.command.kind !== "confirm_compass_arrangement") throw new Error("expected_arrangement_intent");
    expect(Object.keys(result.command).sort()).toEqual(["items", "kind", "priorityId"]);
    expect(Object.isFrozen(result.command)).toBe(true);
    expect(Object.isFrozen(result.command.items)).toBe(true);
    expect(Object.isFrozen(result.command.items[0])).toBe(true);
    expect(result.command.items).not.toBe(selected);
    selected[0] = { ...selected[0], anchor: null, emphasis: 1 };
    expect(result.command.items[0]).toEqual({ compassItemId: items[0].id, anchor: "apex", emphasis: 3 });
    expect(current.priorityId).toBeNull();
    expect(current.attentionId).toBeNull();
    expect(current.compassItems).toEqual(items);
  });

  it("permits deliberate Priority reorientation only at the apex while retaining current attention", () => {
    const current = state({ compassItems: items, priorityId: items[0].id, attentionId: items[0].id });
    const selected = [
      { compassItemId: items[0].id, anchor: "side_left", emphasis: 1 },
      { compassItemId: items[1].id, anchor: "apex", emphasis: 3 },
    ] satisfies ExplorerCompassArrangementItem[];
    const result = buildCompassArrangementFormationIntent(current, items[1].id, selected, true);
    expect(result.command).toEqual({ kind: "confirm_compass_arrangement", priorityId: items[1].id, items: selected });
    expect(current.priorityId).toBe(items[0].id);
    expect(current.attentionId).toBe(items[0].id);
    expect(buildCompassArrangementFormationIntent(current, null, selected, true).ok).toBe(false);
    expect(buildCompassArrangementFormationIntent(current, items[0].id, selected, true).ok).toBe(false);
    expect(buildCompassArrangementFormationIntent(current, items[1].id,
      [{ ...selected[0], anchor: null }, selected[1]], true).ok).toBe(false);
  });

  it("refuses incomplete, duplicate, foreign or incoherent selections without changing saved points", () => {
    const current = state({ compassItems: items });
    for (const selected of [
      [], [arrangement()[0]], [...arrangement(), { compassItemId: "foreign-point", anchor: null, emphasis: 1 }],
      [arrangement()[0], { ...arrangement()[1], compassItemId: items[0].id }],
      [arrangement()[0], { ...arrangement()[1], compassItemId: "foreign-point" }],
      [arrangement()[0], { ...arrangement()[1], anchor: "apex" }],
    ] satisfies ExplorerCompassArrangementItem[][]) {
      expect(buildCompassArrangementFormationIntent(current, null, selected, true).ok).toBe(false);
    }
    expect(buildCompassArrangementFormationIntent(current, "foreign-point", arrangement(), true).ok).toBe(false);
    expect(current.compassItems).toEqual(items);
    expect(current.priorityId).toBeNull();
    expect(current.attentionId).toBeNull();
  });

  it("retains 24 total points with eight visible and 16 Other paths, and permits the ninth saved point", () => {
    const points = Array.from({ length: 24 }, (_, index) => ({ ...items[0], id: `point-${index}` }));
    const selected: ExplorerCompassArrangementItem[] = points.map((point, index) => ({ compassItemId: point.id,
      anchor: index < 8 ? EXPLORER_COMPASS_ANCHORS[index] : null, emphasis: 2 }));
    const result = buildCompassArrangementFormationIntent(state({ compassItems: points }), null, selected, true);
    expect(result.ok).toBe(true);
    if (!result.ok || result.command.kind !== "confirm_compass_arrangement") throw new Error("expected_full_arrangement");
    expect(result.command.items).toHaveLength(24);
    expect(result.command.items.filter(item => item.anchor !== null)).toHaveLength(8);
    expect(result.command.items.filter(item => item.anchor === null)).toHaveLength(16);
    expect(buildCompassFormationIntent(state({ compassItems: points.slice(0, 8) }),
      { sourceMessageId: source.id, label: "The ninth retained point" }).command)
      .toEqual({ kind: "add_compass", sourceMessageId: source.id, label: "The ninth retained point" });
    expect(buildCompassFormationIntent(state({ compassItems: points }),
      { sourceMessageId: source.id, label: "A twenty-fifth point" }).ok).toBe(false);
  });
});

describe("Explorer-reviewed category wording and combination", () => {
  const retained = [
    { ...items[0], anchor: "apex" as const, emphasis: 2 as const, mergedIntoItemId: null },
    { ...items[1], anchor: "upper_left" as const, emphasis: 3 as const, mergedIntoItemId: null },
    { id: "point-c", sourceMessageId: source.id, label: "Original supporting detail", anchor: "upper_left" as const,
      emphasis: 1 as const, mergedIntoItemId: items[1].id },
    { id: "point-d", sourceMessageId: source.id, label: "Older supporting detail", anchor: null, emphasis: 2 as const, mergedIntoItemId: "point-c" },
  ];
  const categoryDraft = { targetItemId: items[0].id, memberItemIds: [items[1].id, items[0].id], label: "  Morning connection  ", confirmed: true };

  it("shows only current heads and retains every transitive original source point", () => {
    const current = state({ compassItems: retained });
    expect(currentCompassHeads(current).map(item => item.id)).toEqual([items[0].id, items[1].id]);
    expect(compassCategorySources(current, items[1].id).map(item => item.id)).toEqual([items[1].id, "point-c", "point-d"]);
    expect(compassCategorySources(current, items[0].id)).toEqual([retained[0]]);
    expect(compassCategorySources(current, "point-c")).toEqual([]);
    expect(Object.isFrozen(currentCompassHeads(current))).toBe(true);
    expect(Object.isFrozen(compassCategorySources(current, items[1].id))).toBe(true);
    expect(current.compassItems).toHaveLength(4);
  });

  it("requires reviewed meaning and emits a copied canonical member set without authority/history fields", () => {
    const current = state({ compassItems: retained, priorityId: items[0].id, attentionId: items[0].id });
    expect(buildCompassCategoryFormationIntent(current, { ...categoryDraft, confirmed: false }).ok).toBe(false);
    const draft = { ...categoryDraft, memberItemIds: [...categoryDraft.memberItemIds] };
    const result = buildCompassCategoryFormationIntent(current, draft);
    expect(result).toEqual({ ok: true, error: null, command: { kind: "confirm_compass_category", targetItemId: items[0].id,
      memberItemIds: [items[0].id, items[1].id], label: "Morning connection" } });
    if (!result.ok || result.command.kind !== "confirm_compass_category") throw new Error("expected_category");
    expect(Object.isFrozen(result.command.memberItemIds)).toBe(true);
    draft.memberItemIds[0] = "another-point";
    expect(result.command.memberItemIds).toEqual([items[0].id, items[1].id]);
    expect(Object.keys(result.command).sort()).toEqual(["kind", "label", "memberItemIds", "targetItemId"]);
    expect(current.priorityId).toBe(items[0].id);
    expect(current.attentionId).toBe(items[0].id);
    expect(current.compassItems).toEqual(retained);
  });

  it("permits reviewed broadening without an implicit Priority, layout or attention transfer", () => {
    const current = state({ compassItems: retained });
    expect(buildCompassCategoryFormationIntent(current, { ...categoryDraft, memberItemIds: [items[0].id] }).command)
      .toEqual({ kind: "confirm_compass_category", targetItemId: items[0].id, memberItemIds: [items[0].id], label: "Morning connection" });
    expect(buildCompassCategoryFormationIntent(current, { ...categoryDraft, memberItemIds: [items[0].id], label: retained[0].label }).ok).toBe(false);
    expect(current.priorityId).toBeNull();
    expect(current.attentionId).toBeNull();
    expect(retained[0].anchor).toBe("apex");
    expect(retained[0].emphasis).toBe(2);
  });

  it("refuses combining away current Priority or attention until they are moved explicitly", () => {
    for (const selected of [
      { priorityId: items[1].id, attentionId: items[0].id },
      { priorityId: items[0].id, attentionId: items[1].id },
      { priorityId: null, attentionId: items[1].id },
    ]) {
      const current = state({ compassItems: retained, ...selected });
      expect(buildCompassCategoryFormationIntent(current, categoryDraft).ok).toBe(false);
      expect(current.priorityId).toBe(selected.priorityId);
      expect(current.attentionId).toBe(selected.attentionId);
    }
  });

  it("rejects stale lifecycle, malformed wording and missing/retired/duplicate member selections", () => {
    const current = state({ compassItems: retained });
    for (const lifecycle of [state({ ...current, pendingTurn: true }), state({ ...current, conversationId: null }),
      state({ ...current, sessionStatus: "ended", ending: null })]) {
      expect(buildCompassCategoryFormationIntent(lifecycle, categoryDraft).ok).toBe(false);
    }
    for (const memberItemIds of [[], [items[1].id], [items[0].id, items[0].id], [items[0].id, "point-c"], [items[0].id, "foreign-point"]]) {
      expect(buildCompassCategoryFormationIntent(current, { ...categoryDraft, memberItemIds }).ok).toBe(false);
    }
    expect(buildCompassCategoryFormationIntent(current, { ...categoryDraft, targetItemId: "point-c" }).ok).toBe(false);
    for (const label of ["", " ", "two\nlines", "bad\ud800text", "x".repeat(161)]) {
      expect(buildCompassCategoryFormationIntent(current, { ...categoryDraft, label }).ok).toBe(false);
    }
  });

  it("arranges only current heads without freeing the 24-row stored bound or selecting retired originals", () => {
    const current = state({ compassItems: retained, priorityId: items[0].id, attentionId: items[0].id });
    const selected: ExplorerCompassArrangementItem[] = [
      { compassItemId: items[0].id, anchor: "apex", emphasis: 2 },
      { compassItemId: items[1].id, anchor: "upper_left", emphasis: 3 },
    ];
    expect(buildCompassArrangementFormationIntent(current, items[0].id, selected, true).ok).toBe(true);
    expect(buildCompassArrangementFormationIntent(current, items[0].id,
      [...selected, { compassItemId: "point-c", anchor: null, emphasis: 1 }], true).ok).toBe(false);
    expect(buildPriorityFormationIntent(current, "point-c", true).ok).toBe(false);
    expect(buildAttentionFormationIntent(current, "point-c").ok).toBe(false);
    const full = state({ compassItems: Array.from({ length: 24 }, (_, index) => ({ ...retained[0], id: `stored-${index}`,
      mergedIntoItemId: index === 0 ? null : "stored-0" })) });
    expect(currentCompassHeads(full)).toHaveLength(1);
    expect(buildCompassFormationIntent(full, { sourceMessageId: source.id, label: "Another point" }).ok).toBe(false);
  });
});
