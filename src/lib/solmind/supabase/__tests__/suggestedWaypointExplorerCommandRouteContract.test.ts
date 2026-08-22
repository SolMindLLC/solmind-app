import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryAuthSource,
  type InMemoryAuthSourceFixture,
} from "@/lib/solmind/auth/authSource";
import { createInMemoryRequestAuthPrincipalSource } from "@/lib/solmind/auth/requestAuthPrincipalSource";
import { type SupabaseAuthenticatedUser } from "@/lib/solmind/auth/serverAuthContext";
import { resolveSuggestedWaypointRequest } from "@/lib/solmind/supabase/suggestedWaypointRequestComposition";
import { type SuggestedWaypointRpcPayload } from "@/lib/solmind/supabase/suggestedWaypointRpcContract";
import {
  parseSuggestedWaypointExplorerCommandRouteInput,
  projectSuggestedWaypointExplorerCommandResult,
} from "../suggestedWaypointExplorerCommandRouteContract";

const EXPLORER_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const RELATIONSHIP_ID = "44444444-4444-4444-8444-444444444444";
const SUGGESTION_ID = "55555555-5555-4555-8555-555555555555";
const VERSION_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_VERSION_ID = "99999999-9999-4999-8999-999999999999";
const GUIDE_PROFILE_ID = "77777777-7777-4777-8777-777777777777";
const EXPLORER_PROFILE_ID = "88888888-8888-4888-8888-888888888888";
const TIMESTAMP = "2026-08-21T20:00:00.000Z";

const MARK_READ_BODY = Object.freeze({
  kind: "explorer.mark_read",
  operationId: OPERATION_ID,
  versionId: VERSION_ID,
});

const ACKNOWLEDGE_BODY = Object.freeze({
  kind: "explorer.acknowledge",
  operationId: OPERATION_ID,
  expectedCurrentVersionId: VERSION_ID,
});

function commonRow(outcome = "applied" as const) {
  return {
    outcome_code: outcome,
    operation_id: OPERATION_ID,
    suggested_waypoint_id: SUGGESTION_ID,
    authoring_revision: 1,
    current_version_id: VERSION_ID,
    committed_at: TIMESTAMP,
  };
}

function appliedReadRow() {
  return Object.freeze({ ...commonRow(), read_at: TIMESTAMP });
}

function appliedAcknowledgeRow() {
  return Object.freeze({
    ...commonRow(),
    acknowledged_version_id: VERSION_ID,
    acknowledged_at: TIMESTAMP,
  });
}

describe("parseSuggestedWaypointExplorerCommandRouteInput", () => {
  it("injects the path selector and binds both closed Explorer commands", () => {
    const markRead = parseSuggestedWaypointExplorerCommandRouteInput(
      MARK_READ_BODY,
      SUGGESTION_ID,
    );
    const acknowledge = parseSuggestedWaypointExplorerCommandRouteInput(
      ACKNOWLEDGE_BODY,
      SUGGESTION_ID,
    );

    expect(markRead).toMatchObject({
      functionName: "solmind_mark_suggested_waypoint_read",
      request: { ...MARK_READ_BODY, suggestedWaypointId: SUGGESTION_ID },
    });
    expect(acknowledge).toMatchObject({
      functionName: "solmind_acknowledge_suggested_waypoint_receipt",
      request: { ...ACKNOWLEDGE_BODY, suggestedWaypointId: SUGGESTION_ID },
    });
    expect(markRead?.permittedExpectedOutcomes).not.toContain("stale");
    expect(acknowledge?.permittedExpectedOutcomes).toContain("stale");
    expect(Object.isFrozen(markRead)).toBe(true);
    expect(Object.isFrozen(markRead?.request)).toBe(true);
  });

  it.each([
    [{ ...MARK_READ_BODY, suggestedWaypointId: SUGGESTION_ID }, SUGGESTION_ID],
    [{ ...MARK_READ_BODY, actorUserAccountId: EXPLORER_ACCOUNT_ID }, SUGGESTION_ID],
    [{ ...MARK_READ_BODY, role: "explorer" }, SUGGESTION_ID],
    [{ ...MARK_READ_BODY, extra: true }, SUGGESTION_ID],
    [{ ...MARK_READ_BODY, operationId: "not-a-uuid" }, SUGGESTION_ID],
    [{ ...MARK_READ_BODY, versionId: "not-a-uuid" }, SUGGESTION_ID],
    [{ ...ACKNOWLEDGE_BODY, expectedCurrentVersionId: "bad" }, SUGGESTION_ID],
    [{ kind: "explorer.get", operationId: OPERATION_ID }, SUGGESTION_ID],
    [MARK_READ_BODY, "not-a-suggestion"],
    [null, SUGGESTION_ID],
    [[], SUGGESTION_ID],
  ])("rejects malformed or authority-bearing input %#", (body, suggestionId) => {
    expect(
      parseSuggestedWaypointExplorerCommandRouteInput(body, suggestionId),
    ).toBeNull();
  });

  it("rejects accessors, symbols, inherited objects, and hostile proxies", () => {
    const accessor = { ...MARK_READ_BODY } as Record<string, unknown>;
    Object.defineProperty(accessor, "operationId", {
      enumerable: true,
      get: () => OPERATION_ID,
    });
    const symbol = { ...MARK_READ_BODY, [Symbol("hidden")]: "private" };
    const inherited = Object.create(MARK_READ_BODY);
    const hostile = new Proxy(MARK_READ_BODY, {
      ownKeys: () => {
        throw new Error("private trap detail");
      },
    });

    for (const value of [accessor, symbol, inherited, hostile]) {
      expect(
        parseSuggestedWaypointExplorerCommandRouteInput(value, SUGGESTION_ID),
      ).toBeNull();
    }
  });

  it("snapshots each accepted body data property exactly once", () => {
    const descriptorReads = new Map<PropertyKey, number>();
    let ownKeyReads = 0;
    const readOnce = new Proxy(MARK_READ_BODY, {
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
      parseSuggestedWaypointExplorerCommandRouteInput(readOnce, SUGGESTION_ID),
    ).not.toBeNull();
    expect(ownKeyReads).toBe(1);
    expect([...descriptorReads.values()]).toEqual([1, 1, 1]);
  });
});

describe("projectSuggestedWaypointExplorerCommandResult", () => {
  it("returns only the canonical selector for function-bound committed rows", () => {
    const markRead = parseSuggestedWaypointExplorerCommandRouteInput(
      MARK_READ_BODY,
      SUGGESTION_ID,
    )!;
    const acknowledge = parseSuggestedWaypointExplorerCommandRouteInput(
      ACKNOWLEDGE_BODY,
      SUGGESTION_ID,
    )!;

    expect(
      projectSuggestedWaypointExplorerCommandResult(markRead, {
        ok: true,
        data: appliedReadRow(),
        error: null,
      }),
    ).toEqual({
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    });
    expect(
      projectSuggestedWaypointExplorerCommandResult(acknowledge, {
        ok: true,
        data: appliedAcknowledgeRow(),
        error: null,
      }),
    ).toMatchObject({ ok: true, outcome: "applied" });
  });

  it("keeps expected non-success value-free and kind-specific", () => {
    const markRead = parseSuggestedWaypointExplorerCommandRouteInput(
      MARK_READ_BODY,
      SUGGESTION_ID,
    )!;
    const acknowledge = parseSuggestedWaypointExplorerCommandRouteInput(
      ACKNOWLEDGE_BODY,
      SUGGESTION_ID,
    )!;
    const staleRead = {
      ...appliedReadRow(),
      outcome_code: "stale" as const,
      committed_at: null,
      read_at: null,
    };
    const staleAck = {
      ...appliedAcknowledgeRow(),
      outcome_code: "stale" as const,
      committed_at: null,
      acknowledged_version_id: null,
      acknowledged_at: null,
    };

    expect(
      projectSuggestedWaypointExplorerCommandResult(markRead, {
        ok: true,
        data: staleRead as unknown as SuggestedWaypointRpcPayload,
        error: null,
      }),
    ).toMatchObject({ error: "command_failed" });
    expect(
      projectSuggestedWaypointExplorerCommandResult(acknowledge, {
        ok: true,
        data: staleAck as unknown as SuggestedWaypointRpcPayload,
        error: null,
      }),
    ).toEqual({
      ok: false,
      outcome: "stale",
      suggestedWaypointId: null,
      error: null,
    });
  });

  it.each([
    { ...appliedReadRow(), operation_id: OTHER_VERSION_ID },
    { ...appliedReadRow(), suggested_waypoint_id: OTHER_VERSION_ID },
    { ...appliedReadRow(), current_version_id: OTHER_VERSION_ID },
    { ...appliedReadRow(), private_note: "must not leave" },
  ])("rejects mismatched or widened result %#", (row) => {
    const routeInput = parseSuggestedWaypointExplorerCommandRouteInput(
      MARK_READ_BODY,
      SUGGESTION_ID,
    )!;
    expect(
      projectSuggestedWaypointExplorerCommandResult(routeInput, {
        ok: true,
        data: row,
        error: null,
      }),
    ).toMatchObject({ error: "command_failed" });
  });

  it.each([
    { ...appliedAcknowledgeRow(), current_version_id: OTHER_VERSION_ID },
    { ...appliedAcknowledgeRow(), acknowledged_version_id: OTHER_VERSION_ID },
  ])("rejects acknowledge version-binding mismatch %#", (row) => {
    const routeInput = parseSuggestedWaypointExplorerCommandRouteInput(
      ACKNOWLEDGE_BODY,
      SUGGESTION_ID,
    )!;
    expect(
      projectSuggestedWaypointExplorerCommandResult(routeInput, {
        ok: true,
        data: row,
        error: null,
      }),
    ).toMatchObject({ error: "command_failed" });
  });

  it("maps request denial separately from every other failure", () => {
    const routeInput = parseSuggestedWaypointExplorerCommandRouteInput(
      MARK_READ_BODY,
      SUGGESTION_ID,
    )!;
    expect(
      projectSuggestedWaypointExplorerCommandResult(routeInput, {
        ok: false,
        data: null,
        error: "solmind_suggested_waypoint_request_denied",
      }),
    ).toMatchObject({ error: "command_denied" });
    expect(
      projectSuggestedWaypointExplorerCommandResult(routeInput, {
        ok: false,
        data: null,
        error: "solmind_suggested_waypoint_request_failed",
      }),
    ).toMatchObject({ error: "command_failed" });
  });
});

describe("Explorer command route contract integration", () => {
  it("derives the Explorer actor and binds exact RPC arguments", async () => {
    const principal: SupabaseAuthenticatedUser = {
      providerName: "supabase",
      providerUserId: "explorer-provider-user",
    };
    const fixture: InMemoryAuthSourceFixture = {
      accounts: [
        {
          principal,
          serverAuthContextInput: {
            authenticatedUser: principal,
            authProviderIdentity: {
              userAccountId: EXPLORER_ACCOUNT_ID,
              providerName: "supabase",
              providerUserId: "explorer-provider-user",
              status: "active",
            },
            userAccount: {
              userAccountId: EXPLORER_ACCOUNT_ID,
              accountStatus: "active",
            },
            session: {
              userAccountId: EXPLORER_ACCOUNT_ID,
              activeRoleContext: "explorer",
              sessionStatus: "active",
            },
            activeRoleAssignment: {
              userAccountId: EXPLORER_ACCOUNT_ID,
              roleCode: "explorer",
              roleStatus: "active",
            },
            guideProfile: null,
            explorerProfile: {
              explorerProfileId: EXPLORER_PROFILE_ID,
              userAccountId: EXPLORER_ACCOUNT_ID,
              status: "active",
            },
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
          functionName: "solmind_mark_suggested_waypoint_read" as const,
          data: appliedReadRow(),
          error: null,
        }),
      ),
    };
    const routeInput = parseSuggestedWaypointExplorerCommandRouteInput(
      MARK_READ_BODY,
      SUGGESTION_ID,
    )!;
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource: createInMemoryRequestAuthPrincipalSource(principal),
        authSource: createInMemoryAuthSource(fixture),
        executor,
      },
      routeInput.request,
    );

    expect(projectSuggestedWaypointExplorerCommandResult(routeInput, result)).toEqual({
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    });
    expect(executor.execute).toHaveBeenCalledWith({
      functionName: "solmind_mark_suggested_waypoint_read",
      args: {
        p_actor_user_account_id: EXPLORER_ACCOUNT_ID,
        p_operation_id: OPERATION_ID,
        p_suggested_waypoint_id: SUGGESTION_ID,
        p_version_id: VERSION_ID,
      },
    });
  });
});
