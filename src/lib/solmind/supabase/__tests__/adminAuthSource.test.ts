import { describe, expect, it } from "vitest";

import { createAdminAuthSourceFromExecutor } from "../adminAuthSource";
import {
  type SupabaseQueryResult,
  type SupabaseQuerySpec,
} from "../supabaseAuthQueryClient";
import {
  authorizeRouteAccess,
  ROUTE_ACCESS_DENY_REASON,
  type AuthorizeRouteAccessResult,
  type SupabaseAuthenticatedUser,
} from "../../auth";

// Fixed injected clock; session expiries are relative to this. No real time is read.
const NOW = new Date("2026-06-25T12:00:00.000Z");
const FUTURE = "2026-06-25T13:00:00.000Z";
const PAST = "2026-06-25T11:00:00.000Z";

function nowProvider(): Date {
  return NOW;
}

const ADMIN_ROUTE = "/admin";
const PROVIDER_NAME = "supabase";
const PROVIDER_USER_ID = "auth-admin-1";
const ACCOUNT_ID = "user-admin-1";

const ADMIN_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: PROVIDER_NAME,
  providerUserId: PROVIDER_USER_ID,
};

// A deterministic mock scoped-select executor. It records every spec and returns a
// canned result keyed by table. No network, DB, env, or cookies are touched, so the
// admin-access assembly is exercised end to end in isolation.
function mockExecutor(resultByTable: Record<string, SupabaseQueryResult>) {
  const calls: SupabaseQuerySpec[] = [];
  const executor = {
    select(spec: SupabaseQuerySpec): Promise<SupabaseQueryResult> {
      calls.push(spec);
      const result = resultByTable[spec.table] ?? { data: [], error: null };
      return Promise.resolve(result);
    },
  };
  return { executor, calls };
}

// Build a full, valid identity->session->role chain for the given role. The session
// is active and non-expired; the role assignment matches the active role context.
// guide/explorer profiles default to empty (an Admin holds neither).
function chainTables(
  role: "admin" | "guide",
  overrides: Record<string, SupabaseQueryResult> = {},
): Record<string, SupabaseQueryResult> {
  return {
    auth_provider_identity: {
      data: [
        {
          user_account_id: ACCOUNT_ID,
          provider_name: PROVIDER_NAME,
          provider_user_id: PROVIDER_USER_ID,
          status: "active",
        },
      ],
      error: null,
    },
    user_account: {
      data: [{ user_account_id: ACCOUNT_ID, account_status: "active" }],
      error: null,
    },
    user_session: {
      data: [
        {
          user_account_id: ACCOUNT_ID,
          active_role_context: role,
          session_status: "active",
          expires_at: FUTURE,
        },
      ],
      error: null,
    },
    user_role_assignment: {
      data: [
        {
          user_account_id: ACCOUNT_ID,
          role_code: role,
          role_status: "active",
        },
      ],
      error: null,
    },
    guide_profile: { data: [], error: null },
    explorer_profile: { data: [], error: null },
    ...overrides,
  };
}

// Assemble the real-shaped Admin auth source over a mock executor, load the trusted
// record input by the principal, and run the SAME authority chain the composer uses
// (authorizeRouteAccess -> deriveTrustedServerAuthContext) against the fixed /admin
// selector. The factory loads records only; authority stays in the guard layer.
async function decideAdmin(
  resultByTable: Record<string, SupabaseQueryResult>,
  principal: SupabaseAuthenticatedUser = ADMIN_PRINCIPAL,
): Promise<{ result: AuthorizeRouteAccessResult; calls: SupabaseQuerySpec[] }> {
  const { executor, calls } = mockExecutor(resultByTable);
  const authSource = createAdminAuthSourceFromExecutor({
    executor,
    now: nowProvider,
  });
  const serverAuthContext = await authSource.loadServerAuthContextInput({
    authenticatedUser: principal,
  });
  const result = authorizeRouteAccess({
    serverAuthContext,
    selectors: { requestedRoute: ADMIN_ROUTE },
  });
  return { result, calls };
}

describe("createAdminAuthSource - admin allow", () => {
  it("allows /admin for a server-verified Admin chain", async () => {
    const { result } = await decideAdmin(chainTables("admin"));

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.context.activeRole).toBe("admin");
      expect(result.context.identity.userAccountId).toBe(ACCOUNT_ID);
    }
  });

  it("loads identity ONLY by the server-verified principal (separation of WHO/WHAT)", async () => {
    const { result, calls } = await decideAdmin(chainTables("admin"));

    expect(result.allowed).toBe(true);
    // The first scoped read is the provider identity, keyed solely by the principal
    // values. No browser-supplied value widens or selects the lookup.
    const identityCall = calls.find(
      (call) => call.table === "auth_provider_identity",
    );
    expect(identityCall?.filters).toEqual([
      { column: "provider_name", value: PROVIDER_NAME },
      { column: "provider_user_id", value: PROVIDER_USER_ID },
      { column: "status", value: "active" },
    ]);
  });
});

describe("createAdminAuthSource - deny by default", () => {
  it("denies /admin for a fully-valid non-Admin (Guide) chain (role/route mismatch)", async () => {
    const tables = chainTables("guide", {
      guide_profile: {
        data: [
          {
            guide_profile_id: "guide-profile-1",
            user_account_id: ACCOUNT_ID,
            status: "active",
          },
        ],
        error: null,
      },
    });

    const { result } = await decideAdmin(tables);

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
  });

  it("denies when the provider identity record is missing", async () => {
    const { result } = await decideAdmin(
      chainTables("admin", {
        auth_provider_identity: { data: [], error: null },
      }),
    );

    expect(result.allowed).toBe(false);
  });

  it("denies when the active role assignment is missing", async () => {
    const { result } = await decideAdmin(
      chainTables("admin", {
        user_role_assignment: { data: [], error: null },
      }),
    );

    expect(result.allowed).toBe(false);
  });

  it("denies on session ambiguity (multiple active sessions)", async () => {
    const { result } = await decideAdmin(
      chainTables("admin", {
        user_session: {
          data: [
            {
              user_account_id: ACCOUNT_ID,
              active_role_context: "admin",
              session_status: "active",
              expires_at: FUTURE,
            },
            {
              user_account_id: ACCOUNT_ID,
              active_role_context: "guide",
              session_status: "active",
              expires_at: FUTURE,
            },
          ],
          error: null,
        },
      }),
    );

    expect(result.allowed).toBe(false);
  });

  it("denies on an expired active session (expiration wins)", async () => {
    const { result } = await decideAdmin(
      chainTables("admin", {
        user_session: {
          data: [
            {
              user_account_id: ACCOUNT_ID,
              active_role_context: "admin",
              session_status: "active",
              expires_at: PAST,
            },
          ],
          error: null,
        },
      }),
    );

    expect(result.allowed).toBe(false);
  });

  it("denies on an invalid row shape (missing required field)", async () => {
    const { result } = await decideAdmin(
      chainTables("admin", {
        auth_provider_identity: {
          // provider_user_id and status are missing -> invalid row -> deny.
          data: [{ user_account_id: ACCOUNT_ID, provider_name: PROVIDER_NAME }],
          error: null,
        },
      }),
    );

    expect(result.allowed).toBe(false);
  });

  it("denies on a query error and leaks no detail", async () => {
    const { result } = await decideAdmin(
      chainTables("admin", {
        auth_provider_identity: { data: null, error: { message: "boom" } },
      }),
    );

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
  });
});

describe("createAdminAuthSource - executor failure", () => {
  it("denies (fails closed) when the executor throws", async () => {
    const throwingExecutor = {
      select(): Promise<SupabaseQueryResult> {
        throw new Error("synchronous executor failure");
      },
    };
    const authSource = createAdminAuthSourceFromExecutor({
      executor: throwingExecutor,
      now: nowProvider,
    });

    const serverAuthContext = await authSource.loadServerAuthContextInput({
      authenticatedUser: ADMIN_PRINCIPAL,
    });
    const result = authorizeRouteAccess({
      serverAuthContext,
      selectors: { requestedRoute: ADMIN_ROUTE },
    });

    expect(result).toEqual({
      allowed: false,
      reason: ROUTE_ACCESS_DENY_REASON,
    });
  });
});
