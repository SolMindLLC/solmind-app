// SolMind MVP0 B-4 route-level REAL-PATH contract test for GET /admin/access.
//
// What this adds over the existing suites (why it is not a duplicate):
//   - route.test.ts drives GET but REPLACES resolveAdminAccessForRequest, so it never
//     runs the real composition.
//   - adminAccessRequest.test.ts runs the real composition but injects a mock at the
//     SupabaseQueryExecutor seam, so it never exercises the real serviceRoleRpcExecutor
//     (the B-3 transport swap) and never runs through the HTTP GET handler.
//   - This file closes that gap: it drives the ACTUAL route.ts GET() through the REAL
//     resolveAdminAccessForRequest -> real createSupabaseRequestAuthPrincipalSource ->
//     real createAdminAuthSource -> real createServiceRoleRpcExecutor -> real
//     supabaseAuthQueryClient -> real serverAuthSourceAdapter -> real derivation, faking
//     ONLY the two true IO edges:
//       1. the @supabase/ssr request-auth edge (auth.getUser), which proves WHO; and
//       2. the service-role Supabase client, whose .rpc(fn, args) is the RPC transport.
//     Everything between those two edges is the real banked code.
//
// This is the mock-achievable half of the B-4 contract (execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md Section 13, the "real
// /admin/access allow/deny" and "uses the RPC transport, not the retired broad
// PostgREST executor" assertions). The DB-level half of execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md Section 13 (anon/authenticated
// .rpc() denial, identity/core still blocked, OpenAPI-surface absence, column contract,
// dropped-function, pg_catalog hygiene) cannot be proven with mocks and is covered by
// the separate local-stack suite; see SLICE_MANIFEST.md.
//
// No network, DB, env secret, or real Supabase client is touched: the service-role
// client factory and the @supabase/ssr edge are the only mocked modules, plus the
// Next.js cookies() request surface. NextResponse and the real requestCookieAccessor
// are used unmocked, so the assertions read the actual serialized Response.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted doubles shared with the (hoisted) vi.mock factories below.
//   - cookiesMock: the next/headers cookies() request API.
//   - getUserMock: the @supabase/ssr client's auth.getUser() (the WHO edge).
//   - rpcMock: the service-role client's .rpc(fn, args) (the RPC transport edge).
//   - fromSpy / schemaSpy: never-called spies. The RETIRED broad PostgREST scoped-select
//     executor would have reached for client.from()/client.schema(); asserting they are
//     never called proves the enumerated RPC transport is the only path used.
//   - createServiceRoleClientMock: the service-role client factory, reconfigurable per
//     test (returns the fake client, or throws to simulate a construction failure).
const {
  cookiesMock,
  getUserMock,
  rpcMock,
  fromSpy,
  schemaSpy,
  createServiceRoleClientMock,
} = vi.hoisted(() => {
  return {
    cookiesMock: vi.fn(),
    getUserMock: vi.fn(),
    rpcMock: vi.fn(),
    fromSpy: vi.fn(),
    schemaSpy: vi.fn(),
    createServiceRoleClientMock: vi.fn(),
  };
});

// Replace the Next.js request cookie API so no real request context is needed.
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

// Mock ONLY the @supabase/ssr edge (WHO). The real createSupabaseRequestAuthPrincipalSource
// still runs: it reads the public request-auth env, builds the (fake) client, calls
// auth.getUser(), and maps the result to a principal via the real principalMapping.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
  }),
}));

// Mock ONLY the service-role CLIENT factory (WHAT transport edge). createAdminAuthSource
// still runs the REAL createServiceRoleRpcExecutor over this fake client, so the executor
// dispatches each scoped-select spec to client.rpc("solmind_find_*", namedArgs).
vi.mock("@/lib/solmind/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { GET } from "../route";

// --- Fixtures -------------------------------------------------------------------------

const PROVIDER_NAME = "supabase";
// The @supabase/ssr auth user id; principalMapping trims it into providerUserId.
const PROVIDER_USER_ID = "auth-admin-1";
const ACCOUNT_ID = "user-admin-1";

// Real system clock is used on this path (the route passes no injected now), so session
// expiry uses absolute far-future / far-past instants that stay valid/expired regardless
// of when the suite runs.
const FAR_FUTURE = "2999-12-31T23:59:59.000Z";
const FAR_PAST = "2000-01-01T00:00:00.000Z";

// The six enumerated function names the executor must dispatch to (execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md Section 8).
const FN = {
  identity: "solmind_find_auth_provider_identity",
  account: "solmind_find_user_account",
  sessions: "solmind_find_active_user_sessions",
  role: "solmind_find_active_role_assignment",
  guide: "solmind_find_guide_profile",
  explorer: "solmind_find_explorer_profile",
} as const;

const SOLMIND_FIND_PREFIX = "solmind_find_";

// A secret-looking request cookie value, so leak assertions can prove it never reaches
// the response body.
const SECRET_COOKIE_VALUE = "sb-access-token-SECRET-do-not-leak";

type RpcResponse = { data: unknown; error: unknown };

// Build the canned .rpc() responses keyed by function name for a full, valid chain in
// the given active role. The rows mirror each function's contracted RETURNS TABLE shape.
function rpcChain(role: "admin" | "guide"): Record<string, RpcResponse> {
  return {
    [FN.identity]: {
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
    [FN.account]: {
      data: [{ user_account_id: ACCOUNT_ID, account_status: "active" }],
      error: null,
    },
    [FN.sessions]: {
      data: [
        {
          user_account_id: ACCOUNT_ID,
          active_role_context: role,
          session_status: "active",
          expires_at: FAR_FUTURE,
        },
      ],
      error: null,
    },
    [FN.role]: {
      data: [{ user_account_id: ACCOUNT_ID, role_code: role, role_status: "active" }],
      error: null,
    },
    [FN.guide]:
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
    [FN.explorer]: { data: [], error: null },
  };
}

// Drive the RPC transport edge from a function-name -> response map. An unlisted function
// returns an empty reachable result (error null), matching an empty table.
function setRpcChain(chain: Record<string, RpcResponse>): void {
  rpcMock.mockImplementation((functionName: string) =>
    Promise.resolve(chain[functionName] ?? { data: [], error: null }),
  );
}

// Drive the WHO edge: a verified user, no user (unauthenticated), or a getUser error.
function setVerifiedUser(id: string = PROVIDER_USER_ID): void {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function setNoUser(): void {
  getUserMock.mockResolvedValue({ data: { user: null }, error: null });
}
function setGetUserError(): void {
  getUserMock.mockResolvedValue({
    data: null,
    error: { message: "token-bearing getUser failure that must not leak" },
  });
}

function cookieStore(
  entries: Array<{ name: string; value: string }> = [
    { name: "sb-access-token", value: SECRET_COOKIE_VALUE },
  ],
) {
  return {
    getAll: () => entries.map((entry) => ({ name: entry.name, value: entry.value })),
  };
}

// Read the handler's actual outward result: status, parsed JSON body, and the raw
// serialized text (used to prove no secret substring escapes).
async function invokeRoute(): Promise<{
  status: number;
  contentType: string | null;
  body: unknown;
  rawText: string;
}> {
  const response = await GET();
  const rawText = await response.clone().text();
  const body = await response.json();
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body,
    rawText,
  };
}

// Every function name .rpc() was called with, in call order.
function calledFunctionNames(): string[] {
  return rpcMock.mock.calls.map((call) => call[0] as string);
}

let savedUrlEnv: string | undefined;
let savedAnonEnv: string | undefined;

beforeEach(() => {
  cookiesMock.mockReset();
  getUserMock.mockReset();
  rpcMock.mockReset();
  fromSpy.mockReset();
  schemaSpy.mockReset();
  createServiceRoleClientMock.mockReset();

  // The real request-auth adapter validates these public (non-secret) vars eagerly.
  savedUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  savedAnonEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key-not-a-secret";

  // Default: present request cookies, a verified admin user, the fake service-role client
  // (rpc + never-to-be-called from/schema spies), and a valid admin RPC chain. Individual
  // tests override what they exercise.
  cookiesMock.mockResolvedValue(cookieStore());
  setVerifiedUser();
  createServiceRoleClientMock.mockReturnValue({
    rpc: rpcMock,
    from: fromSpy,
    schema: schemaSpy,
  });
  setRpcChain(rpcChain("admin"));
});

afterEach(() => {
  // Restore exactly: delete a var that was originally unset. Assigning undefined to a
  // process.env property would store the literal string "undefined", not unset it.
  if (savedUrlEnv === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrlEnv;
  }
  if (savedAnonEnv === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnonEnv;
  }
  vi.restoreAllMocks();
});

describe("GET /admin/access real path - valid Admin allow", () => {
  it("returns exactly { allowed: true } when the full chain resolves through the RPC path", async () => {
    const { status, contentType, body } = await invokeRoute();

    expect(status).toBe(200);
    expect(contentType).toContain("application/json");
    expect(body).toEqual({ allowed: true });
    expect(Object.keys(body as object)).toEqual(["allowed"]);
  });

  it("resolves the allow through the enumerated RPC transport, never a broad PostgREST select", async () => {
    const { body } = await invokeRoute();
    expect(body).toEqual({ allowed: true });

    // The transport is the six enumerated functions. Every .rpc() call names a
    // solmind_find_* function with a named-parameter args object (no schema/table/columns
    // /filters leak through), and the identity lookup that starts the chain ran.
    const names = calledFunctionNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain(FN.identity);
    for (const [functionName, args] of rpcMock.mock.calls) {
      expect(functionName as string).toMatch(new RegExp(`^${SOLMIND_FIND_PREFIX}`));
      expect(args).toBeTypeOf("object");
      // Named RPC params only; no raw query shape from the retired executor.
      for (const key of Object.keys(args as Record<string, unknown>)) {
        expect(key.startsWith("p_")).toBe(true);
      }
      expect(args).not.toHaveProperty("schema");
      expect(args).not.toHaveProperty("table");
      expect(args).not.toHaveProperty("columns");
      expect(args).not.toHaveProperty("filters");
    }

    // The retired broad PostgREST scoped-select executor would have used .from()/.schema();
    // the RPC transport never does.
    expect(fromSpy).not.toHaveBeenCalled();
    expect(schemaSpy).not.toHaveBeenCalled();
  });
});

describe("GET /admin/access real path - fail-closed denies", () => {
  it("denies an unauthenticated request WITHOUT any service-role RPC read", async () => {
    setNoUser();

    const { status, body } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    // A null principal denies before any record load: the RPC transport is never touched.
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("denies when the identity edge (getUser) errors, leaking no detail", async () => {
    setGetUserError();

    const { body, rawText } = await invokeRoute();

    expect(body).toEqual({ allowed: false });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(rawText).not.toContain("token-bearing");
    expect(rawText).not.toContain("getUser");
  });

  it("denies when there is no active session", async () => {
    const chain = rpcChain("admin");
    chain[FN.sessions] = { data: [], error: null };
    setRpcChain(chain);

    const { body } = await invokeRoute();
    expect(body).toEqual({ allowed: false });
  });

  it("denies when the only session is expired (expiration wins over an active status)", async () => {
    const chain = rpcChain("admin");
    chain[FN.sessions] = {
      data: [
        {
          user_account_id: ACCOUNT_ID,
          active_role_context: "admin",
          session_status: "active",
          expires_at: FAR_PAST,
        },
      ],
      error: null,
    };
    setRpcChain(chain);

    const { body } = await invokeRoute();
    expect(body).toEqual({ allowed: false });
  });

  it("denies on session ambiguity: two valid active sessions", async () => {
    const chain = rpcChain("admin");
    chain[FN.sessions] = {
      data: [
        {
          user_account_id: ACCOUNT_ID,
          active_role_context: "admin",
          session_status: "active",
          expires_at: FAR_FUTURE,
        },
        {
          user_account_id: ACCOUNT_ID,
          active_role_context: "admin",
          session_status: "active",
          expires_at: FAR_FUTURE,
        },
      ],
      error: null,
    };
    setRpcChain(chain);

    const { body } = await invokeRoute();
    expect(body).toEqual({ allowed: false });
  });

  it("denies a verified non-Admin (server-derived role decides; a browser cannot claim admin)", async () => {
    // /admin authorizes on the SERVER-derived active role only (routeAccessDecision.ts:
    // requestedRole is a non-authoritative selector, and this route exposes no role
    // channel to the browser at all). A verified Guide session therefore denies.
    setRpcChain(rpcChain("guide"));

    const { body } = await invokeRoute();
    expect(body).toEqual({ allowed: false });
  });

  it("denies when a required lookup returns an RPC error, leaking no error detail", async () => {
    const chain = rpcChain("admin");
    chain[FN.account] = {
      data: null,
      error: {
        message:
          "permission denied at https://project-ref.supabase.co/rest/v1/rpc using key sbp_service_role_secret_abc123",
        code: "42501",
      },
    };
    setRpcChain(chain);

    const { body, rawText } = await invokeRoute();

    expect(body).toEqual({ allowed: false });
    expect(rawText).not.toContain("supabase.co");
    expect(rawText).not.toContain("service_role");
    expect(rawText).not.toContain("sbp_service_role_secret_abc123");
  });

  it("denies (never a 500) when a required lookup behaves like a dropped function", async () => {
    // A dropped/renamed function surfaces to PostgREST as an error; the executor maps it
    // to a value-free sentinel and the chain fails closed -- an opaque 200 deny, not a 500.
    const chain = rpcChain("admin");
    chain[FN.identity] = {
      data: null,
      error: {
        message: "function public.solmind_find_auth_provider_identity(text, text) does not exist",
        code: "42883",
      },
    };
    setRpcChain(chain);

    const { status, body } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
  });

  it("denies when the service-role client cannot be constructed (missing-config fail-closed)", async () => {
    // A missing/blank service-role env throws at createServiceRoleClient() inside the real
    // createAdminAuthSource; the route composition catches it and denies opaquely.
    createServiceRoleClientMock.mockImplementation(() => {
      throw new Error(
        "SolMind server configuration error: required server environment variable SUPABASE_SERVICE_ROLE_KEY is missing or blank.",
      );
    });

    const { status, body, rawText } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    expect(rawText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

describe("GET /admin/access real path - opaque outward projection", () => {
  it("never serializes a request cookie value into the response body", async () => {
    const { rawText } = await invokeRoute();

    expect(rawText).not.toContain(SECRET_COOKIE_VALUE);
    expect(rawText).not.toContain("sb-access-token");
  });

  it("returns the identical opaque shape { allowed } for allow and deny (status signals nothing)", async () => {
    const allow = await invokeRoute();
    expect(allow.status).toBe(200);
    expect(allow.body).toEqual({ allowed: true });

    setNoUser();
    const deny = await invokeRoute();
    expect(deny.status).toBe(200);
    expect(deny.body).toEqual({ allowed: false });
    expect(Object.keys(deny.body as object)).toEqual(["allowed"]);
  });
});
