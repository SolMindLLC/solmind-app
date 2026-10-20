// SolMind MVP0 B-4 route-level REAL-PATH contract test for GET /admin/access.
//
// What this adds over the existing suites (why it is not a duplicate):
//   - route.test.ts drives GET but REPLACES resolveAdminAccessForRequest, so it never
//     runs the real composition.
//   - adminAccessRequest.test.ts runs the real composition but injects a mock at the
//     SupabaseQueryExecutor seam and an audit-writer double, so it never exercises the
//     real serviceRoleRpcExecutor (the B-3 transport swap) or the real AUD-3 audit
//     writer chain, and never runs through the HTTP GET handler.
//   - This file closes that gap: it drives the ACTUAL route.ts GET() through the REAL
//     resolveAdminAccessForRequest -> real createSupabaseRequestAuthPrincipalSource ->
//     real createAdminAuthSource -> real createServiceRoleRpcExecutor -> real
//     supabaseAuthQueryClient -> real serverAuthSourceAdapter -> real derivation, AND
//     (as of AUD-3) the REAL default audit writer chain (createAdminAuditEventWriter ->
//     createAuditEventWriteExecutor -> createAuthRlsAuditEventWriter), faking ONLY the
//     two true IO edges:
//       1. the Supabase Auth request-auth edge (auth.getUser, on the client the
//          adapter builds with createClient), which proves WHO; and
//       2. the service-role Supabase client, whose .rpc(fn, args) is the RPC transport
//          for BOTH the six enumerated read lookups and the single enumerated audit
//          write function.
//     Everything between those two edges is the real banked code.
//
// This is the mock-achievable half of the B-4 contract (execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md Section 13, the "real
// /admin/access allow/deny" and "uses the RPC transport, not the retired broad
// PostgREST executor" assertions), extended at AUD-3 with the Doc 22 Section 12
// family 4/6 route real-path assertions (execution/22_SolMind_MVP0_Auth_RLS_Audit_Persistence_Contract_v0_1.md):
// the production composition injects the REAL audit writer by default; an allow
// persists the guarded-read row FIRST and the allow decision row SECOND, both
// required before the outward allow (AUTH-RLS-DEC-029/030); a deny persists exactly
// one opaque decision row and no guarded-read row; induced audit-write failures deny
// without leaking and without false rows. The DB-level half (anon/authenticated
// .rpc() denial, identity/core still blocked, OpenAPI-surface absence, column
// contract, dropped-function, pg_catalog hygiene) cannot be proven with mocks and is
// covered by the separate pgTAP and local-stack suites; see SLICE_MANIFEST.md.
//
// No network, DB, env secret, or real Supabase client is touched: the service-role
// client factory and the @supabase/supabase-js edge are the only mocked modules, plus the
// Next.js cookies() request surface. NextResponse and the real requestCookieAccessor
// are used unmocked, so the assertions read the actual serialized Response.
//
// Login step 6, sub-slice S6-4 (the per-request check of
// execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md Sections 8 and 14):
// the request now carries the SolMind auth cookie under the shared name and the
// session-binding cookie, the session lookup's rows carry user_session_id, and an allow
// requires the binding cookie to hold the selected session's UUID. The "session binding"
// block below drives those denials through the same real path.

import { Buffer } from "node:buffer";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted doubles shared with the (hoisted) vi.mock factories below.
//   - cookiesMock: the next/headers cookies() request API.
//   - getUserMock: the Supabase Auth client's auth.getUser(token) (the WHO edge).
//   - rpcMock: the service-role client's .rpc(fn, args) (the RPC transport edge for
//     both the read lookups and the audit write).
//   - fromSpy / schemaSpy: never-called spies. The RETIRED broad PostgREST scoped-select
//     executor would have reached for client.from()/client.schema(); asserting they are
//     never called proves the enumerated RPC transport is the only path used.
//   - createServiceRoleClientMock: the service-role client factory, reconfigurable per
//     test (returns the fake client, or throws to simulate a construction failure). The
//     real composition constructs it for BOTH the read chain and the audit writer chain.
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

// Mock ONLY the @supabase/supabase-js edge (WHO). The real createSupabaseRequestAuthPrincipalSource
// still runs: it reads the public request-auth env, takes the sign-in token from the checked
// auth cookie, builds the (fake) client, calls auth.getUser(token), and maps the result to a
// principal via the real principalMapping. The service-role client is its own mocked module
// below, so this factory stands in for the request-auth client only.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
  }),
}));

// The adapter no longer imports @supabase/ssr; a client built from it here is an error.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => {
    throw new Error("the adapter must not build an @supabase/ssr client");
  },
}));

// Mock ONLY the service-role CLIENT factory (WHAT transport edge). createAdminAuthSource
// still runs the REAL createServiceRoleRpcExecutor over this fake client, and
// createAdminAuditEventWriter (the AUD-3 default) still runs the REAL
// createAuditEventWriteExecutor over it, so every dispatch is observable on rpcMock.
vi.mock("@/lib/solmind/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { GET } from "../route";

// --- Fixtures -------------------------------------------------------------------------

const PROVIDER_NAME = "supabase";
// The Supabase auth user id; principalMapping trims it into providerUserId.
const PROVIDER_USER_ID = "auth-admin-1";
const ACCOUNT_ID = "user-admin-1";

// Real system clock is used on this path (the route passes no injected now), so session
// expiry uses absolute far-future / far-past instants that stay valid/expired regardless
// of when the suite runs.
const FAR_FUTURE = "2999-12-31T23:59:59.000Z";
const FAR_PAST = "2000-01-01T00:00:00.000Z";

// The local trusted origin and the cookie names the session-cookie policy gives for it,
// and two synthetic session UUIDs: the one the lookup selects, which the request presents
// in its binding cookie, and an older one that a stale or replayed request still carries.
const TRUSTED_ORIGIN = "http://127.0.0.1:3000";
const AUTH_COOKIE = "solmind-auth";
const BINDING_COOKIE = "solmind-session";
const SESSION_ID = "5e5510a0-0000-4000-8000-0000000000d1";
const SUPERSEDED_SESSION_ID = "5e5510a0-0000-4000-8000-0000000000d2";

// The six enumerated read functions the executor must dispatch to (execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md Section 8).
const FN = {
  identity: "solmind_find_auth_provider_identity",
  account: "solmind_find_user_account",
  sessions: "solmind_find_active_user_sessions",
  role: "solmind_find_active_role_assignment",
  guide: "solmind_find_guide_profile",
  explorer: "solmind_find_explorer_profile",
} as const;

const SOLMIND_FIND_PREFIX = "solmind_find_";

// The single enumerated audit write function (AUD-1 migration
// 20260708000000_audit_event_writer_function.sql), dispatched by the AUD-3 default
// audit writer chain through the same mocked service-role client.
const AUDIT_FN = "solmind_record_audit_event";

const AUDIT_EVENT_ID = "0f9be9a6-2f7e-4e64-9f0a-5a1b2c3d4e5f";

// A secret-looking request cookie value, so leak assertions can prove it never reaches
// the response body or any audit write argument. It is a well-formed auth cookie value
// (`base64-` plus the base64url form of a JSON session), as the shared format check
// requires, and the marker inside it is what a leak of the decoded value would show.
const SECRET_MARKER = "sb-access-token-SECRET-do-not-leak";
// The session has the fields that check's field check requires; the marker sits inside
// the token, and the expiry is far ahead (the first second of the year 2100).
const SECRET_COOKIE_VALUE = `base64-${Buffer.from(
  JSON.stringify({
    access_token: `synthetic.${SECRET_MARKER}.signature`,
    refresh_token: "synthetic-refresh-token",
    expires_at: 4102444800,
  }),
  "utf8",
).toString("base64url")}`;

type RpcResponse = { data: unknown; error: unknown };

// Build the canned .rpc() responses keyed by function name for a full, valid chain in
// the given active role. The rows mirror each function's contracted RETURNS TABLE shape.
// The audit write function answers with its contracted single-row success shape.
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
          user_session_id: SESSION_ID,
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
    [AUDIT_FN]: { data: [{ audit_event_id: AUDIT_EVENT_ID }], error: null },
  };
}

// Drive the RPC transport edge from a function-name -> response map. An unlisted
// function returns an empty reachable result (error null), matching an empty table.
// failAuditWhen lets a test induce an audit-write failure for a specific audit call
// (matched on its named arguments), mirroring a forced .rpc() error (Doc 22 family 6).
function setRpcChain(
  chain: Record<string, RpcResponse>,
  failAuditWhen?: (args: Record<string, unknown>) => boolean,
): void {
  rpcMock.mockImplementation(
    (functionName: string, args: Record<string, unknown>) => {
      if (
        functionName === AUDIT_FN &&
        failAuditWhen !== undefined &&
        failAuditWhen(args)
      ) {
        return Promise.resolve({
          data: null,
          error: { message: "induced audit write failure", code: "P0001" },
        });
      }
      return Promise.resolve(chain[functionName] ?? { data: [], error: null });
    },
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
    { name: AUTH_COOKIE, value: SECRET_COOKIE_VALUE },
    { name: BINDING_COOKIE, value: SESSION_ID },
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

// Only the read-lookup calls (solmind_find_*), in call order.
function calledFindNames(): string[] {
  return calledFunctionNames().filter((name) =>
    name.startsWith(SOLMIND_FIND_PREFIX),
  );
}

// The named-argument objects of every audit write call, in call order.
function auditCallArgs(): Array<Record<string, unknown>> {
  return rpcMock.mock.calls
    .filter((call) => call[0] === AUDIT_FN)
    .map((call) => call[1] as Record<string, unknown>);
}

// The exact named arguments the AUD-3 wiring must send for each Family A row on this
// route (execution/22_SolMind_MVP0_Auth_RLS_Audit_Persistence_Contract_v0_1.md Section 8; AUD-1 baked pairs).
const EXPECTED_GUARDED_READ_ARGS = {
  p_event_type: "guarded_service_role_read",
  p_action: "read",
  p_actor_role_context: "admin",
  p_actor_user_account_id: ACCOUNT_ID,
  p_target_entity_type: "admin_route",
  p_target_entity_id: null,
  p_reason_code: "guarded_read",
  p_metadata: { routeId: "admin_route" },
};

const EXPECTED_ALLOW_DECISION_ARGS = {
  p_event_type: "admin_route_access_decision",
  p_action: "allow",
  p_actor_role_context: "admin",
  p_actor_user_account_id: ACCOUNT_ID,
  p_target_entity_type: "admin_route",
  p_target_entity_id: null,
  p_reason_code: "access_granted",
  p_metadata: { routeId: "admin_route", decision: "allow" },
};

const EXPECTED_DENY_DECISION_ARGS = {
  p_event_type: "admin_route_access_decision",
  p_action: "deny",
  p_actor_role_context: "system",
  p_actor_user_account_id: null,
  p_target_entity_type: "admin_route",
  p_target_entity_id: null,
  p_reason_code: "access_denied",
  p_metadata: { routeId: "admin_route", decision: "deny" },
};

let savedUrlEnv: string | undefined;
let savedAnonEnv: string | undefined;
let savedServiceRoleEnv: string | undefined;
let savedTrustedOriginEnv: string | undefined;

beforeEach(() => {
  cookiesMock.mockReset();
  getUserMock.mockReset();
  rpcMock.mockReset();
  fromSpy.mockReset();
  schemaSpy.mockReset();
  createServiceRoleClientMock.mockReset();

  // The real request-auth adapter validates these public (non-secret) vars eagerly.
  // The service-role KEY env is read only by the mocked client factory in production;
  // it is saved/cleared here so the mocked factory is the single service-role edge
  // and no ambient local value can bleed into the suite.
  savedUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  savedAnonEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  savedServiceRoleEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key-not-a-secret";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  // The adapter resolves the session cookie names from the trusted application origin.
  savedTrustedOriginEnv = process.env.SOLMIND_TRUSTED_APP_ORIGIN;
  process.env.SOLMIND_TRUSTED_APP_ORIGIN = TRUSTED_ORIGIN;

  // Default: present request cookies, a verified admin user, the fake service-role client
  // (rpc + never-to-be-called from/schema spies), and a valid admin RPC chain including
  // the audit write function. Individual tests override what they exercise.
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
  if (savedServiceRoleEnv === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceRoleEnv;
  }
  if (savedTrustedOriginEnv === undefined) {
    delete process.env.SOLMIND_TRUSTED_APP_ORIGIN;
  } else {
    process.env.SOLMIND_TRUSTED_APP_ORIGIN = savedTrustedOriginEnv;
  }
  vi.restoreAllMocks();
});

describe("GET /admin/access real path - valid Admin allow", () => {
  it("returns exactly { allowed: true } when the full chain and both audit writes resolve", async () => {
    const { status, contentType, body } = await invokeRoute();

    expect(status).toBe(200);
    expect(contentType).toContain("application/json");
    expect(body).toEqual({ allowed: true });
    expect(Object.keys(body as object)).toEqual(["allowed"]);
  });

  it("resolves the allow through the enumerated RPC transport only, never a broad PostgREST select", async () => {
    const { body } = await invokeRoute();
    expect(body).toEqual({ allowed: true });

    // The transport is the closed enumerated set: the six solmind_find_* read
    // lookups plus the single solmind_record_audit_event write (AUD-3). Every
    // .rpc() call uses a named-parameter args object (no schema/table/columns/
    // filters leak through), and the identity lookup that starts the chain ran.
    const names = calledFunctionNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain(FN.identity);
    for (const [functionName, args] of rpcMock.mock.calls) {
      expect(
        (functionName as string).startsWith(SOLMIND_FIND_PREFIX) ||
          functionName === AUDIT_FN,
      ).toBe(true);
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

  it("persists exactly two audit rows on an allow -- guarded-read FIRST, then the allow decision, as the final RPC calls (AUTH-RLS-DEC-029/030)", async () => {
    const { body } = await invokeRoute();
    expect(body).toEqual({ allowed: true });

    // Exactly one guarded-read write and one allow-decision write, in that order,
    // both attributed to the server-derived admin account id.
    const audits = auditCallArgs();
    expect(audits).toHaveLength(2);
    expect(audits[0]).toEqual(EXPECTED_GUARDED_READ_ARGS);
    expect(audits[1]).toEqual(EXPECTED_ALLOW_DECISION_ARGS);

    // Ordering against the read chain: both audit writes happen AFTER the record
    // lookups (post-resolution, AUTH-RLS-DEC-029) -- they are the last two calls.
    const names = calledFunctionNames();
    expect(names.slice(-2)).toEqual([AUDIT_FN, AUDIT_FN]);
  });
});

describe("GET /admin/access real path - induced audit-write failures (Doc 22 family 6)", () => {
  it("denies (opaque 200) when the guarded-read audit write fails, writing NO allow decision row", async () => {
    setRpcChain(
      rpcChain("admin"),
      (args) => args.p_event_type === "guarded_service_role_read",
    );

    const { status, body, rawText } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    // Exactly ONE audit attempt (the failed guarded read): no allow row, no
    // substitute deny row, and no auth_resolution_failure row for a write failure.
    const audits = auditCallArgs();
    expect(audits).toHaveLength(1);
    expect(audits[0].p_event_type).toBe("guarded_service_role_read");
    expect(rawText).not.toContain("induced audit write failure");
  });

  it("denies (opaque 200) when the allow-decision write fails after the guarded-read persisted, leaving exactly one truthful residual guarded-read write", async () => {
    setRpcChain(rpcChain("admin"), (args) => args.p_action === "allow");

    const { status, body, rawText } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    // Exactly TWO audit attempts: the successful guarded read (the accepted
    // truthful residual row, AUTH-RLS-DEC-030) and the failed allow decision. No
    // third row of any kind is written for the induced deny.
    const audits = auditCallArgs();
    expect(audits).toHaveLength(2);
    expect(audits[0]).toEqual(EXPECTED_GUARDED_READ_ARGS);
    expect(audits[1].p_action).toBe("allow");
    expect(rawText).not.toContain("induced audit write failure");
  });

  it("keeps a deny denied (opaque 200) when the deny-decision audit write fails (best-effort)", async () => {
    setRpcChain(rpcChain("guide"), (args) => args.p_action === "deny");

    const { status, body, rawText } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    // The failed best-effort deny write never changes the outcome and is not
    // replaced by any other row.
    const audits = auditCallArgs();
    expect(audits).toHaveLength(1);
    expect(audits[0].p_action).toBe("deny");
    expect(rawText).not.toContain("induced audit write failure");
  });
});

describe("GET /admin/access real path - fail-closed denies", () => {
  it("denies an unauthenticated request WITHOUT any service-role record read, persisting one opaque deny row", async () => {
    setNoUser();

    const { status, body } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    // A null principal denies before any record load: no solmind_find_* lookup runs.
    // The only RPC traffic is the single best-effort opaque deny decision write
    // (system context, null actor; no guarded-read row per AUTH-RLS-DEC-029).
    expect(calledFindNames()).toHaveLength(0);
    const audits = auditCallArgs();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toEqual(EXPECTED_DENY_DECISION_ARGS);
  });

  it("denies when the identity edge (getUser) errors, leaking no detail and persisting one opaque deny row", async () => {
    setGetUserError();

    const { body, rawText } = await invokeRoute();

    expect(body).toEqual({ allowed: false });
    // The fail-closed principal wrapper maps the getUser error to a null principal
    // (a clean deny, not a resolution failure): no record read, one opaque deny row.
    expect(calledFindNames()).toHaveLength(0);
    const audits = auditCallArgs();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toEqual(EXPECTED_DENY_DECISION_ARGS);
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
          user_session_id: SESSION_ID,
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
    // One of the two is the session the request presents; ambiguity still denies,
    // because no session is selected for the comparison.
    const chain = rpcChain("admin");
    chain[FN.sessions] = {
      data: [
        {
          user_session_id: SESSION_ID,
          user_account_id: ACCOUNT_ID,
          active_role_context: "admin",
          session_status: "active",
          expires_at: FAR_FUTURE,
        },
        {
          user_session_id: SUPERSEDED_SESSION_ID,
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

  it("denies a verified non-Admin with exactly one opaque deny row and NO guarded-read row (server-derived role decides)", async () => {
    // /admin authorizes on the SERVER-derived active role only (routeAccessDecision.ts:
    // requestedRole is a non-authoritative selector, and this route exposes no role
    // channel to the browser at all). A verified Guide session therefore denies, and
    // per AUTH-RLS-DEC-029 the deny persists no guarded-read row -- the opaque deny
    // decision row (system context, null actor) is the audit record.
    setRpcChain(rpcChain("guide"));

    const { body } = await invokeRoute();
    expect(body).toEqual({ allowed: false });
    const audits = auditCallArgs();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toEqual(EXPECTED_DENY_DECISION_ARGS);
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

  it("denies when the service-role client cannot be constructed (missing-config fail-closed), with no RPC traffic at all", async () => {
    // A missing/blank service-role env throws at createServiceRoleClient() inside BOTH
    // the real createAdminAuthSource and the real createAdminAuditEventWriter; the
    // composition catches both and denies opaquely. Audit persistence is unavailable,
    // so no audit call is attempted and no false failure row can exist.
    createServiceRoleClientMock.mockImplementation(() => {
      throw new Error(
        "SolMind server configuration error: required server environment variable SUPABASE_SERVICE_ROLE_KEY is missing or blank.",
      );
    });

    const { status, body, rawText } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(rawText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

// Login step 6, sub-slice S6-4: the session binding on the first guarded route, through
// the same real path, with its audit rows (contract 25 Section 8 and Section 15 item 7).
describe("GET /admin/access real path - the session binding (contract 25 Section 8)", () => {
  it("PRR-101 denies a superseded session (a different UUID in the binding cookie) with exactly one opaque deny row and NO guarded-read row", async () => {
    // The Admin's account has a newer session; this browser still presents the older
    // UUID. Everything else about the request is valid, so account selection alone
    // would allow it.
    cookiesMock.mockResolvedValue(
      cookieStore([
        { name: AUTH_COOKIE, value: SECRET_COOKIE_VALUE },
        { name: BINDING_COOKIE, value: SUPERSEDED_SESSION_ID },
      ]),
    );

    const { status, body, rawText } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    // The chain was read, and the comparison denied: one opaque deny decision row
    // (system context, null actor), no guarded-read row and no allow row.
    expect(calledFindNames()).toContain(FN.sessions);
    const audits = auditCallArgs();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toEqual(EXPECTED_DENY_DECISION_ARGS);
    expect(rawText).not.toContain(SESSION_ID);
    expect(rawText).not.toContain(SUPERSEDED_SESSION_ID);
  });

  it("PRR-102 denies a Supabase session alone (no binding cookie) without any service-role record read", async () => {
    cookiesMock.mockResolvedValue(
      cookieStore([{ name: AUTH_COOKIE, value: SECRET_COOKIE_VALUE }]),
    );

    const { body } = await invokeRoute();

    expect(body).toEqual({ allowed: false });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(calledFindNames()).toHaveLength(0);
    const audits = auditCallArgs();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toEqual(EXPECTED_DENY_DECISION_ARGS);
  });

  it("PRR-103 denies a malformed auth cookie before the library reads it, and a request that still carries only the library's default cookie name", async () => {
    for (const entries of [
      [
        { name: AUTH_COOKIE, value: `base64-${SECRET_MARKER}!` },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ],
      [
        { name: "sb-127-auth-token", value: SECRET_COOKIE_VALUE },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ],
    ]) {
      rpcMock.mockClear();
      cookiesMock.mockResolvedValue(cookieStore(entries));

      const { body, rawText } = await invokeRoute();

      expect(body).toEqual({ allowed: false });
      expect(getUserMock).not.toHaveBeenCalled();
      expect(calledFindNames()).toHaveLength(0);
      expect(rawText).not.toContain(SECRET_MARKER);
    }
  });

  it("PRR-104 allows only the selected session: after a newer login the older cookie denies and the newer one allows", async () => {
    // The lookup now returns the newer session. The browser that logged in again
    // presents its UUID and is allowed; the stale browser is not.
    const chain = rpcChain("admin");
    chain[FN.sessions] = {
      data: [
        {
          user_session_id: SUPERSEDED_SESSION_ID,
          user_account_id: ACCOUNT_ID,
          active_role_context: "admin",
          session_status: "active",
          expires_at: FAR_FUTURE,
        },
      ],
      error: null,
    };
    setRpcChain(chain);

    // Default cookies present SESSION_ID, which is no longer the selected session.
    expect((await invokeRoute()).body).toEqual({ allowed: false });

    cookiesMock.mockResolvedValue(
      cookieStore([
        { name: AUTH_COOKIE, value: SECRET_COOKIE_VALUE },
        { name: BINDING_COOKIE, value: SUPERSEDED_SESSION_ID },
      ]),
    );
    expect((await invokeRoute()).body).toEqual({ allowed: true });
  });

  it("PRR-105 denies when the session lookup's row carries no user_session_id (the pre-S6-3 row shape)", async () => {
    const chain = rpcChain("admin");
    chain[FN.sessions] = {
      data: [
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
    expect(auditCallArgs().every((args) => args.p_action === "deny")).toBe(true);
  });

  it("PRR-106 denies with no RPC traffic for records when the trusted application origin is not configured, writing one auth_resolution_failure row in place of the deny decision row", async () => {
    delete process.env.SOLMIND_TRUSTED_APP_ORIGIN;

    const { status, body, rawText } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(calledFindNames()).toHaveLength(0);
    expect(rawText).not.toContain("SOLMIND_TRUSTED_APP_ORIGIN");
    // The adapter cannot be built, which the banked composition handles as a
    // construction failure: with the audit writer available it writes one
    // auth_resolution_failure row for the request, in place of the opaque deny
    // decision row that a refused request otherwise gets.
    const audits = auditCallArgs();
    expect(audits).toHaveLength(1);
    expect(audits[0].p_event_type).toBe("auth_resolution_failure");
    expect(audits[0].p_action).toBe("deny");
    expect(audits[0].p_reason_code).toBe("auth_unresolved");

    // Every request gets that row while the origin is unusable, one with no
    // cookies at all included (with a usable origin it gets the deny decision row).
    rpcMock.mockClear();
    cookiesMock.mockResolvedValue(cookieStore([]));
    expect((await invokeRoute()).body).toEqual({ allowed: false });
    const withoutCookies = auditCallArgs();
    expect(withoutCookies).toHaveLength(1);
    expect(withoutCookies[0].p_event_type).toBe("auth_resolution_failure");
    expect(withoutCookies[0].p_reason_code).toBe("auth_unresolved");

    process.env.SOLMIND_TRUSTED_APP_ORIGIN = TRUSTED_ORIGIN;
    rpcMock.mockClear();
    expect((await invokeRoute()).body).toEqual({ allowed: false });
    expect(auditCallArgs()).toEqual([EXPECTED_DENY_DECISION_ARGS]);
  });
});

describe("GET /admin/access real path - opaque outward projection and audit privacy", () => {
  it("never serializes a request cookie value into the response body", async () => {
    const { rawText } = await invokeRoute();

    expect(rawText).not.toContain(SECRET_COOKIE_VALUE);
    expect(rawText).not.toContain("sb-access-token");
    expect(rawText).not.toContain(SECRET_MARKER);
    // Nor the session UUID from the binding cookie (contract 25 Section 14).
    expect(rawText).not.toContain(SESSION_ID);
  });

  it("never carries the request cookie value or free-form detail into any audit write argument", async () => {
    await invokeRoute();

    setNoUser();
    await invokeRoute();

    // Every audit write across the allow and deny requests carries only the bounded
    // Family A named arguments: no cookie value, no token, no free-form field.
    const serialized = JSON.stringify(
      rpcMock.mock.calls
        .filter((call) => call[0] === AUDIT_FN)
        .map((call) => call[1]),
    );
    expect(serialized).not.toContain(SECRET_COOKIE_VALUE);
    expect(serialized).not.toContain("sb-access-token");
    // The session UUID appears in no audit argument either: the rows name the account,
    // never the session.
    expect(serialized).not.toContain(SESSION_ID);
    for (const args of auditCallArgs()) {
      expect(Object.keys(args).sort()).toEqual(
        [
          "p_event_type",
          "p_action",
          "p_actor_role_context",
          "p_actor_user_account_id",
          "p_target_entity_type",
          "p_target_entity_id",
          "p_reason_code",
          "p_metadata",
        ].sort(),
      );
    }
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
