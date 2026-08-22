import { describe, expect, it } from "vitest";

import {
  SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES,
  snapshotSuggestedWaypointGuideDraftContent,
} from "../suggestedWaypointGuideDraftContentBrowserContract";

const valid = () => ({
  destination: "Protect one evening each week for recovery",
  why: "A protected evening may make the week feel more sustainable.\nReview after two weeks.",
  arrivalSignals: ["One evening stays unscheduled."],
});

describe("Guide draft content browser contract", () => {
  it("returns one deeply frozen exact snapshot and preserves ordinary multiline why", () => {
    const input = valid();
    const result = snapshotSuggestedWaypointGuideDraftContent(input);
    expect(result).toEqual({ ok: true, data: input, issues: [] });
    expect(result.ok && Object.isFrozen(result.data)).toBe(true);
    expect(result.ok && Object.isFrozen(result.data.arrivalSignals)).toBe(true);
    input.arrivalSignals[0] = "Changed later";
    expect(result.ok && result.data.arrivalSignals[0]).toBe("One evening stays unscheduled.");
  });

  it.each([
    ["destination", { destination: "x".repeat(161) }],
    ["destination", { destination: "line one\nline two" }],
    ["destination", { destination: "not normalized e\u0301" }],
    ["destination", { destination: "bad\u2028separator" }],
    ["destination", { destination: "bad\ud800surrogate" }],
    ["why", { why: "" }],
    ["why", { why: "x".repeat(1001) }],
    ["why", { why: "bad\u2029separator" }],
    ["arrivalSignals", { arrivalSignals: [] }],
    ["arrivalSignals", { arrivalSignals: Array.from({ length: 9 }, (_, index) => `Signal ${index}`) }],
    ["arrivalSignals", { arrivalSignals: ["Duplicate", "Duplicate"] }],
    ["arrivalSignals", { arrivalSignals: ["x".repeat(241)] }],
  ])("rejects invalid %s content", (field, override) => {
    const result = snapshotSuggestedWaypointGuideDraftContent({ ...valid(), ...override });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES[
        field as "destination" | "why" | "arrivalSignals"
      ],
    );
  });

  it("accepts the exact scalar and count boundaries", () => {
    const result = snapshotSuggestedWaypointGuideDraftContent({
      destination: "😀".repeat(160),
      why: "😀".repeat(1000),
      arrivalSignals: Array.from({ length: 8 }, (_, index) => `${index}${"😀".repeat(239)}`),
    });
    expect(result.ok).toBe(true);
  });

  it.each([
    null,
    [],
    { destination: "A", why: "B", arrivalSignals: ["C"], widened: true },
    Object.assign(Object.create({ inherited: true }), valid()),
  ])("rejects widened or non-plain shape", (value) => {
    const result = snapshotSuggestedWaypointGuideDraftContent(value);
    expect(result).toEqual({
      ok: false,
      data: null,
      issues: [SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES.invalidShape],
    });
  });

  it("rejects accessors and symbols without invoking hostile code", () => {
    let getterCalls = 0;
    const accessor = valid() as Record<PropertyKey, unknown>;
    Object.defineProperty(accessor, "destination", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "Do not read";
      },
    });
    expect(snapshotSuggestedWaypointGuideDraftContent(accessor).ok).toBe(false);
    expect(getterCalls).toBe(0);

    const symbolValue = valid() as Record<PropertyKey, unknown>;
    symbolValue[Symbol("hostile")] = "value";
    expect(snapshotSuggestedWaypointGuideDraftContent(symbolValue).ok).toBe(false);
  });

  it("rejects sparse and accessor signal arrays without invoking getters", () => {
    const sparse = valid();
    sparse.arrivalSignals = new Array(1);
    expect(snapshotSuggestedWaypointGuideDraftContent(sparse).ok).toBe(false);

    let getterCalls = 0;
    const accessorSignals: string[] = [];
    Object.defineProperty(accessorSignals, "0", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "Do not read";
      },
    });
    Object.defineProperty(accessorSignals, "length", { value: 1 });
    expect(
      snapshotSuggestedWaypointGuideDraftContent({
        ...valid(),
        arrivalSignals: accessorSignals,
      }).ok,
    ).toBe(false);
    expect(getterCalls).toBe(0);
  });
});
