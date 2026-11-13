import { describe, expect, it } from "vitest";
import { automaticId, automaticMultiChangeState, automaticState } from "../../../../tests/browser/automaticCompassFixture";
import { advanceCompassChangeVisit, compassChangeText, COMPASS_EARLY_TOPIC_DRAFT, COMPASS_NOT_YET_CLEAR_DRAFT } from "../explorerCompassChanges";
import { connectedCompass, bottomRow, describeConnectedCompass, pointNeedleIntent } from "../explorerConnectedCard";
import { EXPLORER_COMPASS_ANCHORS, parseExplorerConversationState } from "../explorerConversationContract";

describe("automatic Compass display and visit receipts", () => {
  it.each([0, 1, 2, 3, 4, 10, 11])("the controlled %i-turn fixture passes the closed browser parser", turns => {
    expect(parseExplorerConversationState(automaticState(turns))).toEqual(automaticState(turns));
  });
  it.each([3, 4])("the controlled %i-turn multi-change fixture passes the closed browser parser", turns => {
    expect(parseExplorerConversationState(automaticMultiChangeState(turns))).toEqual(automaticMultiChangeState(turns));
  });
  it("draws nothing for two controlled responses, then directly maps the saved point and all eight anchors", () => {
    expect(connectedCompass(automaticState(2)).points).toEqual([]);
    expect(connectedCompass(automaticState(3)).points[0]).toMatchObject({ dialAnchor: "apex", isForming: false, isPriority: false });
    const full = connectedCompass(automaticState(11));
    expect(full.points.map(point => point.dialAnchor)).toEqual(EXPLORER_COMPASS_ANCHORS);
    expect(full.points).toHaveLength(8);
    expect(bottomRow(full)).toEqual([]);
    expect(full.priority).toBeNull();
    expect(describeConnectedCompass(full)).not.toMatch(/Priority|Forming|Other paths|Not yet arranged/);
    expect(pointNeedleIntent(automaticState(4), { ended: false, endReviewOpen: false, uncertain: false, busy: false, held: false }, automaticId(501)))
      .toEqual({ kind: "set_attention", itemId: automaticId(501) });
  });
  it("baselines all entry receipts, keeps later ones, deduplicates reads and starts fresh on return", () => {
    const baseline = advanceCompassChangeVisit(null, automaticState(3));
    expect(baseline.visible).toEqual([]);
    expect(baseline.announcement).toBe("");
    const next = advanceCompassChangeVisit(baseline, automaticState(4));
    expect(next.visible).toEqual(automaticState(4).compassChanges!.slice(1));
    expect(next.announcement).toBe(compassChangeText(next.visible[0].changes[0]));
    expect(advanceCompassChangeVisit(next, structuredClone(automaticState(4)))).toBe(next);
    const later = advanceCompassChangeVisit(next, automaticState(5));
    expect(later.visible).toHaveLength(2);
    expect(later.announcement).toBe(compassChangeText(later.visible[1].changes[0]));
    expect(later.announcement).not.toContain(next.visible[0].changes[0].label);
    expect(advanceCompassChangeVisit(null, automaticState(5)).visible).toEqual([]);
    expect(advanceCompassChangeVisit(later, { ...automaticState(5), conversationId: automaticId(2) }).visible).toEqual([]);
  });
  it("keeps an empty conversation's baseline through its first saved id and uses receipt order for three additions", () => {
    const state = automaticState(5);
    const bundle = { ...state.compassChanges![0], changes: state.compassChanges!.flatMap(entry => entry.changes) };
    const baseline = advanceCompassChangeVisit(null, automaticState());
    const visit = advanceCompassChangeVisit(baseline, { ...state, compassChanges: [bundle] });
    expect(visit.visible).toEqual([bundle]);
    expect(visit.announcement).toBe(bundle.changes.map(compassChangeText).join(" "));
    expect(advanceCompassChangeVisit(visit, { ...state, compassChanges: [bundle, bundle] })).toBe(visit);
    expect(advanceCompassChangeVisit(visit, { ...state, compassChanges: [{ ...bundle, operationId: automaticId(999) }] })).toBe(visit);
  });
  it("uses exactly the approved text and inserts a full label literally, never reply prose or replacement tokens", () => {
    const change = automaticState(3).compassChanges![0].changes[0];
    expect(compassChangeText({ ...change, label: "<topic> $& [label]" })).toBe(
      "New on your Compass: <topic> $& [label]. This may be an early topic, so it starts at the top; it may not be what matters most to you.");
    expect(COMPASS_EARLY_TOPIC_DRAFT).toContain("[label]");
    expect(COMPASS_NOT_YET_CLEAR_DRAFT).toBe("New on your Compass: [label]. It is not yet clear how much it matters to you.");
  });
  it("shows the approved early-topic sentence for the first point and not-yet-clear sentence for every later addition", () => {
    const changes = automaticState(10).compassChanges!.flatMap(bundle => bundle.changes);
    expect(changes[0].anchor).toBe("apex");
    expect(compassChangeText(changes[0])).toBe(`New on your Compass: ${changes[0].label}. This may be an early topic, so it starts at the top; it may not be what matters most to you.`);
    for (const change of changes.slice(1)) {
      expect(compassChangeText(change)).toBe(`New on your Compass: ${change.label}. It is not yet clear how much it matters to you.`);
    }
  });
});
