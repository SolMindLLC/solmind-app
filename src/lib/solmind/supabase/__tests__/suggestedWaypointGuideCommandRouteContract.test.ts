import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryAuthSource,
  type InMemoryAuthSourceFixture,
} from "@/lib/solmind/auth/authSource";
import { createInMemoryRequestAuthPrincipalSource } from "@/lib/solmind/auth/requestAuthPrincipalSource";
import { type SupabaseAuthenticatedUser } from "@/lib/solmind/auth/serverAuthContext";
import {
  parseSuggestedWaypointGuideCommandRouteInput,
  projectSuggestedWaypointGuideCommandResult,
} from "../suggestedWaypointGuideCommandRouteContract";
import { resolveSuggestedWaypointRequest } from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";

const GUIDE_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const RELATIONSHIP_ID = "44444444-4444-4444-8444-444444444444";
const SUGGESTION_ID = "55555555-5555-4555-8555-555555555555";
const VERSION_ID = "66666666-6666-4666-8666-666666666666";
const GUIDE_PROFILE_ID = "77777777-7777-4777-8777-777777777777";
const EXPLORER_PROFILE_ID = "88888888-8888-4888-8888-888888888888";
const TIMESTAMP = "2026-08-20T20:00:00.000Z";

const CREATE_BODY = Object.freeze({
  kind: "guide.create_draft",
  operationId: OPERATION_ID,
  destination: "Protect one evening for recovery",
  why: "Create dependable recovery space.",
  arrivalSignals: Object.freeze(["One evening remains unscheduled."]),
});

function appliedSaveRow() {
  return Object.freeze({
    outcome_code: "applied" as const,
    operation_id: OPERATION_ID,
    suggested_waypoint_id: SUGGESTION_ID,
    authoring_revision: 1,
    current_version_id: null,
    committed_at: TIMESTAMP,
    draft_saved_at: TIMESTAMP,
  });
}

describe("parseSuggestedWaypointGuideCommandRouteInput", () => {
  it("injects the path relationship and binds each closed command", () => {
    const create = parseSuggestedWaypointGuideCommandRouteInput(
      CREATE_BODY,
      RELATIONSHIP_ID,
    );
    const save = parseSuggestedWaypointGuideCommandRouteInput(
      {
        kind: "guide.save_draft",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 2,
        destination: "Protect one evening for recovery",
        why: "Create dependable recovery space.",
        arrivalSignals: ["One evening remains unscheduled."],
      },
      RELATIONSHIP_ID,
    );
    const schedule = parseSuggestedWaypointGuideCommandRouteInput(
      {
        kind: "guide.schedule_send",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 2,
      },
      RELATIONSHIP_ID,
    );
    const pullBack = parseSuggestedWaypointGuideCommandRouteInput(
      {
        kind: "guide.pull_back",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 3,
        expectedPendingVersionId: VERSION_ID,
      },
      RELATIONSHIP_ID,
    );

    expect(create).toMatchObject({
      functionName: "solmind_save_suggested_waypoint_draft",
      request: { kind: "guide.create_draft", relationshipId: RELATIONSHIP_ID },
    });
    expect(save).toMatchObject({
      functionName: "solmind_save_suggested_waypoint_draft",
      request: { kind: "guide.save_draft", relationshipId: RELATIONSHIP_ID },
    });
    expect(schedule).toMatchObject({
      functionName: "solmind_schedule_suggested_waypoint_send",
      request: { kind: "guide.schedule_send", relationshipId: RELATIONSHIP_ID },
    });
    expect(pullBack).toMatchObject({
      functionName: "solmind_pull_back_suggested_waypoint",
      request: { kind: "guide.pull_back", relationshipId: RELATIONSHIP_ID },
    });
    expect(schedule?.permittedExpectedOutcomes).toContain("policy_unavailable");
    expect(pullBack?.permittedExpectedOutcomes).toContain("too_late");
    expect(Object.isFrozen(create?.request)).toBe(true);
    expect(
      Object.isFrozen(
        (create!.request as { arrivalSignals: readonly string[] }).arrivalSignals,
      ),
    ).toBe(true);
  });

  it.each([
    [{ ...CREATE_BODY, actorUserAccountId: GUIDE_ACCOUNT_ID }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, relationshipId: RELATIONSHIP_ID }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, destination: "" }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, destination: "d".repeat(161) }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, destination: "line one\nline two" }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, destination: "line one\u2028line two" }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, why: "" }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, why: "w".repeat(1001) }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, why: "isolated \ud800 surrogate" }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, arrivalSignals: [] }, RELATIONSHIP_ID],
    [
      {
        ...CREATE_BODY,
        arrivalSignals: [
          "one",
          "two",
          "three",
          "four",
          "five",
          "six",
          "seven",
          "eight",
          "nine",
        ],
      },
      RELATIONSHIP_ID,
    ],
    [{ ...CREATE_BODY, arrivalSignals: ["same", "same"] }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, arrivalSignals: ["signal\u2029break"] }, RELATIONSHIP_ID],
    [{ ...CREATE_BODY, operationId: "not-a-uuid" }, RELATIONSHIP_ID],
    [
      {
        kind: "guide.save_draft",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 0,
        destination: CREATE_BODY.destination,
        why: CREATE_BODY.why,
        arrivalSignals: CREATE_BODY.arrivalSignals,
      },
      RELATIONSHIP_ID,
    ],
    [
      {
        kind: "guide.save_draft",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: -1,
        destination: CREATE_BODY.destination,
        why: CREATE_BODY.why,
        arrivalSignals: CREATE_BODY.arrivalSignals,
      },
      RELATIONSHIP_ID,
    ],
    [
      {
        kind: "guide.save_draft",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 1.5,
        destination: CREATE_BODY.destination,
        why: CREATE_BODY.why,
        arrivalSignals: CREATE_BODY.arrivalSignals,
      },
      RELATIONSHIP_ID,
    ],
    [
      {
        kind: "guide.save_draft",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: Number.MAX_SAFE_INTEGER + 1,
        destination: CREATE_BODY.destination,
        why: CREATE_BODY.why,
        arrivalSignals: CREATE_BODY.arrivalSignals,
      },
      RELATIONSHIP_ID,
    ],
    [
      {
        kind: "guide.save_draft",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: "2",
        destination: CREATE_BODY.destination,
        why: CREATE_BODY.why,
        arrivalSignals: CREATE_BODY.arrivalSignals,
      },
      RELATIONSHIP_ID,
    ],
    [CREATE_BODY, "not-a-relationship"],
    [{ kind: "explorer.mark_read", operationId: OPERATION_ID }, RELATIONSHIP_ID],
  ])("rejects malformed or authority-bearing input %#", (body, relationshipId) => {
    expect(
      parseSuggestedWaypointGuideCommandRouteInput(body, relationshipId),
    ).toBeNull();
  });

  it("rejects accessors, symbols, inherited objects, and hostile proxies", () => {
    const accessor = { ...CREATE_BODY } as Record<string, unknown>;
    Object.defineProperty(accessor, "operationId", {
      enumerable: true,
      get: () => OPERATION_ID,
    });
    const symbol = { ...CREATE_BODY, [Symbol("hidden")]: "private" };
    const inherited = Object.create(CREATE_BODY);
    const hostile = new Proxy(CREATE_BODY, {
      ownKeys: () => {
        throw new Error("private trap detail");
      },
    });

    for (const value of [accessor, symbol, inherited, hostile]) {
      expect(
        parseSuggestedWaypointGuideCommandRouteInput(value, RELATIONSHIP_ID),
      ).toBeNull();
    }
  });

  it("snapshots each accepted body data property exactly once", () => {
    const descriptorReads = new Map<PropertyKey, number>();
    let ownKeyReads = 0;
    const readOnce = new Proxy(CREATE_BODY, {
      ownKeys: (target) => {
        ownKeyReads += 1;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor: (target, key) => {
        descriptorReads.set(key, (descriptorReads.get(key) ?? 0) + 1);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });

    expect(
      parseSuggestedWaypointGuideCommandRouteInput(readOnce, RELATIONSHIP_ID),
    ).not.toBeNull();
    expect(ownKeyReads).toBe(1);
    expect([...descriptorReads.values()]).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("projectSuggestedWaypointGuideCommandResult", () => {
  it("revalidates the function-bound row and returns only the canonical ID", () => {
    const routeInput = parseSuggestedWaypointGuideCommandRouteInput(
      CREATE_BODY,
      RELATIONSHIP_ID,
    );
    expect(routeInput).not.toBeNull();
    expect(
      projectSuggestedWaypointGuideCommandResult(routeInput!, {
        ok: true,
        data: appliedSaveRow(),
        error: null,
      }),
    ).toEqual({
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    });
  });

  it("keeps expected outcomes value-free and rejects cross-kind rows", () => {
    const routeInput = parseSuggestedWaypointGuideCommandRouteInput(
      CREATE_BODY,
      RELATIONSHIP_ID,
    )!;
    const stale = {
      ...appliedSaveRow(),
      outcome_code: "stale" as const,
      committed_at: null,
      draft_saved_at: null,
    };
    expect(
      projectSuggestedWaypointGuideCommandResult(routeInput, {
        ok: true,
        data: stale,
        error: null,
      }),
    ).toEqual({
      ok: false,
      outcome: "stale",
      suggestedWaypointId: null,
      error: null,
    });

    const widened = { ...appliedSaveRow(), pending_version_id: VERSION_ID };
    expect(
      projectSuggestedWaypointGuideCommandResult(routeInput, {
        ok: true,
        data: widened,
        error: null,
      }),
    ).toEqual({
      ok: false,
      outcome: null,
      suggestedWaypointId: null,
      error: "command_failed",
    });
  });

  it("maps request denial separately from every other failure", () => {
    const routeInput = parseSuggestedWaypointGuideCommandRouteInput(
      CREATE_BODY,
      RELATIONSHIP_ID,
    )!;
    expect(
      projectSuggestedWaypointGuideCommandResult(routeInput, {
        ok: false,
        data: null,
        error: "solmind_suggested_waypoint_request_denied",
      }),
    ).toMatchObject({ error: "command_denied" });
    expect(
      projectSuggestedWaypointGuideCommandResult(routeInput, {
        ok: false,
        data: null,
        error: "solmind_suggested_waypoint_request_failed",
      }),
    ).toMatchObject({ error: "command_failed" });
  });
});

describe("Guide command route contract integration", () => {
  it("runs the real request composition with protected sources and executor", async () => {
    const principal: SupabaseAuthenticatedUser = {
      providerName: "supabase",
      providerUserId: "guide-provider-user",
    };
    const fixture: InMemoryAuthSourceFixture = {
      accounts: [
        {
          principal,
          serverAuthContextInput: {
            authenticatedUser: principal,
            authProviderIdentity: {
              userAccountId: GUIDE_ACCOUNT_ID,
              providerName: "supabase",
              providerUserId: "guide-provider-user",
              status: "active",
            },
            userAccount: {
              userAccountId: GUIDE_ACCOUNT_ID,
              accountStatus: "active",
            },
            session: {
              userAccountId: GUIDE_ACCOUNT_ID,
              activeRoleContext: "guide",
              sessionStatus: "active",
            },
            activeRoleAssignment: {
              userAccountId: GUIDE_ACCOUNT_ID,
              roleCode: "guide",
              roleStatus: "active",
            },
            guideProfile: {
              guideProfileId: GUIDE_PROFILE_ID,
              userAccountId: GUIDE_ACCOUNT_ID,
              status: "active",
            },
            explorerProfile: null,
          },
        },
      ],
      relationships: [
        {
          guideExplorerRelationshipId: RELATIONSHIP_ID,
          guideProfileId: GUIDE_PROFILE_ID,
          explorerProfileId: EXPLORER_PROFILE_ID,
          relationshipStatus: "active",
        },
      ],
    };
    const executor = {
      execute: vi.fn(async () =>
        Object.freeze({
          functionName: "solmind_save_suggested_waypoint_draft" as const,
          data: appliedSaveRow(),
          error: null,
        }),
      ),
    };
    const routeInput = parseSuggestedWaypointGuideCommandRouteInput(
      CREATE_BODY,
      RELATIONSHIP_ID,
    )!;
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource: createInMemoryRequestAuthPrincipalSource(principal),
        authSource: createInMemoryAuthSource(fixture),
        executor,
        identifiers: {
          suggestedWaypointIdForCreate: () => SUGGESTION_ID,
          versionIdForSchedule: () => VERSION_ID,
        },
      },
      routeInput.request,
    );

    expect(projectSuggestedWaypointGuideCommandResult(routeInput, result)).toEqual({
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    });
    expect(executor.execute).toHaveBeenCalledWith({
      functionName: "solmind_save_suggested_waypoint_draft",
      args: expect.objectContaining({
        p_actor_user_account_id: GUIDE_ACCOUNT_ID,
        p_guide_explorer_relationship_id: RELATIONSHIP_ID,
        p_operation_id: OPERATION_ID,
      }),
    });
  });
});
