import { describe, expect, it } from "vitest";

import { getSuggestedWaypointPullBackCountdown } from "../suggestedWaypointPullBackCountdown";

describe("getSuggestedWaypointPullBackCountdown", () => {
  it("rounds a positive partial second upward for a stable visible countdown", () => {
    expect(
      getSuggestedWaypointPullBackCountdown(
        "2026-08-21T17:05:00.000Z",
        Date.parse("2026-08-21T17:00:00.001Z"),
      ),
    ).toEqual({
      expiredEstimate: false,
      label: "Estimated Pull Back time remaining: 5:00.",
      remainingSeconds: 300,
    });
  });

  it("labels zero and past deadlines as an estimate rather than authority", () => {
    expect(
      getSuggestedWaypointPullBackCountdown(
        "2026-08-21T17:00:00.000Z",
        Date.parse("2026-08-21T17:00:00.000Z"),
      ),
    ).toEqual({
      expiredEstimate: true,
      label: "The browser estimate has reached zero. The server confirms exact availability.",
      remainingSeconds: 0,
    });
  });

  it("rejects an invalid deadline or clock value", () => {
    expect(getSuggestedWaypointPullBackCountdown("invalid", 0)).toBeNull();
    expect(
      getSuggestedWaypointPullBackCountdown(
        "2026-08-21T17:00:00.000Z",
        Number.NaN,
      ),
    ).toBeNull();
  });
});
