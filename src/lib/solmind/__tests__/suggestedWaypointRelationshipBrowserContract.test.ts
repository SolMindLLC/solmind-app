import { describe, expect, it } from "vitest";

import {
  SUGGESTED_WAYPOINT_RELATIONSHIP_DENIED,
  availableSuggestedWaypointRelationshipPageSizes,
  isSuggestedWaypointRelationshipId,
  parseSuggestedWaypointRelationshipBrowserResult,
} from "../suggestedWaypointRelationshipBrowserContract";

const ITEM = Object.freeze({
  guide_explorer_relationship_id: "55555555-5555-4555-8555-555555555555",
  explorer_display_name: "Avery",
  relationship_created_at: "2026-08-14T17:00:00.000Z",
});

describe("Suggested Waypoint relationship browser contract", () => {
  it("accepts and deeply freezes the exact privacy-minimal success shape", () => {
    const result = parseSuggestedWaypointRelationshipBrowserResult({
      ok: true,
      data: { items: [ITEM], next_cursor: null, total_count: 1 },
      error: null,
    });

    expect(result).toEqual({
      ok: true,
      data: { items: [ITEM], next_cursor: null, total_count: 1 },
      error: null,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result?.ok && Object.isFrozen(result.data)).toBe(true);
    expect(result?.ok && Object.isFrozen(result.data.items)).toBe(true);
    expect(result?.ok && Object.isFrozen(result.data.items[0])).toBe(true);
  });

  it.each([
    { ok: true, data: { items: [{ ...ITEM, private_note: "secret" }], next_cursor: null, total_count: 1 }, error: null },
    { ok: true, data: { items: [ITEM, ITEM], next_cursor: null, total_count: 2 }, error: null },
    { ok: true, data: { items: [ITEM], next_cursor: "bad", total_count: 2 }, error: null },
    { ok: true, data: { items: [ITEM], next_cursor: null, total_count: 0 }, error: null },
    { ok: false, data: null, error: "database detail" },
    { ok: false, data: { items: [] }, error: SUGGESTED_WAYPOINT_RELATIONSHIP_DENIED },
  ])("rejects widened or malformed responses without partial acceptance", (value) => {
    expect(parseSuggestedWaypointRelationshipBrowserResult(value)).toBeNull();
  });

  it("accepts only the two value-free error results", () => {
    expect(
      parseSuggestedWaypointRelationshipBrowserResult({
        ok: false,
        data: null,
        error: SUGGESTED_WAYPOINT_RELATIONSHIP_DENIED,
      }),
    ).toEqual({
      ok: false,
      data: null,
      error: SUGGESTED_WAYPOINT_RELATIONSHIP_DENIED,
    });
    expect(
      parseSuggestedWaypointRelationshipBrowserResult({
        ok: false,
        data: null,
        error: "refresh_required",
      }),
    ).toEqual({ ok: false, data: null, error: "refresh_required" });
    expect(
      parseSuggestedWaypointRelationshipBrowserResult({
        ok: false,
        data: null,
        error: "refresh_required",
        reason: "database detail",
      }),
    ).toBeNull();
  });

  it("uses the approved progressive page-size choices", () => {
    expect(availableSuggestedWaypointRelationshipPageSizes(5)).toEqual([]);
    expect(availableSuggestedWaypointRelationshipPageSizes(6)).toEqual([5, 10]);
    expect(availableSuggestedWaypointRelationshipPageSizes(21)).toEqual([5, 10, 20]);
    expect(availableSuggestedWaypointRelationshipPageSizes(51)).toEqual([5, 10, 20, 50]);
    expect(availableSuggestedWaypointRelationshipPageSizes(101)).toEqual([5, 10, 20, 50, 100]);
  });

  it("recognizes only canonical relationship identifiers", () => {
    expect(isSuggestedWaypointRelationshipId(ITEM.guide_explorer_relationship_id)).toBe(true);
    expect(isSuggestedWaypointRelationshipId("avery")).toBe(false);
  });
});
