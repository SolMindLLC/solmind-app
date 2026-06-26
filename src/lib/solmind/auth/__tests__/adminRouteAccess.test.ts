import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_ACCESS_ROUTE,
  createDeferredAdminAuthSource,
  resolveAdminRouteAccess,
} from "../adminRouteAccess";
import {
  createInMemoryAuthSource,
  type SolMindAuthSource,
} from "../authSource";
import {
  createInMemoryRequestAuthPrincipalSource,
  type SolMindRequestAuthPrincipalSource,
} from "../requestAuthPrincipalSource";
import { ROUTE_ACCESS_DENY_REASON } from "../routeAccessDecision";
import {
  type DeriveTrustedServerAuthContextInput,
  type SupabaseAuthenticatedUser,
} from "../serverAuthContext";
import * as authBarrel from "../index";
import { createAdminAuthSourceFromExecutor } from "../../supabase/adminAuthSource";
import {
  type SupabaseQueryResult,
  type SupabaseQuerySpec,
} from "../../supabase/supabaseAuthQueryClient";

const PROVIDER_NAME = "supabase";

// Build a fully-valid trusted-context input for a given role, mirroring
// routeAccessDecision.test.ts / serverAuthContext.test.ts. Every field is
// server-loaded; none is a selector.
function validInput(
  role: "admin" | "guide",
): DeriveTrustedServerAuthContextInput {
  const userAccountId = `user-${role}-1`;
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
    activeRoleAssignment: { userAccountId, roleCode: role, roleStatus: "active" },
    guideProfile:
      role === "guide"
        ? { guideProfileId: "guide-profile-a", userAccountId, status: "active" }
        : null,
    explorerProfile: null,
  };
}

function principalFor(role: "admin" | "guide"): SupabaseAuthenticatedUser {
  return { providerName: PROVIDER_NAME, providerUserId: `auth-user-${role}-1` };
}

// An in-memory auth source seeded with one account, used as the injected
// service-role record-load test double. No real service-role DB access is involved.
function authSourceWith(role: "admin" | "guide"): SolMindAuthSource {
  return createInMemoryAuthSource({
    accounts: [
      { principal: principalFor(role), serverAuthContextInput: validInput(role) },
    ],
  });
}

function principalSource(
  principal: SupabaseAuthenticatedUser | null,
): SolMindRequestAuthPrincipalSource {
  return createInMemoryRequestAuthPrincipalSource(principal);
}

describe("resolveAdminRouteAccess - allow", () => {
  it("allows a verified admin when an admin record source is injected", async () => {
    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(principalFor("admin")),
      authSource: authSourceWith("admin"),
    });

    expect(result).toEqual({
      allowed: true,
      context: {
        activeRole: "admin",
        identity: {
          userAccountId: "user-admin-1",
          guideProfileId: null,
          explorerProfileId: null,
        },
      },
    });
  });
});

describe("resolveAdminRouteAccess - deny-by-default", () => {
  it("denies an unauthenticated request (null principal) WITHOUT loading records", async () => {
    // Spy auth source: reaching the record load for an unauthenticated request
    // would fail (proves AUTH-RLS-DEC-015 at the route-helper level).
    const loadServerAuthContextInput = vi.fn();
    const spyAuthSource = {
      loadServerAuthContextInput,
      loadGuideRelationship: vi.fn(),
    } as unknown as SolMindAuthSource;

    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(null),
      authSource: spyAuthSource,
    });

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    expect(loadServerAuthContextInput).not.toHaveBeenCalled();
  });

  it("denies a verified principal when the default deferred auth source holds no records", async () => {
    // No authSource injected: the helper falls back to the deferred in-memory seam,
    // which holds no records and therefore denies by default.
    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(principalFor("admin")),
    });

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });

  it("denies a verified guide because the fixed selector is /admin (role/route mismatch)", async () => {
    // A guide principal with valid guide records still cannot open /admin: the
    // helper pins the selector to ADMIN_ACCESS_ROUTE, so the server-derived guide
    // role is not permitted on /admin.
    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(principalFor("guide")),
      authSource: authSourceWith("guide"),
    });

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });

  it("exposes only the generic outward reason on deny, with no record-level detail", async () => {
    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(principalFor("admin")),
    });

    expect(Object.keys(result).sort()).toEqual(["allowed", "reason"]);
    if (!result.allowed) {
      expect(result.reason).toBe("route_access_denied");
    }
  });
});

describe("resolveAdminRouteAccess - deferred service-role seam", () => {
  it("pins the boundary to the /admin route", () => {
    expect(ADMIN_ACCESS_ROUTE).toBe("/admin");
  });

  it("default deferred auth source loads no records (deny-by-default seam)", async () => {
    // The deferred seam returns the all-null input for any principal, so derivation
    // denies. This is the explicit stand-in until real service-role loading lands.
    const deferred = createDeferredAdminAuthSource();
    const input = await deferred.loadServerAuthContextInput({
      authenticatedUser: principalFor("admin"),
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

// --- Real-shaped Admin auth source (service-role chain over a mocked executor) ---
//
// These cases inject the REAL admin-access assembler (createAdminAuthSourceFromExecutor)
// instead of the plain in-memory double, exercising the actual query client +
// snake_case mapping + session selection over a deterministic mock executor (no
// network, DB, or env). resolveAdminRouteAccess's signature is unchanged; only a
// concrete real-shaped auth source is injected.
const REAL_NOW = new Date("2026-06-25T12:00:00.000Z");
const REAL_FUTURE = "2026-06-25T13:00:00.000Z";
const REAL_ACCOUNT_ID = "user-admin-real-1";
const REAL_PROVIDER_USER_ID = "auth-user-admin-real-1";

function realNow(): Date {
  return REAL_NOW;
}

function realAdminPrincipal(): SupabaseAuthenticatedUser {
  return { providerName: PROVIDER_NAME, providerUserId: REAL_PROVIDER_USER_ID };
}

// Mock scoped-select executor: returns a canned result keyed by table.
function realExecutor(resultByTable: Record<string, SupabaseQueryResult>) {
  return {
    select(spec: SupabaseQuerySpec): Promise<SupabaseQueryResult> {
      return Promise.resolve(
        resultByTable[spec.table] ?? { data: [], error: null },
      );
    },
  };
}

function realAdminChainTables(
  role: "admin" | "guide",
): Record<string, SupabaseQueryResult> {
  return {
    auth_provider_identity: {
      data: [
        {
          user_account_id: REAL_ACCOUNT_ID,
          provider_name: PROVIDER_NAME,
          provider_user_id: REAL_PROVIDER_USER_ID,
          status: "active",
        },
      ],
      error: null,
    },
    user_account: {
      data: [{ user_account_id: REAL_ACCOUNT_ID, account_status: "active" }],
      error: null,
    },
    user_session: {
      data: [
        {
          user_account_id: REAL_ACCOUNT_ID,
          active_role_context: role,
          session_status: "active",
          expires_at: REAL_FUTURE,
        },
      ],
      error: null,
    },
    user_role_assignment: {
      data: [
        { user_account_id: REAL_ACCOUNT_ID, role_code: role, role_status: "active" },
      ],
      error: null,
    },
    guide_profile:
      role === "guide"
        ? {
            data: [
              {
                guide_profile_id: "guide-profile-real-1",
                user_account_id: REAL_ACCOUNT_ID,
                status: "active",
              },
            ],
            error: null,
          }
        : { data: [], error: null },
    explorer_profile: { data: [], error: null },
  };
}

describe("resolveAdminRouteAccess - real-shaped service-role auth source", () => {
  it("allows /admin for a verified Admin loaded through the real assembler", async () => {
    const authSource = createAdminAuthSourceFromExecutor({
      executor: realExecutor(realAdminChainTables("admin")),
      now: realNow,
    });

    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(realAdminPrincipal()),
      authSource,
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.context.activeRole).toBe("admin");
      expect(result.context.identity.userAccountId).toBe(REAL_ACCOUNT_ID);
    }
  });

  it("denies /admin for a verified non-Admin (Guide) loaded through the real assembler", async () => {
    const authSource = createAdminAuthSourceFromExecutor({
      executor: realExecutor(realAdminChainTables("guide")),
      now: realNow,
    });

    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(realAdminPrincipal()),
      authSource,
    });

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });

  it("denies a null principal WITHOUT reading any records through the real assembler", async () => {
    const select = vi.fn();
    const authSource = createAdminAuthSourceFromExecutor({
      executor: { select },
      now: realNow,
    });

    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(null),
      authSource,
    });

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    expect(select).not.toHaveBeenCalled();
  });
});

describe("resolveAdminRouteAccess - audit seam forwarding", () => {
  it("forwards onServiceRoleRead to the guarded boundary (fires once on a service-role read)", async () => {
    const onServiceRoleRead = vi.fn();

    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(principalFor("admin")),
      authSource: authSourceWith("admin"),
      onServiceRoleRead,
    });

    expect(result.allowed).toBe(true);
    expect(onServiceRoleRead).toHaveBeenCalledTimes(1);
    expect(onServiceRoleRead).toHaveBeenCalledWith({
      kind: "server_auth_context_read",
    });
  });

  it("does not fire onServiceRoleRead for a null principal (deny before read)", async () => {
    const onServiceRoleRead = vi.fn();

    const result = await resolveAdminRouteAccess({
      principalSource: principalSource(null),
      authSource: authSourceWith("admin"),
      onServiceRoleRead,
    });

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    expect(onServiceRoleRead).not.toHaveBeenCalled();
  });

  it("forwards onAuthResolutionFailure (fires once when the principal source rejects)", async () => {
    const onAuthResolutionFailure = vi.fn();
    const throwingPrincipalSource: SolMindRequestAuthPrincipalSource = {
      resolveAuthenticatedUser: () =>
        Promise.reject(new Error("resolution failure that must not leak")),
    };

    const result = await resolveAdminRouteAccess({
      principalSource: throwingPrincipalSource,
      authSource: authSourceWith("admin"),
      onAuthResolutionFailure,
    });

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    expect(onAuthResolutionFailure).toHaveBeenCalledTimes(1);
  });
});

describe("resolveAdminRouteAccess - barrel exposure", () => {
  it("is not exported from the shared auth index barrel", () => {
    // Server-only helper stays off the shared barrel (AUTH-RLS-DEC-007,
    // AUTH-RLS-DEC-013). Server composition paths import it by direct path only.
    expect("resolveAdminRouteAccess" in authBarrel).toBe(false);
    expect("createDeferredAdminAuthSource" in authBarrel).toBe(false);
  });
});
