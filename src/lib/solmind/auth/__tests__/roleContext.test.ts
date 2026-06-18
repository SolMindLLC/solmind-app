import { describe, expect, it } from "vitest";

import {
  ACTOR_DENY_REASONS,
  isSolMindRole,
  resolveActorContext,
  type ResolveActorContextInput,
  type SolMindRoleAssignmentRecord,
  type SolMindSessionRecord,
  type SolMindUserAccountRecord,
} from "../roleContext";

// Stable IDs used across the cases. These stand in for server-fetched records.
const GUIDE_USER_ID = "user-guide-1";
const EXPLORER_USER_ID = "user-explorer-1";
const ADMIN_USER_ID = "user-admin-1";
const OTHER_USER_ID = "user-other-9";

function activeAccount(
  userAccountId: string,
): SolMindUserAccountRecord {
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

// A fully-valid Guide resolution input. Individual cases override one field to
// exercise a single denial path at a time.
function validGuideInput(
  overrides: Partial<ResolveActorContextInput> = {},
): ResolveActorContextInput {
  return {
    requestedRole: "guide",
    requestedUserAccountId: GUIDE_USER_ID,
    userAccount: activeAccount(GUIDE_USER_ID),
    roleAssignment: activeAssignment(GUIDE_USER_ID, "guide"),
    session: activeSession(GUIDE_USER_ID, "guide"),
    ...overrides,
  };
}

describe("resolveActorContext - allow cases", () => {
  it("resolves an active Guide with active assignment and matching active session", () => {
    const result = resolveActorContext(validGuideInput());

    expect(result).toEqual({
      allowed: true,
      actor: { userAccountId: GUIDE_USER_ID, role: "guide" },
    });
  });

  it("resolves an active Explorer with active assignment and matching active session", () => {
    const result = resolveActorContext({
      requestedRole: "explorer",
      requestedUserAccountId: EXPLORER_USER_ID,
      userAccount: activeAccount(EXPLORER_USER_ID),
      roleAssignment: activeAssignment(EXPLORER_USER_ID, "explorer"),
      session: activeSession(EXPLORER_USER_ID, "explorer"),
    });

    expect(result).toEqual({
      allowed: true,
      actor: { userAccountId: EXPLORER_USER_ID, role: "explorer" },
    });
  });

  it("resolves an active Admin as an Admin actor context", () => {
    const result = resolveActorContext({
      requestedRole: "admin",
      requestedUserAccountId: ADMIN_USER_ID,
      userAccount: activeAccount(ADMIN_USER_ID),
      roleAssignment: activeAssignment(ADMIN_USER_ID, "admin"),
      session: activeSession(ADMIN_USER_ID, "admin"),
    });

    expect(result).toEqual({
      allowed: true,
      actor: { userAccountId: ADMIN_USER_ID, role: "admin" },
    });
  });
});

describe("resolveActorContext - role denials", () => {
  it("denies an unknown requested role", () => {
    const result = resolveActorContext(
      validGuideInput({ requestedRole: "superuser" }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.UNKNOWN_ROLE,
    });
  });

  it("denies an empty requested role", () => {
    const result = resolveActorContext(validGuideInput({ requestedRole: "" }));
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.UNKNOWN_ROLE,
    });
  });

  it("denies a deprecated generic role term such as client", () => {
    const result = resolveActorContext(
      validGuideInput({ requestedRole: "client" }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.UNKNOWN_ROLE,
    });
  });
});

describe("resolveActorContext - account denials", () => {
  it("denies a missing user account", () => {
    const result = resolveActorContext(validGuideInput({ userAccount: null }));
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.MISSING_USER_ACCOUNT,
    });
  });

  it("denies when the fetched account does not match the requested user id", () => {
    const result = resolveActorContext(
      validGuideInput({ userAccount: activeAccount(OTHER_USER_ID) }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.USER_ACCOUNT_ID_MISMATCH,
    });
  });

  it("denies an inactive (suspended) user account", () => {
    const result = resolveActorContext(
      validGuideInput({
        userAccount: { userAccountId: GUIDE_USER_ID, accountStatus: "suspended" },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.USER_ACCOUNT_NOT_ACTIVE,
    });
  });
});

describe("resolveActorContext - role assignment denials", () => {
  it("denies a missing active role assignment", () => {
    const result = resolveActorContext(validGuideInput({ roleAssignment: null }));
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.MISSING_ROLE_ASSIGNMENT,
    });
  });

  it("denies a pending role assignment", () => {
    const result = resolveActorContext(
      validGuideInput({
        roleAssignment: {
          userAccountId: GUIDE_USER_ID,
          roleCode: "guide",
          roleStatus: "pending",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.ROLE_ASSIGNMENT_NOT_ACTIVE,
    });
  });

  it("denies a suspended role assignment", () => {
    const result = resolveActorContext(
      validGuideInput({
        roleAssignment: {
          userAccountId: GUIDE_USER_ID,
          roleCode: "guide",
          roleStatus: "suspended",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.ROLE_ASSIGNMENT_NOT_ACTIVE,
    });
  });

  it("denies a revoked role assignment", () => {
    const result = resolveActorContext(
      validGuideInput({
        roleAssignment: {
          userAccountId: GUIDE_USER_ID,
          roleCode: "guide",
          roleStatus: "revoked",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.ROLE_ASSIGNMENT_NOT_ACTIVE,
    });
  });

  it("denies an active role assignment for a different role", () => {
    // Active assignment exists, but it grants explorer while guide is requested.
    const result = resolveActorContext(
      validGuideInput({
        roleAssignment: activeAssignment(GUIDE_USER_ID, "explorer"),
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.ROLE_ASSIGNMENT_ROLE_MISMATCH,
    });
  });

  it("denies a role assignment belonging to another user", () => {
    const result = resolveActorContext(
      validGuideInput({
        roleAssignment: activeAssignment(OTHER_USER_ID, "guide"),
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.ROLE_ASSIGNMENT_USER_MISMATCH,
    });
  });
});

describe("resolveActorContext - session denials", () => {
  it("denies a missing session", () => {
    const result = resolveActorContext(validGuideInput({ session: null }));
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.MISSING_SESSION,
    });
  });

  it("denies a session belonging to another user", () => {
    const result = resolveActorContext(
      validGuideInput({ session: activeSession(OTHER_USER_ID, "guide") }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.SESSION_USER_MISMATCH,
    });
  });

  it("denies a session with a different active_role_context", () => {
    const result = resolveActorContext(
      validGuideInput({ session: activeSession(GUIDE_USER_ID, "explorer") }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.SESSION_ROLE_CONTEXT_MISMATCH,
    });
  });

  it("denies an expired session", () => {
    const result = resolveActorContext(
      validGuideInput({
        session: {
          userAccountId: GUIDE_USER_ID,
          activeRoleContext: "guide",
          sessionStatus: "expired",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.SESSION_NOT_ACTIVE,
    });
  });

  it("denies a revoked session", () => {
    const result = resolveActorContext(
      validGuideInput({
        session: {
          userAccountId: GUIDE_USER_ID,
          activeRoleContext: "guide",
          sessionStatus: "revoked",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.SESSION_NOT_ACTIVE,
    });
  });

  it("denies a logged_out session", () => {
    const result = resolveActorContext(
      validGuideInput({
        session: {
          userAccountId: GUIDE_USER_ID,
          activeRoleContext: "guide",
          sessionStatus: "logged_out",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: ACTOR_DENY_REASONS.SESSION_NOT_ACTIVE,
    });
  });

  it("denies a superseded/inactive (unknown) session status by default", () => {
    for (const sessionStatus of ["superseded", "inactive", "stale", ""]) {
      const result = resolveActorContext(
        validGuideInput({
          session: {
            userAccountId: GUIDE_USER_ID,
            activeRoleContext: "guide",
            sessionStatus,
          },
        }),
      );
      expect(result).toEqual({
        allowed: false,
        reason: ACTOR_DENY_REASONS.SESSION_NOT_ACTIVE,
      });
    }
  });
});

describe("isSolMindRole", () => {
  it("recognizes only the canonical SolMind roles", () => {
    expect(isSolMindRole("admin")).toBe(true);
    expect(isSolMindRole("guide")).toBe(true);
    expect(isSolMindRole("explorer")).toBe(true);

    expect(isSolMindRole("client")).toBe(false);
    expect(isSolMindRole("Guide")).toBe(false);
    expect(isSolMindRole("")).toBe(false);
  });
});
