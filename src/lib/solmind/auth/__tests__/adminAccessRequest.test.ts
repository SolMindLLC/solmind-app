import { describe, expect, it, vi } from "vitest";

import {
  resolveAdminAccessForRequest,
  type AdminAccessResult,
} from "../adminAccessRequest";
import { type SolMindAuthSource } from "../authSource";
import {
  createInMemoryRequestAuthPrincipalSource,
  type SolMindRequestAuthPrincipalSource,
} from "../requestAuthPrincipalSource";
import {
  createInMemoryRequestCookieAccessor,
  type RequestCookieAccessor,
} from "../requestCookieAccessor";
import { type SupabaseAuthenticatedUser } from "../serverAuthContext";
import { createAdminAuthSourceFromExecutor } from "../../supabase/adminAuthSource";
import {
  type SupabaseQueryResult,
  type SupabaseQuerySpec,
} from "../../supabase/supabaseAuthQueryClient";

// Fixed injected clock; session expiries are relative to this. No real time is read.
const NOW = new Date("2026-06-25T12:00:00.000Z");
const FUTURE = "2026-06-25T13:00:00.000Z";

const PROVIDER_NAME = "supabase";
const PROVIDER_USER_ID = "auth-admin-1";
const ACCOUNT_ID = "user-admin-1";

function nowProvider(): Date {
  return NOW;
}

const ADMIN_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: PROVIDER_NAME,
  providerUserId: PROVIDER_USER_ID,
};

// Deterministic cookie accessor double. The injected principal-source factory below
// ignores it, so its contents do not affect the decision; it only satisfies the port.
function cookies(): RequestCookieAccessor {
  return createInMemoryRequestCookieAccessor();
}

// A deterministic mock scoped-select executor keyed by table. No network/DB/env.
function mockExecutor(resultByTable: Record<string, SupabaseQueryResult>) {
  const calls: SupabaseQuerySpec[] = [];
  const executor = {
    select(spec: SupabaseQuerySpec): Promise<SupabaseQueryResult> {
      calls.push(spec);
      return Promise.resolve(
        resultByTable[spec.table] ?? { data: [], error: null },
      );
    },
  };
  return { executor, calls };
}

// Build a full, valid identity->session->role chain for the given role. The session
// is active and non-expired; the role assignment matches the active role context.
function chainTables(
  role: "admin" | "guide",
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
        { user_account_id: ACCOUNT_ID, role_code: role, role_status: "active" },
      ],
      error: null,
    },
    guide_profile:
      role === "guide"
        ? {
            data: [
              {
                guide_profile_id: "guide-profile-1",
                user_account_id: ACCOUNT_ID,
                status: "active",
              },
            ],
            error: null,
          }
        : { data: [], error: null },
    explorer_profile: { data: [], error: null },
  };
}

// Inject an in-memory principal source (WHO) and a real-shaped, mock-executor-backed
// Admin auth source (WHAT) into the helper, mirroring how the route composes the real
// adapters but with deterministic doubles.
function callHelperWith(args: {
  principal: SupabaseAuthenticatedUser | null;
  resultByTable?: Record<string, SupabaseQueryResult>;
  principalSourceFactory?: () => SolMindRequestAuthPrincipalSource;
  authSourceFactory?: (args: { now: () => Date }) => SolMindAuthSource;
}): Promise<{ result: AdminAccessResult; calls: SupabaseQuerySpec[] }> {
  const { executor, calls } = mockExecutor(args.resultByTable ?? chainTables("admin"));

  const createPrincipalSource =
    args.principalSourceFactory ??
    (() => createInMemoryRequestAuthPrincipalSource(args.principal));

  const createAuthSource =
    args.authSourceFactory ??
    (({ now }: { now: () => Date }) =>
      createAdminAuthSourceFromExecutor({ executor, now }));

  return resolveAdminAccessForRequest({
    cookies: cookies(),
    createPrincipalSource,
    createAuthSource,
    now: nowProvider,
  }).then((result) => ({ result, calls }));
}

// Assert the outward result carries ONLY { allowed } and never leaks reason, context,
// role, or any profile/session/identity field.
function expectOpaque(result: AdminAccessResult): void {
  expect(Object.keys(result)).toEqual(["allowed"]);
  expect(result).not.toHaveProperty("reason");
  expect(result).not.toHaveProperty("context");
  expect(result).not.toHaveProperty("activeRole");
  expect(result).not.toHaveProperty("identity");
  expect(result).not.toHaveProperty("guideProfileId");
  expect(result).not.toHaveProperty("explorerProfileId");
}

describe("resolveAdminAccessForRequest - opaque allow", () => {
  it("returns only { allowed: true } for a verified Admin (no context/reason leakage)", async () => {
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
    });

    expect(result).toEqual({ allowed: true });
    expectOpaque(result);
  });
});

describe("resolveAdminAccessForRequest - opaque deny", () => {
  it("returns only { allowed: false } for a verified non-Admin (Guide), no leakage", async () => {
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });

  it("never carries Explorer/Guide profile fields into the outward result", async () => {
    // Even when the loaded chain includes a Guide profile, the outward result holds
    // only { allowed } -- no guideProfileId/explorerProfileId or any private field.
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
    });

    expectOpaque(result);
  });
});

describe("resolveAdminAccessForRequest - fail closed", () => {
  it("denies when the auth-source factory throws (e.g. missing service-role env)", async () => {
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      authSourceFactory: () => {
        throw new Error("SolMind server configuration error: missing service-role env");
      },
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });

  it("denies when the principal-source factory throws", async () => {
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      principalSourceFactory: () => {
        throw new Error("principal source construction failure");
      },
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });
});

describe("resolveAdminAccessForRequest - null principal", () => {
  it("denies a null principal WITHOUT invoking the service-role/record-load executor", async () => {
    const select = vi.fn();
    const result = await resolveAdminAccessForRequest({
      cookies: cookies(),
      createPrincipalSource: () =>
        createInMemoryRequestAuthPrincipalSource(null),
      createAuthSource: ({ now }) =>
        createAdminAuthSourceFromExecutor({ executor: { select }, now }),
      now: nowProvider,
    });

    expect(result).toEqual({ allowed: false });
    expect(select).not.toHaveBeenCalled();
  });
});
