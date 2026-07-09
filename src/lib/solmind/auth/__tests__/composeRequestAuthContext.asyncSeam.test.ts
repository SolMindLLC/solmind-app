import { describe, expect, it, vi } from "vitest";

import { composeRequestAuthContext } from "../composeRequestAuthContext";
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

// AUD-2 async awaited seam behavior (Doc 22 Section 11; carry-forward H2): the two
// value-free hooks (onServiceRoleRead, onAuthResolutionFailure) may now return a
// promise and are AWAITED at their call sites. These tests prove that an
// asynchronous rejection behaves exactly like the banked synchronous throw (deny
// for the guarded try; swallowed for the best-effort failure hook), that no
// floating promise escapes as an unhandled rejection, and that the awaited marker
// keeps its before-the-read ordering. The banked composeRequestAuthContext.test.ts
// sync-hook suite continues to cover the synchronous behavior unchanged.

const ADMIN_USER_ID = "user-admin-1";
const PROVIDER_NAME = "supabase";
const ADMIN_PROVIDER_USER_ID = "auth-user-admin-1";

const ADMIN_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: PROVIDER_NAME,
  providerUserId: ADMIN_PROVIDER_USER_ID,
};

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

function principalSource(
  principal: SupabaseAuthenticatedUser | null,
): SolMindRequestAuthPrincipalSource {
  return createInMemoryRequestAuthPrincipalSource(principal);
}

describe("composeRequestAuthContext - async rejecting onServiceRoleRead marker", () => {
  it("fails closed (deny, no rethrow, no unhandled rejection) when the awaited marker rejects", async () => {
    const onAuthResolutionFailure = vi.fn();

    const result = await composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: adminAuthSource(),
        onServiceRoleRead: () =>
          Promise.reject(
            new Error("async marker rejection that must not leak or allow"),
          ),
        onAuthResolutionFailure,
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    // Identical to the banked synchronous-throw behavior: the rejection lands in
    // the fail-closed catch (opaque deny) and the failure seam fires once.
    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
    expect(onAuthResolutionFailure).toHaveBeenCalledTimes(1);
  });
});

describe("composeRequestAuthContext - awaited marker ordering (before the record load)", () => {
  it("does not begin the record load until the awaited pre-read marker settles", async () => {
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    const loadServerAuthContextInput = vi.fn(() =>
      Promise.resolve(ADMIN_SERVER_AUTH_CONTEXT_INPUT),
    );
    const gatedAuthSource = {
      loadServerAuthContextInput,
      loadGuideRelationship: vi.fn(),
    } as unknown as SolMindAuthSource;

    const pending = composeRequestAuthContext(
      {
        principalSource: principalSource(ADMIN_PRINCIPAL),
        authSource: gatedAuthSource,
        onServiceRoleRead: () => gate,
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    // Drain the queues: the principal has resolved, but the awaited marker is
    // still pending, so the guarded service-role record load must not have begun.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loadServerAuthContextInput).not.toHaveBeenCalled();

    releaseGate();
    const result = await pending;

    expect(loadServerAuthContextInput).toHaveBeenCalledTimes(1);
    expect(result.allowed).toBe(true);
  });
});

describe("composeRequestAuthContext - async rejecting onAuthResolutionFailure hook", () => {
  it("swallows an async hook rejection (deny unchanged, no rethrow, no unhandled rejection)", async () => {
    const result = await composeRequestAuthContext(
      {
        principalSource: {
          resolveAuthenticatedUser: () =>
            Promise.reject(new Error("resolution failure")),
        },
        authSource: adminAuthSource(),
        onAuthResolutionFailure: () =>
          Promise.reject(
            new Error("failure-hook rejection that must not propagate"),
          ),
      },
      { selectors: { requestedRoute: "/admin" } },
    );

    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });

  it("awaits a slow failure hook before resolving the denial (best-effort, but never floating)", async () => {
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const hookCalls = vi.fn();

    let settled = false;
    const pending = composeRequestAuthContext(
      {
        principalSource: {
          resolveAuthenticatedUser: () =>
            Promise.reject(new Error("resolution failure")),
        },
        authSource: adminAuthSource(),
        onAuthResolutionFailure: () => {
          hookCalls();
          return gate;
        },
      },
      { selectors: { requestedRoute: "/admin" } },
    ).then((result) => {
      settled = true;
      return result;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hookCalls).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    releaseGate();
    const result = await pending;

    expect(settled).toBe(true);
    expect(result).toEqual({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });
  });
});
