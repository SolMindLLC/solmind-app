import { describe, expect, it } from "vitest";

import {
  createSupabaseAuthSource,
  type AuthProviderIdentityRow,
  type ExplorerProfileRow,
  type GuideExplorerRelationshipRow,
  type GuideProfileRow,
  type SolMindAuthQueryClient,
  type UserAccountRow,
  type UserRoleAssignmentRow,
  type UserSessionRow,
} from "../serverAuthSourceAdapter";
import {
  deriveTrustedServerAuthContext,
  type DeriveTrustedServerAuthContextInput,
} from "../../auth";

// Stable IDs. Rows below are database-style records; request values are lookup
// selectors only.
const GUIDE_USER_ID = "user-guide-1";
const EXPLORER_USER_ID = "user-explorer-1";
const ADMIN_USER_ID = "user-admin-1";

const GUIDE_PROFILE_A = "guide-profile-a";
const EXPLORER_PROFILE_A = "explorer-profile-a";

const RELATIONSHIP_ID = "rel-1";
const UNKNOWN_RELATIONSHIP_ID = "rel-does-not-exist";

const PROVIDER_NAME = "supabase";

function providerUserIdFor(role: "admin" | "guide" | "explorer"): string {
  return `auth-user-${role}-1`;
}

function userIdFor(role: "admin" | "guide" | "explorer"): string {
  return role === "admin"
    ? ADMIN_USER_ID
    : role === "guide"
      ? GUIDE_USER_ID
      : EXPLORER_USER_ID;
}

// --- Deterministic in-memory fake of the injected query client ---
//
// It returns matching rows from the provided arrays and null otherwise. It makes
// no decisions; it is purely a row store for tests. No network, no database, no
// Supabase imports.
type FakeData = {
  providerIdentities?: AuthProviderIdentityRow[];
  userAccounts?: UserAccountRow[];
  sessions?: UserSessionRow[];
  roleAssignments?: UserRoleAssignmentRow[];
  guideProfiles?: GuideProfileRow[];
  explorerProfiles?: ExplorerProfileRow[];
  relationships?: GuideExplorerRelationshipRow[];
};

function createFakeClient(data: FakeData): SolMindAuthQueryClient {
  const providerIdentities = data.providerIdentities ?? [];
  const userAccounts = data.userAccounts ?? [];
  const sessions = data.sessions ?? [];
  const roleAssignments = data.roleAssignments ?? [];
  const guideProfiles = data.guideProfiles ?? [];
  const explorerProfiles = data.explorerProfiles ?? [];
  const relationships = data.relationships ?? [];

  return {
    findAuthProviderIdentity({ providerName, providerUserId }) {
      return Promise.resolve(
        providerIdentities.find(
          (row) =>
            row.provider_name === providerName &&
            row.provider_user_id === providerUserId,
        ) ?? null,
      );
    },
    findUserAccountById({ userAccountId }) {
      return Promise.resolve(
        userAccounts.find((row) => row.user_account_id === userAccountId) ??
          null,
      );
    },
    findActiveSessionByUserAccountId({ userAccountId }) {
      return Promise.resolve(
        sessions.find((row) => row.user_account_id === userAccountId) ?? null,
      );
    },
    findActiveRoleAssignment({ userAccountId, roleCode }) {
      return Promise.resolve(
        roleAssignments.find(
          (row) =>
            row.user_account_id === userAccountId && row.role_code === roleCode,
        ) ?? null,
      );
    },
    findGuideProfileByUserAccountId({ userAccountId }) {
      return Promise.resolve(
        guideProfiles.find((row) => row.user_account_id === userAccountId) ??
          null,
      );
    },
    findExplorerProfileByUserAccountId({ userAccountId }) {
      return Promise.resolve(
        explorerProfiles.find((row) => row.user_account_id === userAccountId) ??
          null,
      );
    },
    findGuideExplorerRelationshipById({ relationshipId }) {
      return Promise.resolve(
        relationships.find(
          (row) => row.guide_explorer_relationship_id === relationshipId,
        ) ?? null,
      );
    },
  };
}

// Full row set for a given role, in the database snake_case shape.
function rowsFor(role: "admin" | "guide" | "explorer"): FakeData {
  const userAccountId = userIdFor(role);
  const providerUserId = providerUserIdFor(role);

  return {
    providerIdentities: [
      {
        user_account_id: userAccountId,
        provider_name: PROVIDER_NAME,
        provider_user_id: providerUserId,
        status: "active",
      },
    ],
    userAccounts: [{ user_account_id: userAccountId, account_status: "active" }],
    sessions: [
      {
        user_account_id: userAccountId,
        active_role_context: role,
        session_status: "active",
      },
    ],
    roleAssignments: [
      {
        user_account_id: userAccountId,
        role_code: role,
        role_status: "active",
      },
    ],
    guideProfiles:
      role === "guide"
        ? [
            {
              guide_profile_id: GUIDE_PROFILE_A,
              user_account_id: userAccountId,
              status: "active",
            },
          ]
        : [],
    explorerProfiles:
      role === "explorer"
        ? [
            {
              explorer_profile_id: EXPLORER_PROFILE_A,
              user_account_id: userAccountId,
              status: "active",
            },
          ]
        : [],
  };
}

function principalFor(role: "admin" | "guide" | "explorer") {
  return { providerName: PROVIDER_NAME, providerUserId: providerUserIdFor(role) };
}

// The camelCase projection the adapter should produce for a fully-populated role.
function expectedInputFor(
  role: "admin" | "guide" | "explorer",
): DeriveTrustedServerAuthContextInput {
  const userAccountId = userIdFor(role);

  return {
    authenticatedUser: principalFor(role),
    authProviderIdentity: {
      userAccountId,
      providerName: PROVIDER_NAME,
      providerUserId: providerUserIdFor(role),
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

describe("createSupabaseAuthSource - loadServerAuthContextInput mapping", () => {
  it("maps a full guide row set to the camelCase auth context input", async () => {
    const source = createSupabaseAuthSource(createFakeClient(rowsFor("guide")));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    expect(input).toEqual(expectedInputFor("guide"));
  });

  it("maps a full explorer row set to the camelCase auth context input", async () => {
    const source = createSupabaseAuthSource(
      createFakeClient(rowsFor("explorer")),
    );

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("explorer"),
    });

    expect(input).toEqual(expectedInputFor("explorer"));
  });

  it("maps a full admin row set (no profiles) to the camelCase auth context input", async () => {
    const source = createSupabaseAuthSource(createFakeClient(rowsFor("admin")));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("admin"),
    });

    expect(input).toEqual(expectedInputFor("admin"));
  });

  it("maps snake_case columns to camelCase fields exactly", async () => {
    const source = createSupabaseAuthSource(createFakeClient(rowsFor("guide")));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    // Spot-check the snake_case -> camelCase field renames explicitly.
    expect(input.authProviderIdentity?.userAccountId).toBe(GUIDE_USER_ID);
    expect(input.authProviderIdentity?.providerUserId).toBe(
      providerUserIdFor("guide"),
    );
    expect(input.userAccount?.accountStatus).toBe("active");
    expect(input.session?.activeRoleContext).toBe("guide");
    expect(input.activeRoleAssignment?.roleCode).toBe("guide");
    expect(input.guideProfile?.guideProfileId).toBe(GUIDE_PROFILE_A);
  });
});

describe("createSupabaseAuthSource - missing rows return null (deny-by-default)", () => {
  it("returns null records (but echoes the verified principal) when the provider identity is missing", async () => {
    const source = createSupabaseAuthSource(createFakeClient({}));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    expect(input).toEqual({
      authenticatedUser: principalFor("guide"),
      authProviderIdentity: null,
      userAccount: null,
      session: null,
      activeRoleAssignment: null,
      guideProfile: null,
      explorerProfile: null,
    });
  });

  it("returns a null user account (and null downstream) when the account row is missing", async () => {
    const data = rowsFor("guide");
    data.userAccounts = [];
    const source = createSupabaseAuthSource(createFakeClient(data));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    expect(input.authProviderIdentity).not.toBeNull();
    expect(input.userAccount).toBeNull();
    expect(input.session).toBeNull();
    expect(input.activeRoleAssignment).toBeNull();
    expect(input.guideProfile).toBeNull();
  });

  it("returns a null session and null role assignment when the session is missing", async () => {
    const data = rowsFor("guide");
    data.sessions = [];
    const source = createSupabaseAuthSource(createFakeClient(data));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    expect(input.userAccount).not.toBeNull();
    expect(input.session).toBeNull();
    // The role assignment is keyed off the session role, so it is null too.
    expect(input.activeRoleAssignment).toBeNull();
    // Profiles are keyed off the account, so they still load.
    expect(input.guideProfile).not.toBeNull();
  });

  it("returns a null role assignment when no matching assignment row exists", async () => {
    const data = rowsFor("guide");
    data.roleAssignments = [];
    const source = createSupabaseAuthSource(createFakeClient(data));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    expect(input.session).not.toBeNull();
    expect(input.activeRoleAssignment).toBeNull();
  });

  it("returns a null guide profile when the profile row is missing", async () => {
    const data = rowsFor("guide");
    data.guideProfiles = [];
    const source = createSupabaseAuthSource(createFakeClient(data));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    expect(input.guideProfile).toBeNull();
  });
});

describe("createSupabaseAuthSource - loadGuideRelationship", () => {
  const relationshipRow: GuideExplorerRelationshipRow = {
    guide_explorer_relationship_id: RELATIONSHIP_ID,
    guide_profile_id: GUIDE_PROFILE_A,
    explorer_profile_id: EXPLORER_PROFILE_A,
    relationship_status: "active",
  };

  it("maps a known relationship row to the camelCase relationship record", async () => {
    const source = createSupabaseAuthSource(
      createFakeClient({ relationships: [relationshipRow] }),
    );

    const relationship = await source.loadGuideRelationship({
      relationshipId: RELATIONSHIP_ID,
    });

    expect(relationship).toEqual({
      guideExplorerRelationshipId: RELATIONSHIP_ID,
      guideProfileId: GUIDE_PROFILE_A,
      explorerProfileId: EXPLORER_PROFILE_A,
      relationshipStatus: "active",
    });
  });

  it("returns null for an unknown relationship id", async () => {
    const source = createSupabaseAuthSource(
      createFakeClient({ relationships: [relationshipRow] }),
    );

    const relationship = await source.loadGuideRelationship({
      relationshipId: UNKNOWN_RELATIONSHIP_ID,
    });

    expect(relationship).toBeNull();
  });
});

describe("createSupabaseAuthSource - loads records only, no authorization", () => {
  it("returns the raw input shape with no allow/deny decision keys", async () => {
    const source = createSupabaseAuthSource(createFakeClient(rowsFor("guide")));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });

    expect(input).not.toHaveProperty("allowed");
    expect(input).not.toHaveProperty("reason");
  });

  it("returns a plain relationship record (not an authorization result)", async () => {
    const source = createSupabaseAuthSource(
      createFakeClient({
        relationships: [
          {
            guide_explorer_relationship_id: RELATIONSHIP_ID,
            guide_profile_id: GUIDE_PROFILE_A,
            explorer_profile_id: EXPLORER_PROFILE_A,
            relationship_status: "active",
          },
        ],
      }),
    );

    const relationship = await source.loadGuideRelationship({
      relationshipId: RELATIONSHIP_ID,
    });

    expect(relationship).not.toBeNull();
    if (relationship !== null) {
      expect(relationship).not.toHaveProperty("allowed");
      expect(relationship).not.toHaveProperty("reason");
    }
  });
});

describe("createSupabaseAuthSource - composes with the existing guard layer", () => {
  it("produces a guide input that deriveTrustedServerAuthContext accepts", async () => {
    const source = createSupabaseAuthSource(createFakeClient(rowsFor("guide")));

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

  it("produces a denial via the guard layer when the provider identity is missing", async () => {
    const source = createSupabaseAuthSource(createFakeClient({}));

    const input = await source.loadServerAuthContextInput({
      authenticatedUser: principalFor("guide"),
    });
    const derived = deriveTrustedServerAuthContext(input);

    // The adapter never authorizes; the guard layer denies the incomplete input.
    expect(derived.allowed).toBe(false);
  });
});
