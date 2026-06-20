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
          userAccountId: GUIDE_USER_ID,
          activeRoleContext: "guide",
          sessionStatus: "expired",
        },
      },
      selectors: { requestedRoute: "/guide" },
    });

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
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
