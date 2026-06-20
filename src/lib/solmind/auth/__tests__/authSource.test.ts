import { describe, expect, it } from "vitest";

import {
  createInMemoryAuthSource,
  type InMemoryAuthSourceFixture,
} from "../authSource";
import {
  deriveTrustedServerAuthContext,
  type DeriveTrustedServerAuthContextInput,
  type SupabaseAuthenticatedUser,
} from "../serverAuthContext";
import type { SolMindRelationshipRecord } from "../relationshipAccess";

// Stable IDs. Every stored record is server-trusted; request values below are
// lookup selectors only.
const GUIDE_USER_ID = "user-guide-1";
const EXPLORER_USER_ID = "user-explorer-1";
const ADMIN_USER_ID = "user-admin-1";

const GUIDE_PROFILE_A = "guide-profile-a";
const EXPLORER_PROFILE_A = "explorer-profile-a";

const RELATIONSHIP_ID = "rel-1";
const UNKNOWN_RELATIONSHIP_ID = "rel-does-not-exist";

const PROVIDER_NAME = "supabase";

function principalFor(role: "admin" | "guide" | "explorer"): SupabaseAuthenticatedUser {
  return { providerName: PROVIDER_NAME, providerUserId: `auth-user-${role}-1` };
}

// Build a fully-valid trusted-context input for a given canonical role, in the
// style of serverAuthContext.test.ts. The active role is carried by the
// server-loaded session record.
function validServerAuthContextInput(
  role: "admin" | "guide" | "explorer",
): DeriveTrustedServerAuthContextInput {
  const userAccountId =
    role === "admin"
      ? ADMIN_USER_ID
      : role === "guide"
        ? GUIDE_USER_ID
        : EXPLORER_USER_ID;
  const { providerUserId } = principalFor(role);

  return {
    authenticatedUser: { providerName: PROVIDER_NAME, providerUserId },
    authProviderIdentity: {
      userAccountId,
      providerName: PROVIDER_NAME,
      providerUserId,
      status: "active",
    },
    userAccount: { userAccountId, accountStatus: "active" },
    session: {
      userAccountId,
      activeRoleContext: role,
      sessionStatus: "active",
    },
    activeRoleAssignment: {
      userAccountId,
      roleCode: role,
      roleStatus: "active",
    },
    guideProfile:
      role === "guide"
        ? { guideProfileId: GUIDE_PROFILE_A, userAccountId, status: "active" }
        : null,
    explorerProfile:
      role === "explorer"
        ? {
            explorerProfileId: EXPLORER_PROFILE_A,
            userAccountId,
            status: "active",
          }
        : null,
  };
}

function activeRelationship(): SolMindRelationshipRecord {
  return {
    guideExplorerRelationshipId: RELATIONSHIP_ID,
    guideProfileId: GUIDE_PROFILE_A,
    explorerProfileId: EXPLORER_PROFILE_A,
    relationshipStatus: "active",
  };
}

// A source preloaded with guide/explorer/admin accounts and one relationship.
function fullFixture(): InMemoryAuthSourceFixture {
  return {
    accounts: [
      {
        principal: principalFor("guide"),
        serverAuthContextInput: validServerAuthContextInput("guide"),
      },
      {
        principal: principalFor("explorer"),
        serverAuthContextInput: validServerAuthContextInput("explorer"),
      },
      {
        principal: principalFor("admin"),
        serverAuthContextInput: validServerAuthContextInput("admin"),
      },
    ],
    relationships: [activeRelationship()],
  };
}

describe("createInMemoryAuthSource - loadServerAuthContextInput", () => {
  it("returns a valid DeriveTrustedServerAuthContextInput-shaped payload when all records are provided", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    expect(input).toEqual(validServerAuthContextInput("guide"));
  });

  it("returns an all-null input (deny-by-default) for an unknown principal, without echoing the request value as a record", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: {
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-nobody",
      },
    });

    expect(input).toEqual({
      authenticatedUser: null,
      authProviderIdentity: null,
      userAccount: null,
      session: null,
      activeRoleAssignment: null,
      guideProfile: null,
      explorerProfile: null,
    });
  });
});

describe("loaded input composes with deriveTrustedServerAuthContext", () => {
  it("derives a trusted guide context from the loaded input", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });
    const derived = deriveTrustedServerAuthContext(input);

    expect(derived.allowed).toBe(true);
    if (derived.allowed) {
      expect(derived.context.activeRole).toBe("guide");
      expect(derived.context.identity).toEqual({
        userAccountId: GUIDE_USER_ID,
        guideProfileId: GUIDE_PROFILE_A,
        explorerProfileId: null,
      });
    }
  });

  it("derives a trusted explorer context from the loaded input", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("explorer"),
    });
    const derived = deriveTrustedServerAuthContext(input);

    expect(derived.allowed).toBe(true);
    if (derived.allowed) {
      expect(derived.context.activeRole).toBe("explorer");
    }
  });

  it("derives a trusted admin context from the loaded input", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("admin"),
    });
    const derived = deriveTrustedServerAuthContext(input);

    expect(derived.allowed).toBe(true);
    if (derived.allowed) {
      expect(derived.context.activeRole).toBe("admin");
    }
  });

  it("derives a denial from the all-null input returned for an unknown principal", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: {
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-nobody",
      },
    });
    const derived = deriveTrustedServerAuthContext(input);

    // The seam never authorizes; it just returns deny-able records.
    expect(derived.allowed).toBe(false);
  });
});

describe("createInMemoryAuthSource - loadGuideRelationship", () => {
  it("returns the matching server-loaded relationship by id", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const relationship = await source.loadGuideRelationship({
      relationshipId: RELATIONSHIP_ID,
    });

    expect(relationship).toEqual(activeRelationship());
  });

  it("returns null for an unknown relationship id", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const relationship = await source.loadGuideRelationship({
      relationshipId: UNKNOWN_RELATIONSHIP_ID,
    });

    expect(relationship).toBeNull();
  });

  it("returns null when no relationships fixture was provided (missing optional record, no throw)", async () => {
    const source = createInMemoryAuthSource({
      accounts: [
        {
          principal: principalFor("guide"),
          serverAuthContextInput: validServerAuthContextInput("guide"),
        },
      ],
    });

    const relationship = await source.loadGuideRelationship({
      relationshipId: RELATIONSHIP_ID,
    });

    expect(relationship).toBeNull();
  });

  it("does not grant authority by itself: the lookup returns a plain record with no allow/deny decision", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const relationship = await source.loadGuideRelationship({
      relationshipId: RELATIONSHIP_ID,
    });

    expect(relationship).not.toBeNull();
    if (relationship !== null) {
      // It is a record projection, not an authorization result.
      expect(relationship).not.toHaveProperty("allowed");
      expect(relationship).not.toHaveProperty("reason");
      expect(Object.keys(relationship).sort()).toEqual([
        "explorerProfileId",
        "guideExplorerRelationshipId",
        "guideProfileId",
        "relationshipStatus",
      ]);
    }
  });
});

describe("createInMemoryAuthSource - selectors are not authority and have no side effects", () => {
  it("returns server-trusted records unchanged regardless of request selector values", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    // A relationship lookup (a browser-supplied selector) must not change what a
    // later context load returns.
    await source.loadGuideRelationship({ relationshipId: RELATIONSHIP_ID });
    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    expect(input).toEqual(validServerAuthContextInput("guide"));
  });

  it("is deterministic and side-effect-free across repeated calls", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const firstInput = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });
    const secondInput = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });
    const firstRel = await source.loadGuideRelationship({
      relationshipId: RELATIONSHIP_ID,
    });
    const secondRel = await source.loadGuideRelationship({
      relationshipId: RELATIONSHIP_ID,
    });

    expect(firstInput).toEqual(secondInput);
    expect(firstRel).toEqual(secondRel);
    expect(firstInput).toEqual(validServerAuthContextInput("guide"));
  });

  it("does not perform any denial/auth decision inside the source seam (results are raw records, not decisions)", async () => {
    const source = createInMemoryAuthSource(fullFixture());

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    // The returned value is the raw input shape, with no allowed/reason keys.
    expect(input).not.toHaveProperty("allowed");
    expect(input).not.toHaveProperty("reason");
  });
});
