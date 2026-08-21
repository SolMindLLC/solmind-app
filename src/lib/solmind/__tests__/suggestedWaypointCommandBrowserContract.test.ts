import { describe, expect, it } from "vitest";

import {
  SUGGESTED_WAYPOINT_COMMAND_DENIED,
  SUGGESTED_WAYPOINT_COMMAND_FAILED,
  parseSuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandExpectedOutcome,
} from "../suggestedWaypointCommandBrowserContract";

const SUGGESTION_ID = "11111111-1111-4111-8111-111111111111";
const GUIDE_OUTCOMES = Object.freeze([
  "stale",
  "too_late",
  "invalid_transition",
  "relationship_unavailable",
  "policy_unavailable",
  "operation_conflict",
] satisfies readonly SuggestedWaypointCommandExpectedOutcome[]);
const EXPLORER_OUTCOMES = Object.freeze([
  "stale",
  "invalid_transition",
  "relationship_unavailable",
  "operation_conflict",
] satisfies readonly SuggestedWaypointCommandExpectedOutcome[]);

describe("parseSuggestedWaypointCommandBrowserResult", () => {
  it.each(["applied", "idempotent"] as const)(
    "accepts and freezes %s success with one authorized suggestion identity",
    (outcome) => {
      const result = parseSuggestedWaypointCommandBrowserResult(
        {
          ok: true,
          outcome,
          suggestedWaypointId: SUGGESTION_ID,
          error: null,
        },
        GUIDE_OUTCOMES,
      );

      expect(result).toEqual({
        ok: true,
        outcome,
        suggestedWaypointId: SUGGESTION_ID,
        error: null,
      });
      expect(Object.isFrozen(result)).toBe(true);
    },
  );

  it.each(GUIDE_OUTCOMES)(
    "accepts the explicitly permitted %s expected outcome",
    (outcome) => {
      expect(
        parseSuggestedWaypointCommandBrowserResult(
          {
            ok: false,
            outcome,
            suggestedWaypointId: null,
            error: null,
          },
          GUIDE_OUTCOMES,
        ),
      ).toEqual({
        ok: false,
        outcome,
        suggestedWaypointId: null,
        error: null,
      });
    },
  );

  it.each([
    SUGGESTED_WAYPOINT_COMMAND_DENIED,
    SUGGESTED_WAYPOINT_COMMAND_FAILED,
  ] as const)("accepts value-free %s", (error) => {
    expect(
      parseSuggestedWaypointCommandBrowserResult(
        {
          ok: false,
          outcome: null,
          suggestedWaypointId: null,
          error,
        },
        EXPLORER_OUTCOMES,
      ),
    ).toEqual({
      ok: false,
      outcome: null,
      suggestedWaypointId: null,
      error,
    });
  });

  it("keeps route-specific expected outcomes closed", () => {
    const guideOnly = {
      ok: false,
      outcome: "too_late",
      suggestedWaypointId: null,
      error: null,
    };

    expect(
      parseSuggestedWaypointCommandBrowserResult(guideOnly, GUIDE_OUTCOMES),
    ).not.toBeNull();
    expect(
      parseSuggestedWaypointCommandBrowserResult(guideOnly, EXPLORER_OUTCOMES),
    ).toBeNull();
  });

  it.each([
    null,
    [],
    () => ({ ok: true }),
    "result",
    { ok: true, outcome: "applied", suggestedWaypointId: SUGGESTION_ID },
    { ok: true, outcome: "applied", suggestedWaypointId: null, error: null },
    {
      ok: true,
      outcome: "applied",
      suggestedWaypointId: "not-a-uuid",
      error: null,
    },
    {
      ok: false,
      outcome: "stale",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    },
    {
      ok: false,
      outcome: null,
      suggestedWaypointId: null,
      error: "raw_database_error",
    },
    {
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
      relationship_id: "secret",
    },
  ])("rejects malformed, widened, or incoherent result %#", (value) => {
    expect(
      parseSuggestedWaypointCommandBrowserResult(value, GUIDE_OUTCOMES),
    ).toBeNull();
  });

  it.each([
    "actor_id",
    "relationship_id",
    "database_function",
    "policy_seconds",
    "revision",
    "version_id",
    "deadline_at",
    "destination",
    "explorer_private_state",
  ])("rejects the forbidden extra field %s", (forbiddenKey) => {
    expect(
      parseSuggestedWaypointCommandBrowserResult(
        {
          ok: true,
          outcome: "applied",
          suggestedWaypointId: SUGGESTION_ID,
          error: null,
          [forbiddenKey]: "must-not-cross",
        },
        GUIDE_OUTCOMES,
      ),
    ).toBeNull();
  });

  it("returns an isolated frozen copy rather than retaining caller ownership", () => {
    const source = {
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    };
    const result = parseSuggestedWaypointCommandBrowserResult(
      source,
      GUIDE_OUTCOMES,
    );

    source.outcome = "changed";

    expect(result).not.toBe(source);
    expect(result).toEqual({
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects symbol keys, accessors, non-plain objects, and hostile proxies", () => {
    const symbolKeyed = {
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
      [Symbol("hidden")]: "secret",
    };
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessor, {
      ok: { enumerable: true, get: () => true },
      outcome: { enumerable: true, value: "applied" },
      suggestedWaypointId: { enumerable: true, value: SUGGESTION_ID },
      error: { enumerable: true, value: null },
    });
    const classInstance = new (class Result {
      ok = true;
      outcome = "applied";
      suggestedWaypointId = SUGGESTION_ID;
      error = null;
    })();
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("secret");
        },
      },
    );

    for (const value of [symbolKeyed, accessor, classInstance, hostile]) {
      expect(
        parseSuggestedWaypointCommandBrowserResult(value, GUIDE_OUTCOMES),
      ).toBeNull();
    }
  });

  it("snapshots each permitted data property once without invoking getters", () => {
    const descriptorReads = new Map<PropertyKey, number>();
    const target = {
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    };
    const readOnce = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        const nextCount = (descriptorReads.get(key) ?? 0) + 1;
        descriptorReads.set(key, nextCount);
        if (nextCount > 1) {
          throw new Error("descriptor read twice");
        }
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
    });

    expect(
      parseSuggestedWaypointCommandBrowserResult(readOnce, GUIDE_OUTCOMES),
    ).toEqual({
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    });
    expect([...descriptorReads.values()]).toEqual([1, 1, 1, 1]);
  });

  it("rejects malformed permitted-outcome subsets", () => {
    const success = {
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    };

    expect(
      parseSuggestedWaypointCommandBrowserResult(success, ["stale", "stale"]),
    ).toBeNull();
    expect(
      parseSuggestedWaypointCommandBrowserResult(
        success,
        ["unknown"] as unknown as readonly SuggestedWaypointCommandExpectedOutcome[],
      ),
    ).toBeNull();
  });
});
