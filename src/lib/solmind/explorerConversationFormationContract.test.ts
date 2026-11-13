import { describe, expect, it } from "vitest";

import { CARD_POINTS, cardState as historicalCardState } from "../../../tests/browser/connectedCardFixture";
import { parseExplorerConversationState } from "./explorerConversationContract";
import {
  buildAttentionFormationIntent,
  buildCompassArrangementFormationIntent,
  buildCompassCategoryFormationIntent,
  buildPriorityFormationIntent,
  compassCategorySources,
  currentCompassHeads,
  savedCompassHeads,
} from "./explorerConversationFormation";

function cardState(...args: Parameters<typeof historicalCardState>) {
  return { ...historicalCardState(...args), compassMode: "legacy" as const, compassChanges: [] };
}

describe("S5 optional browser Compass formation", () => {
  it("keeps forming attention separate from saved arrangement, Priority and category snapshots", () => {
    const original = cardState();
    const state = cardState({ attentionId: CARD_POINTS.unarranged,
      compassItems: original.compassItems.map(item => item.id === CARD_POINTS.unarranged
        ? { ...item, formation: "forming" } : item) });
    expect(currentCompassHeads(state).some(item => item.id === CARD_POINTS.unarranged)).toBe(true);
    expect(savedCompassHeads(state).some(item => item.id === CARD_POINTS.unarranged)).toBe(false);
    const arrangement = savedCompassHeads(state).map(item => ({ compassItemId: item.id,
      anchor: item.anchor ?? null, emphasis: item.emphasis ?? 1 }));
    expect(buildCompassArrangementFormationIntent(state, state.priorityId, arrangement, true)).toMatchObject({ ok: true });
    expect(buildCompassArrangementFormationIntent(state, state.priorityId, [...arrangement,
      { compassItemId: CARD_POINTS.unarranged, anchor: null, emphasis: 1 }], true).ok).toBe(false);
    expect(buildCompassArrangementFormationIntent({ ...state, attentionId: CARD_POINTS.otherPath }, state.priorityId, arrangement, true).ok).toBe(false);
    expect(buildPriorityFormationIntent(state, CARD_POINTS.unarranged, true).ok).toBe(false);
    expect(buildCompassCategoryFormationIntent(state, { targetItemId: CARD_POINTS.unarranged,
      memberItemIds: [CARD_POINTS.unarranged], label: "Revised wording", confirmed: true }).ok).toBe(false);
    expect(buildCompassCategoryFormationIntent(state, { targetItemId: CARD_POINTS.detour,
      memberItemIds: [CARD_POINTS.detour, CARD_POINTS.unarranged], label: "Combined wording", confirmed: true }).ok).toBe(false);
    expect(compassCategorySources(state, CARD_POINTS.unarranged)).toEqual([]);
    expect(buildAttentionFormationIntent(original, CARD_POINTS.unarranged).ok).toBe(true);
    expect(buildAttentionFormationIntent({ ...state, attentionId: CARD_POINTS.detour }, CARD_POINTS.unarranged).ok).toBe(true);
  });

  it("preserves old fixtures and copies only saved or forming markers", () => {
    const original = cardState();
    expect(parseExplorerConversationState(original)).toEqual(original);
    const compassItems = original.compassItems.map((item, index) => ({ ...item,
      formation: index === 6 ? "forming" : "saved" }));
    const state = { ...original, compassItems, attentionId: CARD_POINTS.unarranged };
    const parsed = parseExplorerConversationState(state);
    expect(parsed).toEqual(state);
    expect(Object.isFrozen(parsed?.compassItems)).toBe(true);
    expect(Object.isFrozen(parsed?.compassItems[6])).toBe(true);
    compassItems[6].formation = "saved";
    compassItems[6].label = "Changed caller copy";
    expect(parsed?.compassItems[6].formation).toBe("forming");
    expect(parsed?.compassItems[6].label).toBe(original.compassItems[6].label);
  });

  it("rejects private statuses, malformed markers and raw internal wording provenance", () => {
    const original = cardState();
    const withItem = (extra: Record<string, unknown>) => ({ ...original,
      compassItems: original.compassItems.map((item, index) => index === 6 ? { ...item, ...extra } : item) });
    for (const formation of [undefined, null, "", "proposed", "confirmed", "rejected", "Forming", "forming\n", 1, {}, []]) {
      expect(parseExplorerConversationState(withItem({ formation })), String(formation)).toBeNull();
    }
    for (const extra of [
      { formation_status: "proposed" },
      { wording_message_id: original.messages[1].id },
    ]) expect(parseExplorerConversationState(withItem(extra))).toBeNull();
  });

  it("keeps the 24-point bound and strict selectors when formation is present", () => {
    const original = cardState();
    const items = Array.from({ length: 24 }, (_, index) => ({
      id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      sourceMessageId: original.messages[1].id, label: `Forming topic ${index + 1}`, formation: "forming",
    }));
    const state = { ...original, compassItems: items, priorityId: null, attentionId: items[23].id };
    expect(parseExplorerConversationState(state)).toEqual(state);
    expect(parseExplorerConversationState({ ...state, compassItems: [...items, {
      ...items[0], id: "40000000-0000-4000-8000-000000000025",
    }] })).toBeNull();
    expect(parseExplorerConversationState({ ...state, attentionId: CARD_POINTS.merged })).toBeNull();
    expect(parseExplorerConversationState({ ...state, compassItems: items.map((item, index) => index === 0
      ? { ...item, sourceMessageId: CARD_POINTS.priority } : item) })).toBeNull();
  });
});
