import { describe, expect, it } from "vitest";

import {
  availableSuggestedWaypointGuideListPageSizes,
  isSuggestedWaypointId,
  parseSuggestedWaypointGuideListBrowserResult,
} from "../suggestedWaypointGuideListBrowserContract";

const ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";

const draft = () => ({
  suggested_waypoint_id: ID,
  authoring_mode: "draft",
  authoring_revision: 1,
  destination_preview: "Protect one evening each week for recovery",
  pending_deadline_at: null,
  pull_back_available: false,
  channel_category: "not_delivered",
  current_version_id: null,
  delivered_at: null,
  acknowledged_version_id: null,
  acknowledged_at: null,
});

const success = (items: readonly unknown[]) => ({
  ok: true,
  data: { items, next_cursor: null, total_count: items.length },
  error: null,
});

describe("Suggested Waypoint Guide list browser contract", () => {
  it("accepts only canonical UUID suggestion identifiers", () => {
    expect(isSuggestedWaypointId(ID)).toBe(true);
    expect(isSuggestedWaypointId("not-a-uuid")).toBe(false);
  });

  it("accepts and deeply freezes an exact coherent Guide list", () => {
    const parsed = parseSuggestedWaypointGuideListBrowserResult(success([draft()]));

    expect(parsed).not.toBeNull();
    expect(parsed?.ok).toBe(true);
    expect(Object.isFrozen(parsed)).toBe(true);
    if (parsed?.ok) {
      expect(Object.isFrozen(parsed.data)).toBe(true);
      expect(Object.isFrozen(parsed.data.items)).toBe(true);
      expect(Object.isFrozen(parsed.data.items[0])).toBe(true);
    }
  });

  it("accepts pending and delivered lifecycle projections", () => {
    const pending = {
      ...draft(),
      authoring_mode: "pending",
      authoring_revision: 2,
      pending_deadline_at: "2026-08-16T06:00:00.000Z",
      pull_back_available: true,
      channel_category: "pending",
    };
    const delivered = {
      ...draft(),
      suggested_waypoint_id: "33333333-3333-4333-8333-333333333333",
      authoring_mode: "delivered",
      authoring_revision: 3,
      channel_category: "open",
      current_version_id: VERSION_ID,
      delivered_at: "2026-08-16T06:00:00.000Z",
      acknowledged_version_id: VERSION_ID,
      acknowledged_at: "2026-08-16T06:05:00.000Z",
    };

    expect(parseSuggestedWaypointGuideListBrowserResult(success([pending, delivered]))?.ok).toBe(true);
  });

  it.each([
    { ...draft(), private_explorer_note: "must not enter the Guide UI" },
    { ...draft(), channel_category: "open" },
    { ...draft(), current_version_id: VERSION_ID },
    { ...draft(), destination_preview: "  padded  " },
    { ...draft(), suggested_waypoint_id: "not-a-uuid" },
  ])("rejects widened or incoherent item %#", (candidate) => {
    expect(parseSuggestedWaypointGuideListBrowserResult(success([candidate]))).toBeNull();
  });

  it("rejects duplicate IDs and invalid pagination", () => {
    expect(parseSuggestedWaypointGuideListBrowserResult(success([draft(), draft()]))).toBeNull();
    expect(
      parseSuggestedWaypointGuideListBrowserResult({
        ok: true,
        data: { items: [draft()], next_cursor: "bmV4dA==", total_count: 1 },
        error: null,
      }),
    ).toBeNull();
  });

  it("exposes only useful progressive page sizes", () => {
    expect(availableSuggestedWaypointGuideListPageSizes(5)).toEqual([]);
    expect(availableSuggestedWaypointGuideListPageSizes(6)).toEqual([5, 10]);
    expect(availableSuggestedWaypointGuideListPageSizes(21)).toEqual([5, 10, 20]);
    expect(availableSuggestedWaypointGuideListPageSizes(101)).toEqual([
      5, 10, 20, 50, 100,
    ]);
  });
});
