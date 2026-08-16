import { describe, expect, it } from "vitest";

import {
  parseSuggestedWaypointGuideDetailBrowserResult,
} from "../suggestedWaypointGuideDetailBrowserContract";

const SUGGESTION_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "77777777-7777-4777-8777-777777777777";

const draft = Object.freeze({
  suggested_waypoint_id: SUGGESTION_ID,
  authoring_mode: "draft",
  authoring_revision: 2,
  destination_preview: "Protect one evening each week for recovery",
  pending_deadline_at: null,
  pull_back_available: false,
  channel_category: "not_delivered",
  current_version_id: null,
  delivered_at: null,
  acknowledged_version_id: null,
  acknowledged_at: null,
  draft_or_pending_destination: "Protect one evening each week for recovery",
  draft_or_pending_why: "A protected evening may make the week feel more sustainable.",
  draft_or_pending_arrival_signals: Object.freeze(["One evening stays unscheduled."]),
  delivered_destination: null,
  delivered_why: null,
  delivered_arrival_signals: null,
  policy_key: null,
  policy_version: null,
  effective_seconds: null,
});

describe("Suggested Waypoint Guide detail browser contract", () => {
  it("accepts and deeply freezes an exact Guide-only draft", () => {
    const result = parseSuggestedWaypointGuideDetailBrowserResult({
      ok: true,
      data: draft,
      error: null,
    });

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.data.destination_preview).toContain("recovery");
      expect(Object.isFrozen(result.data)).toBe(true);
      expect(Object.isFrozen(result.data.draft_or_pending_arrival_signals)).toBe(true);
    }
  });

  it("accepts pending policy and a delivered acknowledgement projection", () => {
    const pending = {
      ...draft,
      authoring_mode: "pending",
      channel_category: "pending",
      pending_deadline_at: "2026-08-16T06:30:00.000Z",
      pull_back_available: true,
      policy_key: "suggested_waypoint_send_grace_seconds",
      policy_version: 3,
      effective_seconds: 300,
    };
    expect(
      parseSuggestedWaypointGuideDetailBrowserResult({
        ok: true,
        data: pending,
        error: null,
      })?.ok,
    ).toBe(true);

    const delivered = {
      ...draft,
      authoring_mode: "delivered",
      channel_category: "open",
      current_version_id: VERSION_ID,
      delivered_at: "2026-08-16T06:30:00.000Z",
      acknowledged_version_id: VERSION_ID,
      acknowledged_at: "2026-08-16T06:35:00.000Z",
      draft_or_pending_destination: null,
      draft_or_pending_why: null,
      draft_or_pending_arrival_signals: null,
      delivered_destination: draft.draft_or_pending_destination,
      delivered_why: draft.draft_or_pending_why,
      delivered_arrival_signals: draft.draft_or_pending_arrival_signals,
    };
    expect(
      parseSuggestedWaypointGuideDetailBrowserResult({
        ok: true,
        data: delivered,
        error: null,
      })?.ok,
    ).toBe(true);
  });

  it.each([
    [{ ...draft, explorer_read: true }],
    [{ ...draft, draft_or_pending_why: null }],
    [{ ...draft, draft_or_pending_arrival_signals: ["Same", "Same"] }],
    [{ ...draft, policy_key: "suggested_waypoint_send_grace_seconds", policy_version: 1, effective_seconds: 300 }],
    [{ ...draft, authoring_mode: "pending", channel_category: "pending", pending_deadline_at: "2026-08-16T06:30:00.000Z", pull_back_available: true }],
  ])("rejects widened or lifecycle-incoherent detail", (data) => {
    expect(
      parseSuggestedWaypointGuideDetailBrowserResult({ ok: true, data, error: null }),
    ).toBeNull();
  });

  it("accepts only fixed value-free errors", () => {
    expect(
      parseSuggestedWaypointGuideDetailBrowserResult({
        ok: false,
        data: null,
        error: "SolMind Suggested Waypoints are unavailable.",
      }),
    ).toEqual({
      ok: false,
      data: null,
      error: "SolMind Suggested Waypoints are unavailable.",
    });
    expect(
      parseSuggestedWaypointGuideDetailBrowserResult({
        ok: false,
        data: null,
        error: "private database detail",
      }),
    ).toBeNull();
  });
});
