import { describe, expect, it, vi } from "vitest";

import {
  composeRequestAuthContext,
  type ServiceRoleReadAuditEvent,
} from "../composeRequestAuthContext";
import {
  createInMemoryRequestAuthPrincipalSource,
  type SolMindRequestAuthPrincipalSource,
} from "../requestAuthPrincipalSource";
import {
  createInMemoryAuthSource,
  type SolMindAuthSource,
} from "../authSource";
import { ROUTE_ACCESS_DENY_REASON } from "../routeAccessDecision";
import {
  type DeriveTrustedServerAuthContextInput,
  type SupabaseAuthenticatedUser,
} from "../serverAuthContext";
import * as authBarrel from "../index";

// Stable IDs. Every record below is a server-loaded test fixture; none of them
// are selectors.
const ADMIN_USER_ID = "user-admin-1";
const PROVIDER_NAME = "supabase";
const ADMIN_PROVIDER_USER_ID = "auth-user-admin-1";

// The server-verified principal the request-auth adapter would resolve for the
// admin account. Used only as a lookup key by the record load.
const ADMIN_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: PROVIDER_NAME,
  providerUserId: ADMIN_PROVIDER_USER_ID,
};

// A fully-valid trusted-context input for the admin account, mirroring the shape
// used in routeAccessDecision.test.ts / serverAuthContext.test.ts. The active role
// is carried by the server-loaded session record.
const ADMIN_SERVER_AUTH_CONTEXT_INPUT: DeriveTrustedServerAuthContextInput = {
  authenticatedUser: ADMIN_PRINCIPAL,
  authProviderIdentity: {
    userAccountId: ADMIN_USER_ID,
    providerName: PROVIDER_NAME,
    providerUserId: ADMIN_PROVIDER_USER_ID,
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
};

// An auth source seeded with exactly the admin account, used as the service-role
// record-load test double. No real service-role DB access is involved.
function adminAuthSource(): SolMindAuthSource {
  return createInMemoryAuthSource({
    accounts: [
      {
        principal: ADMIN_PRINCIPAL,
        serverAuthContextInput: ADMIN_SERVER_AUTH_CONTEXT_INPUT,
      },
    ],
  });
}

// A principal source that resolves the given principal (or null), mirroring the
// future request-auth adapter's return contract without any @supabase/ssr.
function principalSource(
  principal: SupabaseAuthenticatedUser | null,
): SolMindRequestAuthPrincipalSource {
  return createInMemoryRequestAuthPrincipalSource(principal);
}

describe("composeRequestAuthContext - allow", () => {
  it("allows a verified admin to access /admin via the composed chain", async () => {
    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: adminAuthSource(),
      },
      { selectors: { requestedRoute: "/admin" } },
    );

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
});

describe("composeRequestAuthContext - identity/record separation", () => {
  it("denies a null principal WITHOUT attempting any record load", async () => {
    // The auth source is a spy: if the composer reaches the service-role record
    // load for an unauthenticated request, this fails (proves AUTH-RLS-DEC-015:
    // a null principal denies before any service-role read).
    const loadServerAuthContextInput = vi.fn();
    const spyAuthSource = {
      loadServerAuthContextInput,
      loadGuideRelationship: vi.fn(),
    } as unknown as SolMindAuthSource;

    const onServiceRoleRead = vi.fn();

    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(null),
        authSource: spyAuthSource,
        onServiceRoleRead,
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    // No record load was attempted, and the audit seam never fired: an
    // unauthenticated request triggers no guarded service-role read.
    expect(loadServerAuthContextInput).not.toHaveBeenCalled();
    expect(onServiceRoleRead).not.toHaveBeenCalled();
  });

  it("passes the resolved principal to the record load as a lookup key only", async () => {
    const loadServerAuthContextInput = vi.fn(() =>
      Promise.resolve(ADMIN_SERVER_AUTH_CONTEXT_INPUT),
    );
    const spyAuthSource = {
      loadServerAuthContextInput,
      loadGuideRelationship: vi.fn(),
    } as unknown as SolMindAuthSource;

    await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: spyAuthSource,
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(loadServerAuthContextInput).toHaveBeenCalledTimes(1);
    expect(loadServerAuthContextInput).toHaveBeenCalledWith({
      authenticatedUser: ADMIN_PRINCIPAL,
    });
  });
});

describe("composeRequestAuthContext - deny-by-default", () => {
  it("denies (opaque) when the principal resolves but no records are found", async () => {
    // Empty auth source: the principal has no stored account, so the load returns
    // the all-null input and derivation denies.
    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: createInMemoryAuthSource(),
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });

  it("denies an authenticated admin requesting a route their role may not access", async () => {
    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: adminAuthSource(),
      },
      { selectors: { requestedRoute: "/guide" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });

  it("exposes only the generic outward reason on deny, with no record-level detail", async () => {
    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: createInMemoryAuthSource(),
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(Object.keys(result).sort()).toEqual(["allowed", "reason"]);
    if (!result.allowed) {
      expect(result.reason).toBe("route_access_denied");
    }
  });
});

describe("composeRequestAuthContext - fail closed", () => {
  it("denies (does not rethrow) when the principal source rejects", async () => {
    const throwingPrincipalSource: SolMindRequestAuthPrincipalSource = {
      resolveAuthenticatedUser: () =>
        Promise.reject(new Error("token-bearing failure that must not leak")),
    };

    const result = await composeRequestAuthContext(
      {
        principalSource: throwingPrincipalSource,
        authSource: adminAuthSource(),
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });

  it("denies (does not rethrow) when the record load rejects", async () => {
    const throwingAuthSource = {
      loadServerAuthContextInput: () =>
        Promise.reject(new Error("record load failure that must not leak")),
      loadGuideRelationship: vi.fn(),
    } as unknown as SolMindAuthSource;

    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: throwingAuthSource,
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });
});

describe("composeRequestAuthContext - audit seam placement", () => {
  it("fires the audit seam exactly once, at the guarded boundary, for an authenticated request", async () => {
    const events: ServiceRoleReadAuditEvent[] = [];

    await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: adminAuthSource(),
        // Block body: the AUD-2 async-capable sink type (void | Promise<void>)
        // does not accept push()'s number return the way the plain void type did.
        onServiceRoleRead: (event) => {
          events.push(event);
        },
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(events).toEqual([{ kind: "server_auth_context_read" }]);
  });

  it("makes no audit call when no sink is injected (seam is default-off)", async () => {
    // Smoke test: omitting onServiceRoleRead must not throw and must still decide.
    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: adminAuthSource(),
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result.allowed).toBe(true);
  });
});

describe("composeRequestAuthContext - auth resolution failure seam", () => {
  it("fires onAuthResolutionFailure exactly once when the principal source rejects, and still denies", async () => {
    const onAuthResolutionFailure = vi.fn();
    const throwingPrincipalSource: SolMindRequestAuthPrincipalSource = {
      resolveAuthenticatedUser: () =>
        Promise.reject(new Error("token-bearing failure that must not leak")),
    };

    const result = await composeRequestAuthContext(
      {
        principalSource: throwingPrincipalSource,
        authSource: adminAuthSource(),
        onAuthResolutionFailure,
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    expect(onAuthResolutionFailure).toHaveBeenCalledTimes(1);
  });

  it("fires onAuthResolutionFailure when the record load rejects, and still denies", async () => {
    const onAuthResolutionFailure = vi.fn();
    const throwingAuthSource = {
      loadServerAuthContextInput: () =>
        Promise.reject(new Error("record load failure that must not leak")),
      loadGuideRelationship: vi.fn(),
    } as unknown as SolMindAuthSource;

    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: throwingAuthSource,
        onAuthResolutionFailure,
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    expect(onAuthResolutionFailure).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onAuthResolutionFailure on a clean deny (null principal)", async () => {
    // A null principal is a clean deny that never throws, so it never reaches the
    // catch where the failure seam fires (the failure category is exception-only).
    const onAuthResolutionFailure = vi.fn();

    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(null),
        authSource: adminAuthSource(),
        onAuthResolutionFailure,
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    expect(onAuthResolutionFailure).not.toHaveBeenCalled();
  });

  it("does NOT fire onAuthResolutionFailure on a clean deny (verified principal, no records)", async () => {
    const onAuthResolutionFailure = vi.fn();

    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: createInMemoryAuthSource(),
        onAuthResolutionFailure,
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    expect(onAuthResolutionFailure).not.toHaveBeenCalled();
  });

  it("still denies (does not rethrow) when onAuthResolutionFailure itself throws", async () => {
    // A throwing failure-audit hook must never re-break fail-closed: the composer's
    // inner guard swallows it and returns the opaque denial unchanged.
    const throwingPrincipalSource: SolMindRequestAuthPrincipalSource = {
      resolveAuthenticatedUser: () =>
        Promise.reject(new Error("resolution failure")),
    };

    const result = await composeRequestAuthContext(
      {
        principalSource: throwingPrincipalSource,
        authSource: adminAuthSource(),
        onAuthResolutionFailure: () => {
          throw new Error("failure-audit hook throw that must not propagate");
        },
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });
});

describe("composeRequestAuthContext - barrel exposure", () => {
  it("is not exported from the shared auth index barrel", () => {
    // The server-only composer must stay off the shared barrel (AUTH-RLS-DEC-007,
    // AUTH-RLS-DEC-013), mirroring serviceRoleClient and requestAuthClient. Server
    // composition paths import it by direct path only.
    expect("composeRequestAuthContext" in authBarrel).toBe(false);
  });
});
