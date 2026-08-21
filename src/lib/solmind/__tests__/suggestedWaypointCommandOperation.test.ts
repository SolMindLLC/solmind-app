import { describe, expect, it, vi } from "vitest";

import {
  beginSuggestedWaypointCommandOperation,
  createIdleSuggestedWaypointCommandOperation,
  invalidateSuggestedWaypointCommandOperation,
  markSuggestedWaypointCommandTransportUncertain,
  replaceSuggestedWaypointCommandOperation,
  resolveSuggestedWaypointCommandOperation,
  retrySuggestedWaypointCommandOperation,
  settleSuggestedWaypointCommandByAuthoritativeRead,
} from "../suggestedWaypointCommandOperation";

const FIRST_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const FIRST_SNAPSHOT = '{"action":"save","destination":"one"}';
const SECOND_SNAPSHOT = '{"action":"save","destination":"two"}';

describe("suggestedWaypointCommandOperation", () => {
  it("creates one immutable operation and suppresses double activation", () => {
    const idFactory = vi.fn(() => FIRST_ID);
    const idle = createIdleSuggestedWaypointCommandOperation();
    const started = beginSuggestedWaypointCommandOperation(
      idle,
      FIRST_SNAPSHOT,
      idFactory,
    );
    const doubleActivated = beginSuggestedWaypointCommandOperation(
      started,
      FIRST_SNAPSHOT,
      idFactory,
    );

    expect(started).toMatchObject({
      phase: "in_flight",
      generation: 1,
      operationId: FIRST_ID,
      snapshot: FIRST_SNAPSHOT,
      busy: true,
      acceptsResult: true,
      announcementKind: "submitting",
    });
    expect(doubleActivated).toBe(started);
    expect(idFactory).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(started)).toBe(true);
  });

  it("retains the exact snapshot and operation identity across uncertain retry", () => {
    const idFactory = vi.fn(() => FIRST_ID);
    const started = beginSuggestedWaypointCommandOperation(
      createIdleSuggestedWaypointCommandOperation(),
      FIRST_SNAPSHOT,
      idFactory,
    );
    const uncertain = markSuggestedWaypointCommandTransportUncertain(started, 1);
    const retried = retrySuggestedWaypointCommandOperation(uncertain);

    expect(uncertain).toMatchObject({
      phase: "transport_uncertain",
      operationId: FIRST_ID,
      snapshot: FIRST_SNAPSHOT,
      retryAvailable: true,
      focusIntent: "initiator",
    });
    expect(retried).toMatchObject({
      phase: "in_flight",
      generation: 1,
      operationId: FIRST_ID,
      snapshot: FIRST_SNAPSHOT,
    });
    expect(idFactory).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(uncertain)).toBe(true);
    expect(Object.isFrozen(retried)).toBe(true);
  });

  it("requires deliberate replacement and a new identity when bytes change", () => {
    const idFactory = vi
      .fn<() => string>()
      .mockReturnValueOnce(FIRST_ID)
      .mockReturnValueOnce(SECOND_ID);
    const started = beginSuggestedWaypointCommandOperation(
      createIdleSuggestedWaypointCommandOperation(),
      FIRST_SNAPSHOT,
      idFactory,
    );
    const uncertain = markSuggestedWaypointCommandTransportUncertain(started, 1);
    const unchanged = replaceSuggestedWaypointCommandOperation(
      uncertain,
      FIRST_SNAPSHOT,
      idFactory,
    );
    const replaced = replaceSuggestedWaypointCommandOperation(
      uncertain,
      SECOND_SNAPSHOT,
      idFactory,
    );

    expect(unchanged).toBe(uncertain);
    expect(replaced).toMatchObject({
      phase: "in_flight",
      generation: 2,
      operationId: SECOND_ID,
      snapshot: SECOND_SNAPSHOT,
    });
    expect(idFactory).toHaveBeenCalledTimes(2);
    expect(Object.isFrozen(replaced)).toBe(true);
  });

  it("supports deliberate first and later commands through idle and conclusive replacement", () => {
    const idFactory = vi
      .fn<() => string>()
      .mockReturnValueOnce(FIRST_ID)
      .mockReturnValueOnce(SECOND_ID);
    const first = replaceSuggestedWaypointCommandOperation(
      createIdleSuggestedWaypointCommandOperation(),
      FIRST_SNAPSHOT,
      idFactory,
    );
    const firstResolved = resolveSuggestedWaypointCommandOperation(
      first,
      1,
      "success",
    );
    const second = replaceSuggestedWaypointCommandOperation(
      firstResolved,
      SECOND_SNAPSHOT,
      idFactory,
    );

    expect(first).toMatchObject({
      phase: "in_flight",
      generation: 1,
      operationId: FIRST_ID,
    });
    expect(second).toMatchObject({
      phase: "in_flight",
      generation: 2,
      operationId: SECOND_ID,
      snapshot: SECOND_SNAPSHOT,
    });
    expect(idFactory).toHaveBeenCalledTimes(2);
  });

  it("keeps illegal and stale transitions as identity-preserving no-ops", () => {
    const idle = createIdleSuggestedWaypointCommandOperation();
    const started = beginSuggestedWaypointCommandOperation(
      idle,
      FIRST_SNAPSHOT,
      () => FIRST_ID,
    );
    const resolved = resolveSuggestedWaypointCommandOperation(
      started,
      1,
      "success",
    );

    expect(retrySuggestedWaypointCommandOperation(idle)).toBe(idle);
    expect(retrySuggestedWaypointCommandOperation(started)).toBe(started);
    expect(
      markSuggestedWaypointCommandTransportUncertain(started, 0),
    ).toBe(started);
    expect(
      resolveSuggestedWaypointCommandOperation(resolved, 1, "success"),
    ).toBe(resolved);
  });

  it("invalidates an uncertain operation and rejects every later completion", () => {
    const started = beginSuggestedWaypointCommandOperation(
      createIdleSuggestedWaypointCommandOperation(),
      FIRST_SNAPSHOT,
      () => FIRST_ID,
    );
    const uncertain = markSuggestedWaypointCommandTransportUncertain(started, 1);
    const invalidated = invalidateSuggestedWaypointCommandOperation(uncertain);

    expect(invalidated).toMatchObject({
      phase: "invalidated",
      generation: 1,
      operationId: null,
      snapshot: null,
      acceptsResult: false,
    });
    expect(
      resolveSuggestedWaypointCommandOperation(invalidated, 1, "success"),
    ).toBe(invalidated);
  });

  it("ignores stale generations and accepts a late current result while uncertain", () => {
    const started = beginSuggestedWaypointCommandOperation(
      createIdleSuggestedWaypointCommandOperation(),
      FIRST_SNAPSHOT,
      () => FIRST_ID,
    );
    const uncertain = markSuggestedWaypointCommandTransportUncertain(started, 1);

    expect(
      resolveSuggestedWaypointCommandOperation(uncertain, 0, "success"),
    ).toBe(uncertain);
    const resolved = resolveSuggestedWaypointCommandOperation(
      uncertain,
      1,
      "success",
    );
    expect(resolved).toEqual({
      phase: "conclusive",
      generation: 1,
      operationId: null,
      snapshot: null,
      busy: false,
      retryAvailable: false,
      acceptsResult: false,
      announcementKind: "success",
      focusIntent: "updated_status",
    });
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it("settles uncertainty only after the current authoritative read proves the state", () => {
    const started = beginSuggestedWaypointCommandOperation(
      createIdleSuggestedWaypointCommandOperation(),
      FIRST_SNAPSHOT,
      () => FIRST_ID,
    );
    const uncertain = markSuggestedWaypointCommandTransportUncertain(started, 1);

    expect(
      settleSuggestedWaypointCommandByAuthoritativeRead(uncertain, 0, true),
    ).toBe(uncertain);
    expect(
      settleSuggestedWaypointCommandByAuthoritativeRead(uncertain, 1, false),
    ).toBe(uncertain);
    expect(
      settleSuggestedWaypointCommandByAuthoritativeRead(uncertain, 1, true),
    ).toMatchObject({
      phase: "conclusive",
      announcementKind: "success",
      focusIntent: "updated_status",
    });
  });

  it("returns focus to the initiator for expected non-success", () => {
    const started = beginSuggestedWaypointCommandOperation(
      createIdleSuggestedWaypointCommandOperation(),
      FIRST_SNAPSHOT,
      () => FIRST_ID,
    );
    expect(
      resolveSuggestedWaypointCommandOperation(
        started,
        1,
        "expected_non_success",
      ),
    ).toMatchObject({
      phase: "conclusive",
      announcementKind: "expected_non_success",
      focusIntent: "initiator",
    });
  });

  it("invalidates late completion and permanently drops retained bytes for that state", () => {
    const started = beginSuggestedWaypointCommandOperation(
      createIdleSuggestedWaypointCommandOperation(),
      FIRST_SNAPSHOT,
      () => FIRST_ID,
    );
    const invalidated = invalidateSuggestedWaypointCommandOperation(started);

    expect(invalidated).toEqual({
      phase: "invalidated",
      generation: 1,
      operationId: null,
      snapshot: null,
      busy: false,
      retryAvailable: false,
      acceptsResult: false,
      announcementKind: "none",
      focusIntent: "none",
    });
    expect(Object.isFrozen(invalidated)).toBe(true);
    expect(
      resolveSuggestedWaypointCommandOperation(invalidated, 1, "success"),
    ).toBe(invalidated);
    expect(
      replaceSuggestedWaypointCommandOperation(
        invalidated,
        SECOND_SNAPSHOT,
        () => SECOND_ID,
      ),
    ).toBe(invalidated);
  });

  it("fails closed when snapshot or generated identity is invalid", () => {
    const idle = createIdleSuggestedWaypointCommandOperation();
    const disguisedIdentity = {
      toString: vi.fn(() => FIRST_ID),
    };
    const objectFactory = (() =>
      disguisedIdentity) as unknown as () => string;
    const throwingFactory = vi.fn(() => {
      throw new Error("unavailable");
    });

    expect(
      beginSuggestedWaypointCommandOperation(idle, "", () => FIRST_ID),
    ).toBe(idle);
    expect(
      beginSuggestedWaypointCommandOperation(idle, FIRST_SNAPSHOT, () => "bad"),
    ).toBe(idle);
    expect(
      beginSuggestedWaypointCommandOperation(
        idle,
        FIRST_SNAPSHOT,
        objectFactory,
      ),
    ).toBe(idle);
    expect(disguisedIdentity.toString).not.toHaveBeenCalled();
    expect(
      beginSuggestedWaypointCommandOperation(
        idle,
        FIRST_SNAPSHOT,
        throwingFactory,
      ),
    ).toBe(idle);
  });
});
