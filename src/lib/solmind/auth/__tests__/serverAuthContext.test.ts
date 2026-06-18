import { describe, expect, it } from "vitest";

import {
  SERVER_AUTH_CONTEXT_DENY_REASONS,
  deriveTrustedServerAuthContext,
  type DeriveTrustedServerAuthContextInput,
} from "../serverAuthContext";
import { resolveAuthenticatedActor } from "../accessBoundary";

// Stable IDs. The authenticated principal and the DB records are all
// server-established / server-loaded; none of them are browser selectors.
const GUIDE_USER_ID = "user-guide-1";
const EXPLORER_USER_ID = "user-explorer-1";
const ADMIN_USER_ID = "user-admin-1";
const OTHER_USER_ID = "user-other-9";

const GUIDE_PROFILE_A = "guide-profile-a";
const EXPLORER_PROFILE_A = "explorer-profile-a";

const PROVIDER_NAME = "supabase";
const GUIDE_PROVIDER_USER_ID = "auth-user-guide-1";

// A fully-valid Guide derivation input. Individual cases override one field to
// exercise a single denial path at a time.
function validGuideInput(
  overrides: Partial<DeriveTrustedServerAuthContextInput> = {},
): DeriveTrustedServerAuthContextInput {
  return {
    authenticatedUser: {
      providerName: PROVIDER_NAME,
      providerUserId: GUIDE_PROVIDER_USER_ID,
    },
    authProviderIdentity: {
      userAccountId: GUIDE_USER_ID,
      providerName: PROVIDER_NAME,
      providerUserId: GUIDE_PROVIDER_USER_ID,
      status: "active",
    },
    userAccount: { userAccountId: GUIDE_USER_ID, accountStatus: "active" },
    session: {
      userAccountId: GUIDE_USER_ID,
      activeRoleContext: "guide",
      sessionStatus: "active",
    },
    activeRoleAssignment: {
      userAccountId: GUIDE_USER_ID,
      roleCode: "guide",
      roleStatus: "active",
    },
    guideProfile: {
      guideProfileId: GUIDE_PROFILE_A,
      userAccountId: GUIDE_USER_ID,
      status: "active",
    },
    explorerProfile: null,
    ...overrides,
  };
}

describe("deriveTrustedServerAuthContext - allow cases", () => {
  it("derives a trusted Guide context with the server-derived guide profile id", () => {
    const result = deriveTrustedServerAuthContext(validGuideInput());

    expect(result).toEqual({
      allowed: true,
      context: {
        activeRole: "guide",
        identity: {
          userAccountId: GUIDE_USER_ID,
          guideProfileId: GUIDE_PROFILE_A,
          explorerProfileId: null,
        },
      },
    });
  });

  it("derives a trusted Explorer context with the server-derived explorer profile id", () => {
    const result = deriveTrustedServerAuthContext({
      authenticatedUser: {
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-explorer-1",
      },
      authProviderIdentity: {
        userAccountId: EXPLORER_USER_ID,
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-explorer-1",
        status: "active",
      },
      userAccount: { userAccountId: EXPLORER_USER_ID, accountStatus: "active" },
      session: {
        userAccountId: EXPLORER_USER_ID,
        activeRoleContext: "explorer",
        sessionStatus: "active",
      },
      activeRoleAssignment: {
        userAccountId: EXPLORER_USER_ID,
        roleCode: "explorer",
        roleStatus: "active",
      },
      guideProfile: null,
      explorerProfile: {
        explorerProfileId: EXPLORER_PROFILE_A,
        userAccountId: EXPLORER_USER_ID,
        status: "active",
      },
    });

    expect(result).toEqual({
      allowed: true,
      context: {
        activeRole: "explorer",
        identity: {
          userAccountId: EXPLORER_USER_ID,
          guideProfileId: null,
          explorerProfileId: EXPLORER_PROFILE_A,
        },
      },
    });
  });

  it("derives a trusted Admin context with no profile ids", () => {
    const result = deriveTrustedServerAuthContext({
      authenticatedUser: {
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-admin-1",
      },
      authProviderIdentity: {
        userAccountId: ADMIN_USER_ID,
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-admin-1",
        status: "active",
      },
      userAccount: { userAccountId: ADMIN_USER_ID, accountStatus: "active" },
      session: {
        userAccountId: ADMIN_USER_ID,
        activeRoleContext: "admin",
        sessionStatus: "active",
      },
      activeRoleAssignment: {
        userAccountId: ADMIN_USER_ID,
        roleCode: "admin",
        roleStatus: "active",
      },
      guideProfile: null,
      explorerProfile: null,
    });

    expect(result).toEqual({
      allowed: true,
      context: {
        activeRole: "admin",
        identity: {
          userAccountId: ADMIN_USER_ID,
          guideProfileId: null,
          explorerProfileId: null,
        },
      },
    });
  });

  it("excludes an inactive profile id rather than failing the whole derivation", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        guideProfile: {
          guideProfileId: GUIDE_PROFILE_A,
          userAccountId: GUIDE_USER_ID,
          status: "deleted",
        },
      }),
    );

    expect(result).toEqual({
      allowed: true,
      context: {
        activeRole: "guide",
        identity: {
          userAccountId: GUIDE_USER_ID,
          guideProfileId: null,
          explorerProfileId: null,
        },
      },
    });
  });
});

describe("deriveTrustedServerAuthContext - authentication denials", () => {
  it("denies a missing authenticated user", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({ authenticatedUser: null }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_AUTHENTICATED_USER,
    });
  });

  it("denies a missing provider identity record", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({ authProviderIdentity: null }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_PROVIDER_IDENTITY,
    });
  });

  it("denies when the Supabase authenticated principal does not match the loaded provider identity", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        authenticatedUser: {
          providerName: PROVIDER_NAME,
          providerUserId: "auth-user-someone-else",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.PROVIDER_IDENTITY_USER_MISMATCH,
    });
  });

  it("denies a non-active provider identity", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        authProviderIdentity: {
          userAccountId: GUIDE_USER_ID,
          providerName: PROVIDER_NAME,
          providerUserId: GUIDE_PROVIDER_USER_ID,
          status: "disabled",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.PROVIDER_IDENTITY_NOT_ACTIVE,
    });
  });
});

describe("deriveTrustedServerAuthContext - account denials", () => {
  it("denies a missing user account", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({ userAccount: null }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_USER_ACCOUNT,
    });
  });

  it("denies when the provider identity links to a different user account than the loaded account", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        userAccount: { userAccountId: OTHER_USER_ID, accountStatus: "active" },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.USER_ACCOUNT_LINK_MISMATCH,
    });
  });

  it("denies an inactive (suspended) user account", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        userAccount: { userAccountId: GUIDE_USER_ID, accountStatus: "suspended" },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.USER_ACCOUNT_NOT_ACTIVE,
    });
  });
});

describe("deriveTrustedServerAuthContext - session denials", () => {
  it("denies a missing session", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({ session: null }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_SESSION,
    });
  });

  it("denies a session belonging to another user", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        session: {
          userAccountId: OTHER_USER_ID,
          activeRoleContext: "guide",
          sessionStatus: "active",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.SESSION_USER_MISMATCH,
    });
  });

  it("denies a non-active session", () => {
    const result = deriveTrustedServerAuthContext(
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
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.SESSION_NOT_ACTIVE,
    });
  });

  it("denies an unknown active role context by default", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        session: {
          userAccountId: GUIDE_USER_ID,
          activeRoleContext: "superuser",
          sessionStatus: "active",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.UNKNOWN_ACTIVE_ROLE,
    });
  });
});

describe("deriveTrustedServerAuthContext - role assignment denials", () => {
  it("denies a missing active role assignment", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({ activeRoleAssignment: null }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_ROLE_ASSIGNMENT,
    });
  });

  it("denies a role assignment belonging to another user", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        activeRoleAssignment: {
          userAccountId: OTHER_USER_ID,
          roleCode: "guide",
          roleStatus: "active",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.ROLE_ASSIGNMENT_USER_MISMATCH,
    });
  });

  it("denies a role assignment whose role does not match the session active role context", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        activeRoleAssignment: {
          userAccountId: GUIDE_USER_ID,
          roleCode: "explorer",
          roleStatus: "active",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.ROLE_ASSIGNMENT_ROLE_MISMATCH,
    });
  });

  it("denies a non-active role assignment", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        activeRoleAssignment: {
          userAccountId: GUIDE_USER_ID,
          roleCode: "guide",
          roleStatus: "revoked",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.ROLE_ASSIGNMENT_NOT_ACTIVE,
    });
  });
});

describe("deriveTrustedServerAuthContext - profile link denials", () => {
  it("denies when a guide profile record loaded for the wrong account is passed in", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        guideProfile: {
          guideProfileId: GUIDE_PROFILE_A,
          userAccountId: OTHER_USER_ID,
          status: "active",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.GUIDE_PROFILE_LINK_MISMATCH,
    });
  });

  it("denies when an explorer profile record loaded for the wrong account is passed in", () => {
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        explorerProfile: {
          explorerProfileId: EXPLORER_PROFILE_A,
          userAccountId: OTHER_USER_ID,
          status: "active",
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.EXPLORER_PROFILE_LINK_MISMATCH,
    });
  });
});

describe("trusted context derivation uses only server inputs, not browser selectors", () => {
  it("derives the active role from the session record, regardless of any role a client might claim", () => {
    // The derivation input has no requested-role/requested-id/requested-profile
    // selector field at all. The active role is whatever the server-loaded
    // session record says, here 'guide'. There is no client-supplied path that
    // could change this outcome.
    const result = deriveTrustedServerAuthContext(validGuideInput());
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.context.activeRole).toBe("guide");
    }
  });
});

describe("derived trusted context integrates with accessBoundary", () => {
  it("produces an identity that accessBoundary accepts when paired with server selectors and matching records", () => {
    const derived = deriveTrustedServerAuthContext(validGuideInput());
    expect(derived.allowed).toBe(true);
    if (!derived.allowed) {
      return;
    }

    // Server-built selectors are derived from the trusted context itself, never
    // from the browser. accessBoundary still independently re-checks them.
    const actorResult = resolveAuthenticatedActor({
      identity: derived.context.identity,
      selectors: {
        requestedRole: derived.context.activeRole,
        requestedUserAccountId: derived.context.identity.userAccountId,
      },
      userAccount: { userAccountId: GUIDE_USER_ID, accountStatus: "active" },
      roleAssignment: {
        userAccountId: GUIDE_USER_ID,
        roleCode: "guide",
        roleStatus: "active",
      },
      session: {
        userAccountId: GUIDE_USER_ID,
        activeRoleContext: "guide",
        sessionStatus: "active",
      },
    });

    expect(actorResult).toEqual({
      allowed: true,
      actor: { userAccountId: GUIDE_USER_ID, role: "guide" },
    });
  });
});
