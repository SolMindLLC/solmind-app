import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryAuthSource,
  type InMemoryAuthSourceFixture,
} from "../../auth/authSource";
import { createInMemoryRequestAuthPrincipalSource } from "../../auth/requestAuthPrincipalSource";
import { type SupabaseAuthenticatedUser } from "../../auth/serverAuthContext";
import { SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION } from "../suggestedWaypointRelationshipSelectorContract";
import {
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED,
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED,
  resolveSuggestedWaypointRelationshipSelectorRequest,
} from "../suggestedWaypointRelationshipSelectorRequest";

const GUIDE_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const EXPLORER_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const GUIDE_PROFILE_ID = "33333333-3333-4333-8333-333333333333";
const EXPLORER_PROFILE_ID = "44444444-4444-4444-8444-444444444444";
const RELATIONSHIP_ID = "55555555-5555-4555-8555-555555555555";
const TIMESTAMP = "2026-08-14T17:00:00.000Z";

const GUIDE_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: "supabase",
  providerUserId: "guide-provider-user",
};
const EXPLORER_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: "supabase",
  providerUserId: "explorer-provider-user",
};

function authAccount(args: {
  principal: SupabaseAuthenticatedUser;
  accountId: string;
  role: "guide" | "explorer";
}) {
  return {
    principal: args.principal,
    serverAuthContextInput: {
      authenticatedUser: args.principal,
      authProviderIdentity: {
        userAccountId: args.accountId,
        providerName: args.principal.providerName,
        providerUserId: args.principal.providerUserId,
        status: "active",
      },
      userAccount: { userAccountId: args.accountId, accountStatus: "active" },
      session: {
        userAccountId: args.accountId,
        activeRoleContext: args.role,
        sessionStatus: "active",
      },
      activeRoleAssignment: {
        userAccountId: args.accountId,
        roleCode: args.role,
        roleStatus: "active",
      },
      guideProfile:
        args.role === "guide"
          ? { guideProfileId: GUIDE_PROFILE_ID, userAccountId: args.accountId, status: "active" }
          : null,
      explorerProfile:
        args.role === "explorer"
          ? { explorerProfileId: EXPLORER_PROFILE_ID, userAccountId: args.accountId, status: "active" }
          : null,
    },
  };
}

function fixture(): InMemoryAuthSourceFixture {
  return {
    accounts: [
      authAccount({ principal: GUIDE_PRINCIPAL, accountId: GUIDE_ACCOUNT_ID, role: "guide" }),
      authAccount({ principal: EXPLORER_PRINCIPAL, accountId: EXPLORER_ACCOUNT_ID, role: "explorer" }),
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
}

const PAGE = Object.freeze({
  items: Object.freeze([
    Object.freeze({
      guide_explorer_relationship_id: RELATIONSHIP_ID,
      explorer_display_name: "Avery",
      relationship_created_at: TIMESTAMP,
    }),
  ]),
  next_cursor: null,
  total_count: 1,
});

describe("resolveSuggestedWaypointRelationshipSelectorRequest", () => {
  it("derives the Guide actor and permits pagination only", async () => {
    const executor = {
      execute: vi.fn().mockResolvedValue({ data: PAGE, error: null }),
    };
    const result = await resolveSuggestedWaypointRelationshipSelectorRequest(
      {
        principalSource: createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
      },
      { pageSize: 10, cursor: null },
    );

    expect(result).toEqual({ ok: true, data: PAGE, error: null });
    expect(executor.execute).toHaveBeenCalledWith({
      functionName: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION,
      args: {
        p_actor_user_account_id: GUIDE_ACCOUNT_ID,
        p_page_size: 10,
        p_cursor: null,
      },
    });
  });

  it.each([
    { pageSize: 25, cursor: null },
    { pageSize: 10, cursor: "not a cursor" },
    { pageSize: 10, cursor: null, actorUserAccountId: GUIDE_ACCOUNT_ID },
  ])("denies malformed or authority-bearing client input %#", async (input) => {
    const principalSource = createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL);
    const principalSpy = vi.spyOn(principalSource, "resolveAuthenticatedUser");
    const executor = { execute: vi.fn() };
    const result = await resolveSuggestedWaypointRelationshipSelectorRequest(
      { principalSource, authSource: createInMemoryAuthSource(fixture()), executor },
      input,
    );

    expect(result.error).toBe(SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED);
    expect(principalSpy).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("denies Explorer role and absent principals without selector IO", async () => {
    for (const principal of [EXPLORER_PRINCIPAL, null]) {
      const executor = { execute: vi.fn() };
      const result = await resolveSuggestedWaypointRelationshipSelectorRequest(
        {
          principalSource: createInMemoryRequestAuthPrincipalSource(principal),
          authSource: createInMemoryAuthSource(fixture()),
          executor,
        },
        { pageSize: 10, cursor: null },
      );
      expect(result.error).toBe(SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED);
      expect(executor.execute).not.toHaveBeenCalled();
    }
  });

  it("collapses selector and thrown failures to one value-free result", async () => {
    const executor = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: "private detail" })
        .mockRejectedValueOnce(new Error("private detail")),
    };
    const dependencies = {
      principalSource: createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
      authSource: createInMemoryAuthSource(fixture()),
      executor,
    };

    for (let index = 0; index < 2; index += 1) {
      const result = await resolveSuggestedWaypointRelationshipSelectorRequest(
        dependencies,
        { pageSize: 10, cursor: null },
      );
      expect(result).toEqual({
        ok: false,
        data: null,
        error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED,
      });
      expect(JSON.stringify(result)).not.toContain("private detail");
    }
  });

  it("denies a throwing proxy before auth IO", async () => {
    const principalSource = createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL);
    const principalSpy = vi.spyOn(principalSource, "resolveAuthenticatedUser");
    const executor = { execute: vi.fn() };
    const input = new Proxy(
      { pageSize: 10, cursor: null },
      { ownKeys: () => { throw new Error("hostile proxy"); } },
    );

    const result = await resolveSuggestedWaypointRelationshipSelectorRequest(
      { principalSource, authSource: createInMemoryAuthSource(fixture()), executor },
      input,
    );
    expect(result.error).toBe(SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED);
    expect(principalSpy).not.toHaveBeenCalled();
  });
});
