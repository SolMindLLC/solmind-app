import { describe, expect, it } from "vitest";

import {
  availableSuggestedWaypointExplorerListPageSizes,
  parseSuggestedWaypointExplorerListBrowserResult,
} from "../suggestedWaypointExplorerListBrowserContract";

const SUGGESTION_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "99999999-9999-4999-8999-999999999999";

const item = Object.freeze({
  suggested_waypoint_id: SUGGESTION_ID,
  current_version_id: VERSION_ID,
  destination_preview: "Protect one evening each week for recovery",
  received_at: "2026-08-16T06:00:00.000Z",
  read: false,
  receipt_acknowledged: false,
  acknowledged_at: null,
  channel_category: "open",
});

const success = (items: readonly unknown[] = [item]) => ({
  ok: true,
  data: { items, next_cursor: null, total_count: items.length },
  error: null,
});

describe("Explorer Suggested Waypoint list browser contract", () => {
  it("accepts and deeply freezes the exact delivered Explorer projection", () => {
    const parsed = parseSuggestedWaypointExplorerListBrowserResult(success());
    expect(parsed?.ok).toBe(true);
    expect(Object.isFrozen(parsed)).toBe(true);
    if (parsed?.ok) {
      expect(Object.isFrozen(parsed.data)).toBe(true);
      expect(Object.isFrozen(parsed.data.items)).toBe(true);
      expect(Object.isFrozen(parsed.data.items[0])).toBe(true);
      expect(parsed.data.items[0]).toEqual(item);
    }
  });

  it("accepts independent private read and explicit receipt acknowledgement states", () => {
    expect(parseSuggestedWaypointExplorerListBrowserResult(success([{ ...item, read: true }]))).not.toBeNull();
    expect(parseSuggestedWaypointExplorerListBrowserResult(success([{
      ...item,
      read: true,
      receipt_acknowledged: true,
      acknowledged_at: "2026-08-16T06:05:00.000Z",
    }]))).not.toBeNull();
  });

  it("rejects widened Guide-only, Assistant, and relationship data", () => {
    for (const widened of [
      { ...item, authoring_mode: "delivered" },
      { ...item, pull_back_available: false },
      { ...item, guide_assistant_name: "Kairos" },
      { ...item, guide_explorer_relationship_id: "55555555-5555-4555-8555-555555555555" },
    ]) {
      expect(parseSuggestedWaypointExplorerListBrowserResult(success([widened]))).toBeNull();
    }
  });

  it("rejects incoherent acknowledgement state", () => {
    expect(parseSuggestedWaypointExplorerListBrowserResult(success([{
      ...item,
      receipt_acknowledged: true,
      acknowledged_at: null,
    }]))).toBeNull();
    expect(parseSuggestedWaypointExplorerListBrowserResult(success([{
      ...item,
      receipt_acknowledged: false,
      acknowledged_at: "2026-08-16T06:05:00.000Z",
    }]))).toBeNull();
  });

  it("rejects draft, pending, malformed text, and non-open channel state", () => {
    expect(parseSuggestedWaypointExplorerListBrowserResult(success([{ ...item, channel_category: "pending" }]))).toBeNull();
    expect(parseSuggestedWaypointExplorerListBrowserResult(success([{ ...item, destination_preview: " Draft\ntext " }]))).toBeNull();
  });

  it("rejects duplicate suggestion or immutable current-version identifiers", () => {
    const otherSuggestion = { ...item, suggested_waypoint_id: "77777777-7777-4777-8777-777777777777" };
    expect(parseSuggestedWaypointExplorerListBrowserResult(success([item, item]))).toBeNull();
    expect(parseSuggestedWaypointExplorerListBrowserResult(success([item, otherSuggestion]))).toBeNull();
  });

  it("accepts only fixed value-free error results", () => {
    expect(parseSuggestedWaypointExplorerListBrowserResult({
      ok: false,
      data: null,
      error: "SolMind Waypoint Suggestions are unavailable.",
    })).not.toBeNull();
    expect(parseSuggestedWaypointExplorerListBrowserResult({
      ok: false,
      data: null,
      error: "private provider detail",
    })).toBeNull();
  });

  it("implements progressive page-size choices without showing pagination at five or below", () => {
    expect(availableSuggestedWaypointExplorerListPageSizes(5)).toEqual([]);
    expect(availableSuggestedWaypointExplorerListPageSizes(6)).toEqual([5, 10]);
    expect(availableSuggestedWaypointExplorerListPageSizes(21)).toEqual([5, 10, 20]);
    expect(availableSuggestedWaypointExplorerListPageSizes(101)).toEqual([5, 10, 20, 50, 100]);
  });
});
