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

// Synthetic session UUIDs and an expiry. SELECTED_SESSION_ID is the UUID of the
// session the server selected for the account; a request is allowed only when
// it presented that very UUID (login step 6, sub-slice S6-4).
const SELECTED_SESSION_ID = "5e5510a0-0000-4000-8000-000000000001";
const SUPERSEDED_SESSION_ID = "5e5510a0-0000-4000-8000-000000000002";
const SESSION_EXPIRES_AT = "2999-12-31T23:59:59+00:00";

// A fully-valid Guide derivation input. Individual cases override one field to
// exercise a single denial path at a time.
function validGuideInput(
  overrides: Partial<DeriveTrustedServerAuthContextInput> = {},
): DeriveTrustedServerAuthContextInput {
  return {
    authenticatedUser: {
      providerName: PROVIDER_NAME,
      providerUserId: GUIDE_PROVIDER_USER_ID,
      presentedSessionId: SELECTED_SESSION_ID,
    },
    authProviderIdentity: {
      userAccountId: GUIDE_USER_ID,
      providerName: PROVIDER_NAME,
      providerUserId: GUIDE_PROVIDER_USER_ID,
      status: "active",
    },
    userAccount: { userAccountId: GUIDE_USER_ID, accountStatus: "active" },
    session: {
      userSessionId: SELECTED_SESSION_ID,
      userAccountId: GUIDE_USER_ID,
      activeRoleContext: "guide",
      sessionStatus: "active",
      expiresAt: SESSION_EXPIRES_AT,
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
        session: {
          userSessionId: SELECTED_SESSION_ID,
          expiresAt: SESSION_EXPIRES_AT,
        },
      },
    });
  });

  it("derives a trusted Explorer context with the server-derived explorer profile id", () => {
    const result = deriveTrustedServerAuthContext({
      authenticatedUser: {
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-explorer-1",
        presentedSessionId: SELECTED_SESSION_ID,
      },
      authProviderIdentity: {
        userAccountId: EXPLORER_USER_ID,
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-explorer-1",
        status: "active",
      },
      userAccount: { userAccountId: EXPLORER_USER_ID, accountStatus: "active" },
      session: {
        userSessionId: SELECTED_SESSION_ID,
        userAccountId: EXPLORER_USER_ID,
        activeRoleContext: "explorer",
        sessionStatus: "active",
        expiresAt: SESSION_EXPIRES_AT,
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
        session: {
          userSessionId: SELECTED_SESSION_ID,
          expiresAt: SESSION_EXPIRES_AT,
        },
      },
    });
  });

  it("derives a trusted Admin context with no profile ids", () => {
    const result = deriveTrustedServerAuthContext({
      authenticatedUser: {
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-admin-1",
        presentedSessionId: SELECTED_SESSION_ID,
      },
      authProviderIdentity: {
        userAccountId: ADMIN_USER_ID,
        providerName: PROVIDER_NAME,
        providerUserId: "auth-user-admin-1",
        status: "active",
      },
      userAccount: { userAccountId: ADMIN_USER_ID, accountStatus: "active" },
      session: {
        userSessionId: SELECTED_SESSION_ID,
        userAccountId: ADMIN_USER_ID,
        activeRoleContext: "admin",
        sessionStatus: "active",
        expiresAt: SESSION_EXPIRES_AT,
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
        session: {
          userSessionId: SELECTED_SESSION_ID,
          expiresAt: SESSION_EXPIRES_AT,
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
        session: {
          userSessionId: SELECTED_SESSION_ID,
          expiresAt: SESSION_EXPIRES_AT,
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
          presentedSessionId: SELECTED_SESSION_ID,
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
          userSessionId: SELECTED_SESSION_ID,
          userAccountId: OTHER_USER_ID,
          activeRoleContext: "guide",
          sessionStatus: "active",
          expiresAt: SESSION_EXPIRES_AT,
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
          userSessionId: SELECTED_SESSION_ID,
          userAccountId: GUIDE_USER_ID,
          activeRoleContext: "guide",
          sessionStatus: "expired",
          expiresAt: SESSION_EXPIRES_AT,
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
          userSessionId: SELECTED_SESSION_ID,
          userAccountId: GUIDE_USER_ID,
          activeRoleContext: "superuser",
          sessionStatus: "active",
          expiresAt: SESSION_EXPIRES_AT,
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

// Login step 6, sub-slice S6-4: the session binding of contract 25 Section 8
// (its Section 15 item 7). The request is allowed only when it presented the
// UUID of the very session the lookup selected.
describe("deriveTrustedServerAuthContext - the session binding (contract 25 Section 8; item 7)", () => {
  function guideInputPresenting(
    presentedSessionId: string | null,
    overrides: Partial<DeriveTrustedServerAuthContextInput> = {},
  ): DeriveTrustedServerAuthContextInput {
    return validGuideInput({
      authenticatedUser: {
        providerName: PROVIDER_NAME,
        providerUserId: GUIDE_PROVIDER_USER_ID,
        presentedSessionId,
      },
      ...overrides,
    });
  }

  it("PRD-001 carries the selected session's UUID and expires_at to the allow result, unchanged", () => {
    const expiresAt = "2026-10-06T17:58:00.123456+00:00";
    const result = deriveTrustedServerAuthContext(
      validGuideInput({
        session: {
          userSessionId: SELECTED_SESSION_ID,
          userAccountId: GUIDE_USER_ID,
          activeRoleContext: "guide",
          sessionStatus: "active",
          expiresAt,
        },
      }),
    );
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.context.session).toEqual({
        userSessionId: SELECTED_SESSION_ID,
        expiresAt,
      });
      expect(Object.keys(result.context).sort()).toEqual(["activeRole", "identity", "session"]);
    }
  });

  it("PRD-002 denies a Supabase session alone: the request presented no session", () => {
    expect(deriveTrustedServerAuthContext(guideInputPresenting(null))).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_PRESENTED_SESSION,
    });
  });

  it("PRD-003 denies a superseded session in the same role: the browser presents the older UUID", () => {
    // A newer login of the same account, in the same role, made the selected
    // session; the stale browser still presents the one it was given. By
    // account alone this request would be allowed.
    expect(
      deriveTrustedServerAuthContext(guideInputPresenting(SUPERSEDED_SESSION_ID)),
    ).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.PRESENTED_SESSION_MISMATCH,
    });
  });

  it("PRD-004 denies a superseded session in a different role (the stale tab), which account selection alone would allow in the new role", () => {
    // The account logged in again as an Explorer, so its selected session is
    // the Explorer one. The stale Guide tab presents the Guide session's UUID.
    const explorerRecords: Partial<DeriveTrustedServerAuthContextInput> = {
      session: {
        userSessionId: SELECTED_SESSION_ID,
        userAccountId: GUIDE_USER_ID,
        activeRoleContext: "explorer",
        sessionStatus: "active",
        expiresAt: SESSION_EXPIRES_AT,
      },
      activeRoleAssignment: {
        userAccountId: GUIDE_USER_ID,
        roleCode: "explorer",
        roleStatus: "active",
      },
      guideProfile: null,
      explorerProfile: {
        explorerProfileId: EXPLORER_PROFILE_A,
        userAccountId: GUIDE_USER_ID,
        status: "active",
      },
    };
    expect(
      deriveTrustedServerAuthContext(
        guideInputPresenting(SUPERSEDED_SESSION_ID, explorerRecords),
      ),
    ).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.PRESENTED_SESSION_MISMATCH,
    });

    // The same records with the newer session's own UUID are allowed, as an
    // Explorer: only the presented UUID separates the two requests.
    const current = deriveTrustedServerAuthContext(
      guideInputPresenting(SELECTED_SESSION_ID, explorerRecords),
    );
    expect(current.allowed).toBe(true);
    if (current.allowed) {
      expect(current.context.activeRole).toBe("explorer");
    }
  });

  it("PRD-005 compares exactly: no trimming, no case folding, no prefix, never an empty value, and never a session record without a UUID", () => {
    for (const presented of [
      SELECTED_SESSION_ID.toUpperCase(),
      ` ${SELECTED_SESSION_ID}`,
      `${SELECTED_SESSION_ID} `,
      `${SELECTED_SESSION_ID}\n`,
      SELECTED_SESSION_ID.slice(0, -1),
      `${SELECTED_SESSION_ID}0`,
      "00000000-0000-0000-0000-000000000000",
    ]) {
      expect(deriveTrustedServerAuthContext(guideInputPresenting(presented))).toEqual({
        allowed: false,
        reason: SERVER_AUTH_CONTEXT_DENY_REASONS.PRESENTED_SESSION_MISMATCH,
      });
    }
    // An empty presented value never matches, even a session record whose
    // UUID is empty too.
    expect(
      deriveTrustedServerAuthContext(
        guideInputPresenting("", {
          session: {
            userSessionId: "",
            userAccountId: GUIDE_USER_ID,
            activeRoleContext: "guide",
            sessionStatus: "active",
            expiresAt: SESSION_EXPIRES_AT,
          },
        }),
      ),
    ).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_PRESENTED_SESSION,
    });
    // A session record without a usable UUID can never be allowed, whatever
    // the request presents: the UUID absent, null, or not a string. The types
    // forbid such a record; the casts stand for a loader that breaks them.
    for (const brokenUserSessionId of [undefined, null, 5]) {
      const session = {
        userAccountId: GUIDE_USER_ID,
        activeRoleContext: "guide",
        sessionStatus: "active",
        expiresAt: SESSION_EXPIRES_AT,
        ...(brokenUserSessionId === undefined ? {} : { userSessionId: brokenUserSessionId }),
      } as unknown as DeriveTrustedServerAuthContextInput["session"];
      expect(
        deriveTrustedServerAuthContext(guideInputPresenting(SELECTED_SESSION_ID, { session })),
      ).toEqual({
        allowed: false,
        reason: SERVER_AUTH_CONTEXT_DENY_REASONS.PRESENTED_SESSION_MISMATCH,
      });
    }
  });

  it("PRD-006 the UUID grants nothing on its own: every earlier check still denies a request that presents the right UUID", () => {
    const cases: Array<[Partial<DeriveTrustedServerAuthContextInput>, string]> = [
      [{ authenticatedUser: null }, SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_AUTHENTICATED_USER],
      [{ authProviderIdentity: null }, SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_PROVIDER_IDENTITY],
      [
        {
          authProviderIdentity: {
            userAccountId: GUIDE_USER_ID,
            providerName: PROVIDER_NAME,
            providerUserId: "auth-user-someone-else",
            status: "active",
          },
        },
        SERVER_AUTH_CONTEXT_DENY_REASONS.PROVIDER_IDENTITY_USER_MISMATCH,
      ],
      [
        { userAccount: { userAccountId: GUIDE_USER_ID, accountStatus: "suspended" } },
        SERVER_AUTH_CONTEXT_DENY_REASONS.USER_ACCOUNT_NOT_ACTIVE,
      ],
      [{ session: null }, SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_SESSION],
      [
        {
          // Another account's session, whose UUID the request presents.
          session: {
            userSessionId: SELECTED_SESSION_ID,
            userAccountId: OTHER_USER_ID,
            activeRoleContext: "guide",
            sessionStatus: "active",
            expiresAt: SESSION_EXPIRES_AT,
          },
        },
        SERVER_AUTH_CONTEXT_DENY_REASONS.SESSION_USER_MISMATCH,
      ],
      [
        {
          session: {
            userSessionId: SELECTED_SESSION_ID,
            userAccountId: GUIDE_USER_ID,
            activeRoleContext: "guide",
            sessionStatus: "revoked",
            expiresAt: SESSION_EXPIRES_AT,
          },
        },
        SERVER_AUTH_CONTEXT_DENY_REASONS.SESSION_NOT_ACTIVE,
      ],
    ];
    for (const [overrides, reason] of cases) {
      expect(deriveTrustedServerAuthContext(validGuideInput(overrides))).toEqual({
        allowed: false,
        reason,
      });
    }
  });

  it("PRD-007 a matching UUID does not replace the later checks either", () => {
    expect(
      deriveTrustedServerAuthContext(validGuideInput({ activeRoleAssignment: null })),
    ).toEqual({
      allowed: false,
      reason: SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_ROLE_ASSIGNMENT,
    });
  });

  it("PRD-008 a binding denial is value-free: it carries only its fixed reason", () => {
    for (const presented of [null, SUPERSEDED_SESSION_ID]) {
      const result = deriveTrustedServerAuthContext(guideInputPresenting(presented));
      expect(result.allowed).toBe(false);
      expect(Object.keys(result).sort()).toEqual(["allowed", "reason"]);
      const text = JSON.stringify(result);
      expect(text).not.toContain(SELECTED_SESSION_ID);
      expect(text).not.toContain(SUPERSEDED_SESSION_ID);
    }
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
