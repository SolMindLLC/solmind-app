import { describe, expect, it } from "vitest";

import {
  classifySuggestedWaypointGuideDraftCreateResult,
  SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS,
  SuggestedWaypointGuideDraftCreateFailure,
} from "./suggestedWaypointWholePathGuideDraftDiagnostics";

const SUGGESTION_ID = "55555555-5555-4555-8555-555555555555";

function response(value: unknown) {
  return { kind: "response" as const, value };
}

describe("Suggested Waypoint Guide draft-create diagnostics", () => {
  it("accepts only the exact successful browser result", () => {
    expect(
      classifySuggestedWaypointGuideDraftCreateResult(
        response({
          ok: true,
          outcome: "applied",
          suggestedWaypointId: SUGGESTION_ID,
          error: null,
        }),
      ),
    ).toEqual({ status: "created", suggestedWaypointId: SUGGESTION_ID });
  });

  it.each([
    ["request_failed", { kind: "request_failed" }],
    ["http_failed", { kind: "http_failed" }],
    ["response_parse_failed", { kind: "response_parse_failed" }],
  ] as const)("preserves the closed %s request boundary", (reason, input) => {
    expect(classifySuggestedWaypointGuideDraftCreateResult(input)).toEqual({
      status: "failed",
      reason,
    });
  });

  it.each(["command_denied", "command_failed"] as const)(
    "classifies the fixed %s browser failure without retaining values",
    (error) => {
      expect(
        classifySuggestedWaypointGuideDraftCreateResult(
          response({
            ok: false,
            outcome: null,
            suggestedWaypointId: null,
            error,
          }),
        ),
      ).toEqual({ status: "failed", reason: error });
    },
  );

  it.each([
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "stale",
  ] as const)("classifies the fixed %s outcome", (outcome) => {
    expect(
      classifySuggestedWaypointGuideDraftCreateResult(
        response({
          ok: false,
          outcome,
          suggestedWaypointId: null,
          error: null,
        }),
      ),
    ).toEqual({ status: "failed", reason: `outcome_${outcome}` });
  });

  it("collapses malformed and hostile responses to one value-free contract category", () => {
    const hostile = Object.defineProperty({}, "ok", {
      enumerable: true,
      get() {
        throw new Error("protected response detail");
      },
    });
    for (const value of [null, {}, hostile, {
      ok: true,
      outcome: "applied",
      suggestedWaypointId: "protected-id",
      error: null,
    }]) {
      expect(
        classifySuggestedWaypointGuideDraftCreateResult(response(value)),
      ).toEqual({ status: "failed", reason: "response_contract_failed" });
    }
  });

  it("normalizes a hostile constructor reason to the fixed contract category", () => {
    const failure = new SuggestedWaypointGuideDraftCreateFailure(
      "protected-arbitrary-reason",
    );
    expect(failure.message).toBe("whole_path_guide_draft_create_failed");
    expect(failure.reason).toBe("response_contract_failed");
    expect(SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS).toHaveLength(10);
  });
});
