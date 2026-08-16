import { describe, expect, it } from "vitest";

import { parseSuggestedWaypointExplorerDetailBrowserResult } from "../suggestedWaypointExplorerDetailBrowserContract";

const SUGGESTION_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "99999999-9999-4999-8999-999999999999";

const detail = Object.freeze({
  suggested_waypoint_id: SUGGESTION_ID,
  current_version_id: VERSION_ID,
  destination: "Protect one evening each week for recovery",
  why: "A protected evening may make the week feel more sustainable.",
  arrival_signals: Object.freeze(["One evening stays unscheduled."]),
  received_at: "2026-08-16T06:00:00.000Z",
  read: false,
  read_at: null,
  receipt_acknowledged: false,
  acknowledged_at: null,
  channel_category: "open",
});

const success = (data: unknown = detail) => ({ ok: true, data, error: null });

describe("Explorer Suggested Waypoint detail browser contract", () => {
  it("accepts and deeply freezes exact immutable delivered content", () => {
    const parsed = parseSuggestedWaypointExplorerDetailBrowserResult(success());
    expect(parsed?.ok).toBe(true);
    if (parsed?.ok) {
      expect(parsed.data).toEqual(detail);
      expect(Object.isFrozen(parsed.data)).toBe(true);
      expect(Object.isFrozen(parsed.data.arrival_signals)).toBe(true);
    }
  });

  it("accepts private read and explicit acknowledgement independently", () => {
    expect(parseSuggestedWaypointExplorerDetailBrowserResult(success({
      ...detail,
      read: true,
      read_at: "2026-08-16T06:01:00.000Z",
    }))).not.toBeNull();
    expect(parseSuggestedWaypointExplorerDetailBrowserResult(success({
      ...detail,
      receipt_acknowledged: true,
      acknowledged_at: "2026-08-16T06:02:00.000Z",
    }))).not.toBeNull();
  });

  it.each([
    [{ ...detail, authoring_mode: "delivered" }],
    [{ ...detail, pull_back_available: false }],
    [{ ...detail, guide_assistant_name: "Kairos" }],
    [{ ...detail, guide_explorer_relationship_id: "55555555-5555-4555-8555-555555555555" }],
    [{ ...detail, private_waypoint_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
  ])("rejects widened Guide, Assistant, relationship, or private-Waypoint data", (data) => {
    expect(parseSuggestedWaypointExplorerDetailBrowserResult(success(data))).toBeNull();
  });

  it("rejects incoherent or pre-receipt engagement timestamps", () => {
    for (const data of [
      { ...detail, read: true, read_at: null },
      { ...detail, read: false, read_at: "2026-08-16T06:01:00.000Z" },
      { ...detail, receipt_acknowledged: true, acknowledged_at: null },
      { ...detail, receipt_acknowledged: true, acknowledged_at: "2026-08-16T05:59:00.000Z" },
    ]) {
      expect(parseSuggestedWaypointExplorerDetailBrowserResult(success(data))).toBeNull();
    }
  });

  it("rejects malformed content, duplicate signals, and non-open state", () => {
    for (const data of [
      { ...detail, destination: "" },
      { ...detail, why: " bad\rtext " },
      { ...detail, arrival_signals: ["Same", "Same"] },
      { ...detail, channel_category: "pending" },
    ]) {
      expect(parseSuggestedWaypointExplorerDetailBrowserResult(success(data))).toBeNull();
    }
  });

  it("accepts only fixed value-free errors", () => {
    expect(parseSuggestedWaypointExplorerDetailBrowserResult({
      ok: false,
      data: null,
      error: "SolMind Waypoint Suggestions are unavailable.",
    })).not.toBeNull();
    expect(parseSuggestedWaypointExplorerDetailBrowserResult({
      ok: false,
      data: null,
      error: "private database detail",
    })).toBeNull();
  });
});
