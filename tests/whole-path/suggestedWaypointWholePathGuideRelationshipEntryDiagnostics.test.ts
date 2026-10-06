import { describe, expect, it } from "vitest";

import {
  classifySuggestedWaypointGuideRelationshipEntryResult,
  SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS,
  SuggestedWaypointGuideRelationshipEntryFailure,
} from "./suggestedWaypointWholePathGuideRelationshipEntryDiagnostics";

function response(value: unknown) {
  return { kind: "response" as const, value };
}

describe("Suggested Waypoint Guide relationship-entry diagnostics", () => {
  it("accepts only the exact fresh-fixture empty relationship list", () => {
    expect(
      classifySuggestedWaypointGuideRelationshipEntryResult(
        response({
          ok: true,
          data: { items: [], next_cursor: null, total_count: 0 },
          error: null,
        }),
      ),
    ).toEqual({ status: "ready" });
  });

  it.each([
    ["request_failed", { kind: "request_failed" }],
    ["http_failed", { kind: "http_failed" }],
    ["response_parse_failed", { kind: "response_parse_failed" }],
  ] as const)("preserves the closed %s request boundary", (reason, input) => {
    expect(classifySuggestedWaypointGuideRelationshipEntryResult(input)).toEqual({
      status: "failed",
      reason,
    });
  });

  it.each([
    ["SolMind Suggested Waypoints are unavailable.", "relationship_denied"],
    ["SolMind Suggested Waypoints could not be loaded.", "relationship_failed"],
    ["refresh_required", "refresh_required"],
  ] as const)("classifies the fixed browser error as %s", (error, reason) => {
    expect(
      classifySuggestedWaypointGuideRelationshipEntryResult(
        response({ ok: false, data: null, error }),
      ),
    ).toEqual({ status: "failed", reason });
  });

  it("rejects a nonempty list in the freshly reset fixture without retaining values", () => {
    expect(
      classifySuggestedWaypointGuideRelationshipEntryResult(
        response({
          ok: true,
          data: {
            items: [{ protected: "value" }],
            next_cursor: null,
            total_count: 1,
          },
          error: null,
        }),
      ),
    ).toEqual({ status: "failed", reason: "response_contract_failed" });

    expect(
      classifySuggestedWaypointGuideRelationshipEntryResult(
        response({
          ok: true,
          data: { items: [], next_cursor: null, total_count: 1 },
          error: null,
        }),
      ),
    ).toEqual({
      status: "failed",
      reason: "unexpected_existing_suggestions",
    });
  });

  it("collapses malformed and hostile responses to one value-free contract category", () => {
    const hostile = Object.defineProperty({}, "ok", {
      enumerable: true,
      get() {
        throw new Error("protected response detail");
      },
    });
    for (const value of [null, {}, hostile]) {
      expect(
        classifySuggestedWaypointGuideRelationshipEntryResult(response(value)),
      ).toEqual({ status: "failed", reason: "response_contract_failed" });
    }
  });

  it("normalizes a hostile constructor reason to the fixed contract category", () => {
    const failure = new SuggestedWaypointGuideRelationshipEntryFailure(
      "protected-arbitrary-reason",
    );
    expect(failure.message).toBe("whole_path_guide_relationship_entry_failed");
    expect(failure.reason).toBe("response_contract_failed");
    expect(
      SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS,
    ).toHaveLength(9);
  });
});
