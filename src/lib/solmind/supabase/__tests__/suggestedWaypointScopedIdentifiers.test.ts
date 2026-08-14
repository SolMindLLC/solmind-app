import { describe, expect, it } from "vitest";

import {
  SUGGESTED_WAYPOINT_IDENTIFIER_NAMESPACE,
  createSuggestedWaypointScopedIdentifiers,
} from "../suggestedWaypointScopedIdentifiers";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const RELATIONSHIP_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const SUGGESTION_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_ID = "55555555-5555-4555-8555-555555555555";
const UUID_V5_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createSuggestedWaypointScopedIdentifiers", () => {
  it("uses an immutable UUID namespace", () => {
    expect(SUGGESTED_WAYPOINT_IDENTIFIER_NAMESPACE).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it("returns stable UUIDv5 suggestion identifiers across instances", () => {
    const first = createSuggestedWaypointScopedIdentifiers();
    const second = createSuggestedWaypointScopedIdentifiers();
    const args = {
      actorUserAccountId: ACTOR_ID,
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
    };

    const firstId = first.suggestedWaypointIdForCreate(args);
    expect(firstId).toMatch(UUID_V5_PATTERN);
    expect(firstId).toBe("ab504fae-79b8-5ed1-a2e8-00f8f751749f");
    expect(second.suggestedWaypointIdForCreate(args)).toBe(firstId);
    expect(
      first.suggestedWaypointIdForCreate({
        ...args,
        actorUserAccountId: ACTOR_ID.toUpperCase(),
      }),
    ).toBe(firstId);
  });

  it("separates every create authority scope", () => {
    const identifiers = createSuggestedWaypointScopedIdentifiers();
    const baseline = identifiers.suggestedWaypointIdForCreate({
      actorUserAccountId: ACTOR_ID,
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
    });

    expect(
      new Set([
        baseline,
        identifiers.suggestedWaypointIdForCreate({
          actorUserAccountId: OTHER_ID,
          relationshipId: RELATIONSHIP_ID,
          operationId: OPERATION_ID,
        }),
        identifiers.suggestedWaypointIdForCreate({
          actorUserAccountId: ACTOR_ID,
          relationshipId: OTHER_ID,
          operationId: OPERATION_ID,
        }),
        identifiers.suggestedWaypointIdForCreate({
          actorUserAccountId: ACTOR_ID,
          relationshipId: RELATIONSHIP_ID,
          operationId: OTHER_ID,
        }),
      ]).size,
    ).toBe(4);
  });

  it("returns stable version identifiers and binds the suggestion scope", () => {
    const identifiers = createSuggestedWaypointScopedIdentifiers();
    const args = {
      actorUserAccountId: ACTOR_ID,
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
      suggestedWaypointId: SUGGESTION_ID,
    };

    const first = identifiers.versionIdForSchedule(args);
    expect(first).toMatch(UUID_V5_PATTERN);
    expect(first).toBe("02dd2c38-b317-56bf-a310-2c622305f702");
    expect(identifiers.versionIdForSchedule(args)).toBe(first);
    expect(
      identifiers.versionIdForSchedule({
        ...args,
        suggestedWaypointId: OTHER_ID,
      }),
    ).not.toBe(first);
  });

  it("keeps create and schedule purposes in separate identifier domains", () => {
    const identifiers = createSuggestedWaypointScopedIdentifiers();
    const created = identifiers.suggestedWaypointIdForCreate({
      actorUserAccountId: ACTOR_ID,
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
    });
    const version = identifiers.versionIdForSchedule({
      actorUserAccountId: ACTOR_ID,
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
      suggestedWaypointId: SUGGESTION_ID,
    });

    expect(version).not.toBe(created);
  });

  it("fails closed on any malformed scoped identifier", () => {
    const identifiers = createSuggestedWaypointScopedIdentifiers();

    expect(() =>
      identifiers.suggestedWaypointIdForCreate({
        actorUserAccountId: "browser-actor",
        relationshipId: RELATIONSHIP_ID,
        operationId: OPERATION_ID,
      }),
    ).toThrow("SolMind Suggested Waypoint identifier scope is invalid.");
    expect(() =>
      identifiers.versionIdForSchedule({
        actorUserAccountId: ACTOR_ID,
        relationshipId: RELATIONSHIP_ID,
        operationId: OPERATION_ID,
        suggestedWaypointId: "not-a-uuid",
      }),
    ).toThrow("SolMind Suggested Waypoint identifier scope is invalid.");
  });

  it("returns a frozen capability object", () => {
    expect(Object.isFrozen(createSuggestedWaypointScopedIdentifiers())).toBe(
      true,
    );
  });
});
