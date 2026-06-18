import { describe, expect, it } from "vitest";

import {
  ACCESS_BOUNDARY_DENY_REASONS,
  decideAdminRelationshipQaAccess,
  decideExplorerRelationshipAccess,
  decideGuideRelationshipAccess,
  resolveAuthenticatedActor,
  type AccessSelectors,
  type AuthenticatedIdentity,
} from "../accessBoundary";
import { ACTOR_DENY_REASONS } from "../roleContext";
import { RELATIONSHIP_ACCESS_DENY_REASONS } from "../relationshipAccess";
import type {
  SolMindRoleAssignmentRecord,
  SolMindSessionRecord,
  SolMindUserAccountRecord,
} from "../roleContext";
import type { SolMindRelationshipRecord } from "../relationshipAccess";

// Stable IDs. The authenticated identity values stand in for server-established
// authority; the selector values stand in for raw browser input.
const GUIDE_USER_ID = "user-guide-1";
const EXPLORER_USER_ID = "user-explorer-1";
const ADMIN_USER_ID = "user-admin-1";
const OTHER_USER_ID = "user-other-9";

const GUIDE_PROFILE_A = "guide-profile-a";
const GUIDE_PROFILE_B = "guide-profile-b";
const EXPLORER_PROFILE_A = "explorer-profile-a";
const EXPLORER_PROFILE_B = "explorer-profile-b";

const RELATIONSHIP_ID = "rel-1";
const OTHER_RELATIONSHIP_ID = "rel-belongs-to-someone-else";

function activeAccount(userAccountId: string): SolMindUserAccountRecord {
  return { userAccountId, accountStatus: "active" };
}

function activeAssignment(
  userAccountId: string,
  roleCode: string,
): SolMindRoleAssignmentRecord {
  return { userAccountId, roleCode, roleStatus: "active" };
}

function activeSession(
  userAccountId: string,
  activeRoleContext: string,
): SolMindSessionRecord {
  return { userAccountId, activeRoleContext, sessionStatus: "active" };
}

function activeRelationship(
  overrides: Partial<SolMindRelationshipRecord> = {},
): SolMindRelationshipRecord {
  return {
    guideExplorerRelationshipId: RELATIONSHIP_ID,
    guideProfileId: GUIDE_PROFILE_A,
    explorerProfileId: EXPLORER_PROFILE_A,
    relationshipStatus: "active",
    ...overrides,
  };
}

// --- resolveAuthenticatedActor ---

describe("resolveAuthenticatedActor - identity binding", () => {
  const guideIdentity: AuthenticatedIdentity = {
    userAccountId: GUIDE_USER_ID,
    guideProfileId: GUIDE_PROFILE_A,
    explorerProfileId: null,
  };

  function guideSelectors(
    overrides: Partial<AccessSelectors> = {},
  ): AccessSelectors {
    return {
      requestedRole: "guide",
      requestedUserAccountId: GUIDE_USER_ID,
      ...overrides,
    };
  }

  it("resolves an actor when the selector matches the authenticated identity and records are valid", () => {
    const result = resolveAuthenticatedActor({
      identity: guideIdentity,
      selectors: guideSelectors(),
      userAccount: activeAccount(GUIDE_USER_ID),
      roleAssignment: activeAssignment(GUIDE_USER_ID, "guide"),
      session: activeSession(GUIDE_USER_ID, "guide"),
    });

    expect(result).toEqual({
      allowed: true,
      actor: { userAccountId: GUIDE_USER_ID, role: "guide" },
    });
  });

  it("denies when the browser user-account selector names a different account than the authenticated identity, even with internally consistent records for that other account", () => {
    // The browser claims to be OTHER_USER_ID and supplies records that are
    // internally consistent for OTHER_USER_ID. Because the authenticated
    // identity is GUIDE_USER_ID, the selector is rejected before the records
    // are ever trusted. This proves the selector is not authority.
    const result = resolveAuthenticatedActor({
      identity: guideIdentity,
      selectors: guideSelectors({ requestedUserAccountId: OTHER_USER_ID }),
      userAccount: activeAccount(OTHER_USER_ID),
      roleAssignment: activeAssignment(OTHER_USER_ID, "guide"),
      session: activeSession(OTHER_USER_ID, "guide"),
    });

    expect(result).toEqual({
      allowed: false,
      reason: ACCESS_BOUNDARY_DENY_REASONS.SELECTOR_IDENTITY_MISMATCH,
    });
  });

  it("normalizes surrounding whitespace in selectors before binding and delegating", () => {
    const result = resolveAuthenticatedActor({
      identity: guideIdentity,
      selectors: guideSelectors({
        requestedRole: "  guide  ",
        requestedUserAccountId: `  ${GUIDE_USER_ID}  `,
      }),
      userAccount: activeAccount(GUIDE_USER_ID),
      roleAssignment: activeAssignment(GUIDE_USER_ID, "guide"),
      session: activeSession(GUIDE_USER_ID, "guide"),
    });

    expect(result).toEqual({
      allowed: true,
      actor: { userAccountId: GUIDE_USER_ID, role: "guide" },
    });
  });

  it("propagates a role-context denial from the delegated helper (unknown role)", () => {
    const result = resolveAuthenticatedActor({
      identity: guideIdentity,
      selectors: guideSelectors({ requestedRole: "superuser" }),
      userAccount: activeAccount(GUIDE_USER_ID),
      roleAssignment: activeAssignment(GUIDE_USER_ID, "guide"),
      session: activeSession(GUIDE_USER_ID, "guide"),
    });

    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.UNKNOWN_ROLE,
    });
  });

  it("propagates a role-context denial when the session role context does not match", () => {
    const result = resolveAuthenticatedActor({
      identity: guideIdentity,
      selectors: guideSelectors(),
      userAccount: activeAccount(GUIDE_USER_ID),
      roleAssignment: activeAssignment(GUIDE_USER_ID, "guide"),
      session: activeSession(GUIDE_USER_ID, "explorer"),
    });

    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.SESSION_ROLE_CONTEXT_MISMATCH,
    });
  });
});

// --- decideGuideRelationshipAccess ---

describe("decideGuideRelationshipAccess", () => {
  const guideIdentity: AuthenticatedIdentity = {
    userAccountId: GUIDE_USER_ID,
    guideProfileId: GUIDE_PROFILE_A,
    explorerProfileId: null,
  };
  const guideSelectors: AccessSelectors = {
    requestedRole: "guide",
    requestedUserAccountId: GUIDE_USER_ID,
  };

  function guideInput(
    overrides: {
      identity?: AuthenticatedIdentity;
      relationship?: SolMindRelationshipRecord;
      requestedRelationshipId?: string;
    } = {},
  ) {
    return {
      identity: overrides.identity ?? guideIdentity,
      selectors: guideSelectors,
      requestedRelationshipId: overrides.requestedRelationshipId ?? RELATIONSHIP_ID,
      userAccount: activeAccount(GUIDE_USER_ID),
      roleAssignment: activeAssignment(GUIDE_USER_ID, "guide"),
      session: activeSession(GUIDE_USER_ID, "guide"),
      relationship: overrides.relationship ?? activeRelationship(),
    };
  }

  it("allows an authenticated Guide whose server-derived profile owns the active relationship", () => {
    const result = decideGuideRelationshipAccess(guideInput());

    expect(result).toEqual({
      allowed: true,
      actor: { userAccountId: GUIDE_USER_ID, role: "guide" },
    });
  });

  it("denies when the authenticated identity has no server-derived Guide profile", () => {
    const result = decideGuideRelationshipAccess(
      guideInput({
        identity: {
          userAccountId: GUIDE_USER_ID,
          guideProfileId: null,
          explorerProfileId: null,
        },
      }),
    );

    expect(result).toEqual({
      allowed: false,
      reason: ACCESS_BOUNDARY_DENY_REASONS.MISSING_GUIDE_PROFILE,
    });
  });

  it("denies when the relationship belongs to a different Guide profile (server-derived profile wins)", () => {
    const result = decideGuideRelationshipAccess(
      guideInput({
        relationship: activeRelationship({ guideProfileId: GUIDE_PROFILE_B }),
      }),
    );

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.GUIDE_PROFILE_MISMATCH,
    });
  });

  it("denies when the browser relationship selector does not match the loaded record", () => {
    const result = decideGuideRelationshipAccess(
      guideInput({ requestedRelationshipId: OTHER_RELATIONSHIP_ID }),
    );

    expect(result).toEqual({
      allowed: false,
      reason: ACCESS_BOUNDARY_DENY_REASONS.RELATIONSHIP_SELECTOR_MISMATCH,
    });
  });

  it("denies a non-active relationship", () => {
    const result = decideGuideRelationshipAccess(
      guideInput({
        relationship: activeRelationship({ relationshipStatus: "paused" }),
      }),
    );

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE,
    });
  });

  it("propagates an identity-binding denial before any relationship check", () => {
    const result = decideGuideRelationshipAccess({
      identity: guideIdentity,
      selectors: { requestedRole: "guide", requestedUserAccountId: OTHER_USER_ID },
      requestedRelationshipId: RELATIONSHIP_ID,
      userAccount: activeAccount(OTHER_USER_ID),
      roleAssignment: activeAssignment(OTHER_USER_ID, "guide"),
      session: activeSession(OTHER_USER_ID, "guide"),
      relationship: activeRelationship(),
    });

    expect(result).toEqual({
      allowed: false,
      reason: ACCESS_BOUNDARY_DENY_REASONS.SELECTOR_IDENTITY_MISMATCH,
    });
  });
});

// --- decideExplorerRelationshipAccess ---

describe("decideExplorerRelationshipAccess", () => {
  const explorerIdentity: AuthenticatedIdentity = {
    userAccountId: EXPLORER_USER_ID,
    guideProfileId: null,
    explorerProfileId: EXPLORER_PROFILE_A,
  };
  const explorerSelectors: AccessSelectors = {
    requestedRole: "explorer",
    requestedUserAccountId: EXPLORER_USER_ID,
  };

  function explorerInput(
    overrides: {
      identity?: AuthenticatedIdentity;
      relationship?: SolMindRelationshipRecord;
    } = {},
  ) {
    return {
      identity: overrides.identity ?? explorerIdentity,
      selectors: explorerSelectors,
      requestedRelationshipId: RELATIONSHIP_ID,
      userAccount: activeAccount(EXPLORER_USER_ID),
      roleAssignment: activeAssignment(EXPLORER_USER_ID, "explorer"),
      session: activeSession(EXPLORER_USER_ID, "explorer"),
      relationship: overrides.relationship ?? activeRelationship(),
    };
  }

  it("allows an authenticated Explorer whose server-derived profile owns the active relationship", () => {
    const result = decideExplorerRelationshipAccess(explorerInput());

    expect(result).toEqual({
      allowed: true,
      actor: { userAccountId: EXPLORER_USER_ID, role: "explorer" },
    });
  });

  it("denies when the authenticated identity has no server-derived Explorer profile", () => {
    const result = decideExplorerRelationshipAccess(
      explorerInput({
        identity: {
          userAccountId: EXPLORER_USER_ID,
          guideProfileId: null,
          explorerProfileId: null,
        },
      }),
    );

    expect(result).toEqual({
      allowed: false,
      reason: ACCESS_BOUNDARY_DENY_REASONS.MISSING_EXPLORER_PROFILE,
    });
  });

  it("denies when the relationship belongs to a different Explorer profile (server-derived profile wins over the loaded record)", () => {
    const result = decideExplorerRelationshipAccess(
      explorerInput({
        relationship: activeRelationship({
          explorerProfileId: EXPLORER_PROFILE_B,
        }),
      }),
    );

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.EXPLORER_PROFILE_MISMATCH,
    });
  });
});

// --- decideAdminRelationshipQaAccess ---

describe("decideAdminRelationshipQaAccess", () => {
  const adminIdentity: AuthenticatedIdentity = {
    userAccountId: ADMIN_USER_ID,
    guideProfileId: null,
    explorerProfileId: null,
  };
  const adminSelectors: AccessSelectors = {
    requestedRole: "admin",
    requestedUserAccountId: ADMIN_USER_ID,
  };

  function adminInput(
    overrides: { relationship?: SolMindRelationshipRecord } = {},
  ) {
    return {
      identity: adminIdentity,
      selectors: adminSelectors,
      requestedRelationshipId: RELATIONSHIP_ID,
      userAccount: activeAccount(ADMIN_USER_ID),
      roleAssignment: activeAssignment(ADMIN_USER_ID, "admin"),
      session: activeSession(ADMIN_USER_ID, "admin"),
      relationship: overrides.relationship ?? activeRelationship(),
    };
  }

  it("allows an authenticated Admin to access an active relationship for QA without needing a profile id", () => {
    const result = decideAdminRelationshipQaAccess(adminInput());

    expect(result).toEqual({
      allowed: true,
      actor: { userAccountId: ADMIN_USER_ID, role: "admin" },
    });
  });

  it("denies an Admin QA decision for a non-active relationship", () => {
    const result = decideAdminRelationshipQaAccess(
      adminInput({
        relationship: activeRelationship({ relationshipStatus: "ended" }),
      }),
    );

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE,
    });
  });

  it("denies a Guide who tries the Admin QA path while authenticated as a Guide", () => {
    // Authenticated Guide identity and consistent Guide records, routed through
    // the Admin QA decision. The delegated Admin helper rejects the non-Admin
    // actor role.
    const result = decideAdminRelationshipQaAccess({
      identity: {
        userAccountId: GUIDE_USER_ID,
        guideProfileId: GUIDE_PROFILE_A,
        explorerProfileId: null,
      },
      selectors: { requestedRole: "guide", requestedUserAccountId: GUIDE_USER_ID },
      requestedRelationshipId: RELATIONSHIP_ID,
      userAccount: activeAccount(GUIDE_USER_ID),
      roleAssignment: activeAssignment(GUIDE_USER_ID, "guide"),
      session: activeSession(GUIDE_USER_ID, "guide"),
      relationship: activeRelationship(),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.ACTOR_ROLE_MISMATCH,
    });
  });
});
