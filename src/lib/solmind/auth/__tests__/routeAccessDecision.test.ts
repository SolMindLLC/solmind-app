import { describe, expect, it } from "vitest";

import {
  ROUTE_ACCESS_DENY_REASON,
  authorizeRouteAccess,
} from "../routeAccessDecision";
import type { DeriveTrustedServerAuthContextInput } from "../serverAuthContext";

// Stable IDs. Every record below is server-loaded; none of them are selectors.
const ADMIN_USER_ID = "user-admin-1";
const GUIDE_USER_ID = "user-guide-1";
const EXPLORER_USER_ID = "user-explorer-1";

const GUIDE_PROFILE_A = "guide-profile-a";
const EXPLORER_PROFILE_A = "explorer-profile-a";

const PROVIDER_NAME = "supabase";

// Login step 6, sub-slice S6-4: the selected session's UUID, which the request
// presents in its binding cookie, and its expiry.
const SESSION_ID = "5e5510a0-0000-4000-8000-000000000f01";
const SESSION_EXPIRES_AT = "2999-12-31T23:59:59+00:00";
const SESSION_BINDING = { userSessionId: SESSION_ID, expiresAt: SESSION_EXPIRES_AT };

// Build a fully-valid trusted-context input for a given canonical role. The
// active role is carried by the server-loaded session record, exactly as in
// serverAuthContext.test.ts.
function validServerAuthContextInput(
  role: "admin" | "guide" | "explorer",
): DeriveTrustedServerAuthContextInput {
  const userAccountId =
    role === "admin"
      ? ADMIN_USER_ID
      : role === "guide"
        ? GUIDE_USER_ID
        : EXPLORER_USER_ID;
  const providerUserId = `auth-user-${role}-1`;

  return {
    authenticatedUser: {
      providerName: PROVIDER_NAME,
      providerUserId,
      presentedSessionId: SESSION_ID,
    },
    authProviderIdentity: {
      userAccountId,
      providerName: PROVIDER_NAME,
      providerUserId,
      status: "active",
    },
    userAccount: { userAccountId, accountStatus: "active" },
    session: {
      userSessionId: SESSION_ID,
      userAccountId,
      activeRoleContext: role,
      sessionStatus: "active",
      expiresAt: SESSION_EXPIRES_AT,
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

describe("authorizeRouteAccess - allow cases", () => {
  it("allows admin to access /admin when the server-derived active role is admin", () => {
    const result = authorizeRouteAccess({
      serverAuthContext: validServerAuthContextInput("admin"),
      selectors: { requestedRoute: "/admin" },
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
        session: SESSION_BINDING,
      },
    });
  });

  it("allows guide to access /guide when the server-derived active role is guide", () => {
    const result = authorizeRouteAccess({
      serverAuthContext: validServerAuthContextInput("guide"),
      selectors: { requestedRoute: "/guide" },
    });

    expect(result).toEqual({
      allowed: true,
      context: {
        activeRole: "guide",
        identity: {
          userAccountId: GUIDE_USER_ID,
          guideProfileId: GUIDE_PROFILE_A,
          explorerProfileId: null,
        },
        session: SESSION_BINDING,
      },
    });
  });

  it("allows explorer to access /explorer when the server-derived active role is explorer", () => {
    const result = authorizeRouteAccess({
      serverAuthContext: validServerAuthContextInput("explorer"),
      selectors: { requestedRoute: "/explorer" },
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
        session: SESSION_BINDING,
      },
    });
  });
});

describe("authorizeRouteAccess - role/route mismatch denials", () => {
  it("denies a guide trying to access /admin", () => {
    const result = authorizeRouteAccess({
      serverAuthContext: validServerAuthContextInput("guide"),
      selectors: { requestedRoute: "/admin" },
    });

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
  });

  it("denies an explorer trying to access /guide", () => {
    const result = authorizeRouteAccess({
      serverAuthContext: validServerAuthContextInput("explorer"),
      selectors: { requestedRoute: "/guide" },
    });

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
  });

  it("denies an unknown/unregistered route", () => {
    const result = authorizeRouteAccess({
      serverAuthContext: validServerAuthContextInput("admin"),
      selectors: { requestedRoute: "/unregistered" },
    });

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
  });
});

describe("authorizeRouteAccess - trusted context derivation failure", () => {
  it("denies when trusted server context derivation fails (missing authenticated user)", () => {
    const input = validServerAuthContextInput("admin");
    const result = authorizeRouteAccess({
      serverAuthContext: { ...input, authenticatedUser: null },
      selectors: { requestedRoute: "/admin" },
    });

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
  });

  it("denies when the session is not active even though the route would match the role", () => {
    const input = validServerAuthContextInput("guide");
    const result = authorizeRouteAccess({
      serverAuthContext: {
        ...input,
        session: {
          userSessionId: SESSION_ID,
          userAccountId: GUIDE_USER_ID,
          activeRoleContext: "guide",
          sessionStatus: "expired",
          expiresAt: SESSION_EXPIRES_AT,
        },
      },
      selectors: { requestedRoute: "/guide" },
    });

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
  });

  it("PRQ-501 denies with the same generic reason when the request presents no session or another session's UUID, on a route its role would match", () => {
    // Login step 6, sub-slice S6-4: the session binding is part of derivation,
    // so every route decision made through this helper requires it.
    const input = validServerAuthContextInput("guide");
    const principal = input.authenticatedUser;
    expect(principal).not.toBeNull();
    if (principal === null) {
      return;
    }
    for (const presentedSessionId of [null, "5e5510a0-0000-4000-8000-000000000f02"]) {
      const result = authorizeRouteAccess({
        serverAuthContext: {
          ...input,
          authenticatedUser: { ...principal, presentedSessionId },
        },
        selectors: { requestedRoute: "/guide" },
      });

      expect(result).toEqual({
        allowed: false,
        reason: ROUTE_ACCESS_DENY_REASON,
      });
      expect(Object.keys(result).sort()).toEqual(["allowed", "reason"]);
    }
  });
});

describe("authorizeRouteAccess - requestedRole is a selector, not authority", () => {
  it("denies when requestedRole claims admin but the server-derived active role is explorer", () => {
    const result = authorizeRouteAccess({
      serverAuthContext: validServerAuthContextInput("explorer"),
      selectors: { requestedRoute: "/admin", requestedRole: "admin" },
    });

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
  });

  it("ignores a requestedRole that disagrees with the active role on an otherwise-allowed route", () => {
    // The server-derived active role is guide and the route is /guide, so access
    // is allowed. The bogus requestedRole 'admin' has no effect either way: it is
    // never consulted.
    const result = authorizeRouteAccess({
      serverAuthContext: validServerAuthContextInput("guide"),
      selectors: { requestedRoute: "/guide", requestedRole: "admin" },
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.context.activeRole).toBe("guide");
    }
  });
});

describe("authorizeRouteAccess - denial output does not leak detail", () => {
  it("exposes only the generic outward reason and no record-specific failure detail", () => {
    // Force an internal derivation failure that carries a specific internal
    // reason (user account link mismatch). The outward result must reveal only
    // the generic route-access denial, with no internal reason key.
    const input = validServerAuthContextInput("admin");
    const result = authorizeRouteAccess({
      serverAuthContext: {
        ...input,
        userAccount: { userAccountId: "user-someone-else", accountStatus: "active" },
      },
      selectors: { requestedRoute: "/admin" },
    });

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
    // No extra keys beyond allowed + reason, and the reason is the generic code.
    expect(Object.keys(result).sort()).toEqual(["allowed", "reason"]);
    if (!result.allowed) {
      expect(result.reason).toBe("route_access_denied");
    }
  });
});
