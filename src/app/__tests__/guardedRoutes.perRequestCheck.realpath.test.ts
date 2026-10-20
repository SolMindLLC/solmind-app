// Login step 6, sub-slice S6-4: the per-request check on all 8 guarded routes,
// through each route's real path.
//
// Six of the eight routes' own test files replace the request dependencies, so
// they never run the request-auth adapter or the derivation. This file drives
// every actual handler through the real composition:
//   route -> real request dependencies (or the real /admin composition)
//         -> real createSupabaseRequestAuthPrincipalSource (the cookie policy,
//            the format check, the binding cookie)
//         -> real service-role RPC executor, query client and record adapter
//         -> real deriveTrustedServerAuthContext (the binding comparison)
// faking only the three true IO edges that contract 21 Section 11 names:
// the request's cookies (next/headers), getUser (the Supabase Auth client the
// adapter builds with createClient), and the service-role client's .rpc().
//
// For each route the same request is sent three ways. With the selected
// session's own UUID the route goes on to its own work (the control). With no
// binding cookie, a malformed auth cookie, or another session's UUID it gives
// its fixed, value-free denial and never reaches its own work. Only the
// cookies differ, so each denial test fails if the check it guards is removed.
//
// Every value is synthetic. No network, database or real client is touched.

import { Buffer } from "node:buffer";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The @supabase/supabase-js factory as the adapter calls it: (url, anon key,
// options). The options hold no cookie reader, no cookie setter and no storage.
type CreateClientCall = (
  url: string,
  key: string,
  options: Record<string, unknown>,
) => { auth: { getUser: (...args: unknown[]) => Promise<unknown> } };

const {
  cookiesMock,
  getUserMock,
  createClientMock,
  createServerClientMock,
  rpcMock,
  createServiceRoleClientMock,
} = vi.hoisted(() => {
  const getUserMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
  return {
    cookiesMock: vi.fn(),
    getUserMock,
    createClientMock: vi.fn<CreateClientCall>(() => ({
      auth: { getUser: getUserMock },
    })),
    // The adapter no longer imports @supabase/ssr; this stub must never run.
    createServerClientMock: vi.fn(() => {
      throw new Error("the adapter must not build an @supabase/ssr client");
    }),
    rpcMock: vi.fn(),
    createServiceRoleClientMock: vi.fn(),
  };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("@/lib/solmind/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import {
  SUGGESTED_WAYPOINT_COMMAND_DENIED,
  SUGGESTED_WAYPOINT_COMMAND_FAILED,
} from "@/lib/solmind/suggestedWaypointCommandBrowserContract";
import {
  SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED,
  SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED,
} from "@/lib/solmind/suggestedWaypointExplorerListSharedContract";
import {
  SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
  SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED,
} from "@/lib/solmind/suggestedWaypointGuideListSharedContract";
import {
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED,
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED,
} from "@/lib/solmind/supabase/suggestedWaypointRelationshipSelectorRequest";

import { GET as adminAccessGet } from "../admin/access/route";
import { POST as explorerCommandsPost } from "../explorer/waypoints/[suggestedWaypointId]/commands/route";
import { GET as explorerDetailGet } from "../explorer/waypoints/[suggestedWaypointId]/detail/route";
import { GET as explorerSuggestionsGet } from "../explorer/waypoints/suggestions/route";
import { GET as guideDetailGet } from "../guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]/detail/route";
import { POST as guideCommandsPost } from "../guide/waypoint-suggestions/[relationshipId]/commands/route";
import { GET as guideSuggestionsGet } from "../guide/waypoint-suggestions/[relationshipId]/suggestions/route";
import { GET as guideRelationshipsGet } from "../guide/waypoint-suggestions/relationships/route";

type Role = "admin" | "guide" | "explorer";
type RpcResponse = { data: unknown; error: unknown };

const TRUSTED_ORIGIN = "http://127.0.0.1:3000";
const AUTH_COOKIE = "solmind-auth";
const BINDING_COOKIE = "solmind-session";

const PROVIDER_USER_ID = "auth-user-1";
const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const GUIDE_PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const EXPLORER_PROFILE_ID = "33333333-3333-4333-8333-333333333333";
const RELATIONSHIP_ID = "44444444-4444-4444-8444-444444444444";
const SUGGESTION_ID = "55555555-5555-4555-8555-555555555555";
const OPERATION_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "77777777-7777-4777-8777-777777777777";

// The session the lookup selects, and the one an older login left in a stale
// browser (or that a replayed request still carries).
const SELECTED_SESSION_ID = "5e5510a0-0000-4000-8000-0000000000c1";
const SUPERSEDED_SESSION_ID = "5e5510a0-0000-4000-8000-0000000000c2";
const FAR_FUTURE = "2999-12-31T23:59:59.000Z";
const FAR_PAST = "2000-01-01T00:00:00.000Z";

const SECRET_MARKER = "SYNTHETIC-TOKEN-do-not-leak";
// A well-formed auth cookie value: a synthetic session with the fields the
// shared format check requires. The marker sits inside the token, and the
// expiry is far ahead (the first second of the year 2100), so no test here
// depends on the clock.
const ACCESS_TOKEN = `synthetic.${SECRET_MARKER}.signature`;
const AUTH_VALUE = `base64-${Buffer.from(
  JSON.stringify({
    access_token: ACCESS_TOKEN,
    refresh_token: "synthetic-refresh-token",
    expires_at: 4102444800,
  }),
  "utf8",
).toString("base64url")}`;
// The one options object the adapter gives createClient (contract 25 Sections
// 7 and 8): no cookie reader, no cookie setter, no storage.
const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    skipAutoInitialize: true,
  },
};

const FIND_PREFIX = "solmind_find_";
const FN = {
  identity: "solmind_find_auth_provider_identity",
  account: "solmind_find_user_account",
  sessions: "solmind_find_active_user_sessions",
  role: "solmind_find_active_role_assignment",
  guide: "solmind_find_guide_profile",
  explorer: "solmind_find_explorer_profile",
  relationship: "solmind_find_guide_explorer_relationship",
  audit: "solmind_record_audit_event",
} as const;

// The record chain for one account whose single active session has the given
// role, UUID and expiry. Anything a route asks for beyond the lookups (its own
// function) is answered with an error, so a route that got past the check
// reports its fixed failure, never its denial.
function recordChain(
  role: Role,
  session: { id: string; expiresAt: string } = { id: SELECTED_SESSION_ID, expiresAt: FAR_FUTURE },
): Record<string, RpcResponse> {
  return {
    [FN.identity]: {
      data: [
        {
          user_account_id: ACCOUNT_ID,
          provider_name: "supabase",
          provider_user_id: PROVIDER_USER_ID,
          status: "active",
        },
      ],
      error: null,
    },
    [FN.account]: { data: [{ user_account_id: ACCOUNT_ID, account_status: "active" }], error: null },
    [FN.sessions]: {
      data: [
        {
          user_session_id: session.id,
          user_account_id: ACCOUNT_ID,
          active_role_context: role,
          session_status: "active",
          expires_at: session.expiresAt,
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
            data: [{ guide_profile_id: GUIDE_PROFILE_ID, user_account_id: ACCOUNT_ID, status: "active" }],
            error: null,
          }
        : { data: [], error: null },
    [FN.explorer]:
      role === "explorer"
        ? {
            data: [
              { explorer_profile_id: EXPLORER_PROFILE_ID, user_account_id: ACCOUNT_ID, status: "active" },
            ],
            error: null,
          }
        : { data: [], error: null },
    [FN.relationship]: {
      data: [
        {
          guide_explorer_relationship_id: RELATIONSHIP_ID,
          guide_profile_id: GUIDE_PROFILE_ID,
          explorer_profile_id: EXPLORER_PROFILE_ID,
          relationship_status: "active",
        },
      ],
      error: null,
    },
    [FN.audit]: { data: [{ audit_event_id: "0f9be9a6-2f7e-4e64-9f0a-5a1b2c3d4e5f" }], error: null },
  };
}

function setRecordChain(chain: Record<string, RpcResponse>): void {
  rpcMock.mockImplementation((functionName: string) =>
    Promise.resolve(
      chain[functionName] ?? { data: null, error: { message: "the route's own function is not answered here" } },
    ),
  );
}

function calledNames(): string[] {
  return rpcMock.mock.calls.map((call) => call[0] as string);
}

// The lookups of the auth chain, and everything else: the route's own work
// (its function, or for /admin/access its audit rows).
function lookupCalls(): string[] {
  return calledNames().filter((name) => name.startsWith(FIND_PREFIX));
}
function ownWorkCalls(): string[] {
  return calledNames().filter((name) => !name.startsWith(FIND_PREFIX) && name !== FN.audit);
}

type CookieEntry = { name: string; value: string };

const cookieSetSpy = vi.fn();
const cookieDeleteSpy = vi.fn();

function presentCookies(entries: CookieEntry[]): void {
  cookiesMock.mockResolvedValue({
    getAll: () => entries.map((entry) => ({ name: entry.name, value: entry.value })),
    // A route must never write, refresh or clear a cookie on this path.
    set: cookieSetSpy,
    delete: cookieDeleteSpy,
  });
}

function validCookies(sessionId: string = SELECTED_SESSION_ID): CookieEntry[] {
  return [
    { name: AUTH_COOKIE, value: AUTH_VALUE },
    { name: BINDING_COOKIE, value: sessionId },
  ];
}

function getRequest(path: string): NextRequest {
  return new NextRequest(`${TRUSTED_ORIGIN}${path}`);
}

function postRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`${TRUSTED_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: TRUSTED_ORIGIN,
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

type GuardedRoute = Readonly<{
  name: string;
  role: Role;
  invoke: () => Promise<Response>;
  // The route's fixed outward denial, and what it answers once it is past the
  // check and its own function (or audit write) fails.
  denied: (body: unknown) => void;
  pastTheCheck: (body: unknown) => void;
  // What the route answers when the trusted origin is not configured.
  misconfigured: (body: unknown) => void;
}>;

function errorOf(body: unknown): unknown {
  return (body as { ok?: unknown; error?: unknown }).error;
}

function suggestedWaypointRoute(args: {
  name: string;
  role: "guide" | "explorer";
  invoke: () => Promise<Response>;
  denied: string;
  failed: string;
}): GuardedRoute {
  return {
    name: args.name,
    role: args.role,
    invoke: args.invoke,
    denied: (body) => {
      expect((body as { ok: unknown }).ok).toBe(false);
      expect(errorOf(body)).toBe(args.denied);
    },
    pastTheCheck: (body) => {
      expect((body as { ok: unknown }).ok).toBe(false);
      expect(errorOf(body)).toBe(args.failed);
      expect(ownWorkCalls().length).toBeGreaterThan(0);
    },
    misconfigured: (body) => {
      expect((body as { ok: unknown }).ok).toBe(false);
      expect(errorOf(body)).toBe(args.failed);
    },
  };
}

const ROUTES: ReadonlyArray<GuardedRoute> = [
  {
    name: "GET /admin/access",
    role: "admin",
    invoke: () => adminAccessGet(),
    denied: (body) => {
      expect(body).toEqual({ allowed: false });
      // A denial writes at most the opaque deny row: never the guarded-read
      // row or the allow row, and never an actor.
      for (const [name, args] of rpcMock.mock.calls) {
        if (name === FN.audit) {
          expect((args as { p_action: unknown }).p_action).toBe("deny");
          expect((args as { p_actor_user_account_id: unknown }).p_actor_user_account_id).toBeNull();
        }
      }
    },
    pastTheCheck: (body) => {
      expect(body).toEqual({ allowed: true });
      expect(calledNames().filter((name) => name === FN.audit)).toHaveLength(2);
    },
    misconfigured: (body) => expect(body).toEqual({ allowed: false }),
  },
  suggestedWaypointRoute({
    name: "GET /explorer/waypoints/suggestions",
    role: "explorer",
    invoke: () => explorerSuggestionsGet(getRequest("/explorer/waypoints/suggestions?pageSize=10")),
    denied: SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED,
    failed: SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED,
  }),
  suggestedWaypointRoute({
    name: "GET /explorer/waypoints/[suggestedWaypointId]/detail",
    role: "explorer",
    invoke: () =>
      explorerDetailGet(getRequest(`/explorer/waypoints/${SUGGESTION_ID}/detail`), {
        params: Promise.resolve({ suggestedWaypointId: SUGGESTION_ID }),
      }),
    denied: SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED,
    failed: SUGGESTED_WAYPOINT_EXPLORER_LIST_FAILED,
  }),
  suggestedWaypointRoute({
    name: "POST /explorer/waypoints/[suggestedWaypointId]/commands",
    role: "explorer",
    invoke: () =>
      explorerCommandsPost(
        postRequest(`/explorer/waypoints/${SUGGESTION_ID}/commands`, {
          kind: "explorer.mark_read",
          operationId: OPERATION_ID,
          versionId: VERSION_ID,
        }),
        { params: Promise.resolve({ suggestedWaypointId: SUGGESTION_ID }) },
      ),
    denied: SUGGESTED_WAYPOINT_COMMAND_DENIED,
    failed: SUGGESTED_WAYPOINT_COMMAND_FAILED,
  }),
  suggestedWaypointRoute({
    name: "GET /guide/waypoint-suggestions/relationships",
    role: "guide",
    invoke: () => guideRelationshipsGet(getRequest("/guide/waypoint-suggestions/relationships?pageSize=10")),
    denied: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED,
    failed: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FAILED,
  }),
  suggestedWaypointRoute({
    name: "GET /guide/waypoint-suggestions/[relationshipId]/suggestions",
    role: "guide",
    invoke: () =>
      guideSuggestionsGet(
        getRequest(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions?pageSize=10`),
        { params: Promise.resolve({ relationshipId: RELATIONSHIP_ID }) },
      ),
    denied: SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
    failed: SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED,
  }),
  suggestedWaypointRoute({
    name: "GET /guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]/detail",
    role: "guide",
    invoke: () =>
      guideDetailGet(
        getRequest(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}/${SUGGESTION_ID}/detail`),
        {
          params: Promise.resolve({
            relationshipId: RELATIONSHIP_ID,
            suggestedWaypointId: SUGGESTION_ID,
          }),
        },
      ),
    denied: SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
    failed: SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED,
  }),
  suggestedWaypointRoute({
    name: "POST /guide/waypoint-suggestions/[relationshipId]/commands",
    role: "guide",
    invoke: () =>
      guideCommandsPost(
        postRequest(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}/commands`, {
          kind: "guide.create_draft",
          operationId: OPERATION_ID,
          destination: "Protect one evening for recovery",
          why: "Create dependable recovery space.",
          arrivalSignals: ["One evening remains unscheduled."],
        }),
        { params: Promise.resolve({ relationshipId: RELATIONSHIP_ID }) },
      ),
    denied: SUGGESTED_WAYPOINT_COMMAND_DENIED,
    failed: SUGGESTED_WAYPOINT_COMMAND_FAILED,
  }),
];

async function answer(route: GuardedRoute): Promise<{ body: unknown; rawText: string; response: Response }> {
  const response = await route.invoke();
  const rawText = await response.clone().text();
  return { body: await response.json(), rawText, response };
}

// A denial never carries a cookie value, a token or a session UUID, and never
// sets a cookie.
function expectValueFree(rawText: string, response: Response): void {
  expect(rawText).not.toContain(SECRET_MARKER);
  expect(rawText).not.toContain(AUTH_VALUE);
  expect(rawText).not.toContain(SELECTED_SESSION_ID);
  expect(rawText).not.toContain(SUPERSEDED_SESSION_ID);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(cookieSetSpy).not.toHaveBeenCalled();
  expect(cookieDeleteSpy).not.toHaveBeenCalled();
}

const ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SOLMIND_TRUSTED_APP_ORIGIN",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const savedEnv: Record<string, string | undefined> = {};
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
let consoleSpies: Array<ReturnType<typeof vi.spyOn>> = [];

beforeEach(() => {
  cookiesMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockClear();
  createServerClientMock.mockClear();
  rpcMock.mockReset();
  createServiceRoleClientMock.mockReset();
  cookieSetSpy.mockReset();
  cookieDeleteSpy.mockReset();

  for (const name of ENV_NAMES) {
    savedEnv[name] = process.env[name];
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key-not-a-secret";
  process.env.SOLMIND_TRUSTED_APP_ORIGIN = TRUSTED_ORIGIN;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  getUserMock.mockResolvedValue({ data: { user: { id: PROVIDER_USER_ID } }, error: null });
  createServiceRoleClientMock.mockReturnValue({ rpc: rpcMock });
  presentCookies(validCookies());
  consoleSpies = CONSOLE_METHODS.map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined),
  );
});

afterEach(() => {
  const logged = consoleSpies.map((spy) => spy.mock.calls.length);
  for (const spy of consoleSpies) {
    spy.mockRestore();
  }
  for (const name of ENV_NAMES) {
    if (savedEnv[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = savedEnv[name];
    }
  }
  // With the library replaced, as it is in this file, nothing on this path
  // logs, whatever the request carried. What the real library prints of its
  // own is shown in requestAuthClient.realLibrary.test.ts and
  // requestAuthClient.directToken.realLibrary.test.ts.
  expect(logged).toEqual(CONSOLE_METHODS.map(() => 0));
  // No route reaches an @supabase/ssr client, and whenever a route asked the
  // library anything it asked getUser with the token and nothing else.
  expect(createServerClientMock.mock.calls.length).toBe(0);
  for (const call of getUserMock.mock.calls) {
    expect(call).toEqual([ACCESS_TOKEN]);
  }
});

// One block per route. A plain loop, not describe.each: its "$name" form
// shortens a long route name, and two of the eight would then share one title.
ROUTES.forEach((route) => describe(`per-request check on ${route.name} (contract 25 Sections 8 and 14; items 6, 7 and 11)`, () => {
  beforeEach(() => {
    setRecordChain(recordChain(route.role));
  });

  it("PRR-001 control: with the selected session's own UUID the request passes the check and the route goes on to its own work", async () => {
    const { body } = await answer(route);

    route.pastTheCheck(body);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock.mock.calls[0][2]).toEqual(CLIENT_OPTIONS);
    expect(getUserMock.mock.calls).toEqual([[ACCESS_TOKEN]]);
    expect(lookupCalls()).toContain(FN.sessions);
  });

  it("PRR-002 a Supabase session alone is refused: no binding cookie, so no client is built and no record is read", async () => {
    presentCookies([{ name: AUTH_COOKIE, value: AUTH_VALUE }]);

    const { body, rawText, response } = await answer(route);

    route.denied(body);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(lookupCalls()).toEqual([]);
    expect(ownWorkCalls()).toEqual([]);
    expectValueFree(rawText, response);
  });

  it("PRR-003 a malformed auth cookie is refused before the library reads it: no client, no record read, nothing logged", async () => {
    for (const malformed of [
      `base64-${SECRET_MARKER}!`,
      `not-base64-${SECRET_MARKER}`,
      // Bytes that are not valid UTF-8: the library's decoder would name a
      // number derived from the cookie in the error it passes to its warning.
      "base64-9YCAgA",
    ]) {
      rpcMock.mockClear();
      presentCookies([
        { name: AUTH_COOKIE, value: malformed },
        { name: BINDING_COOKIE, value: SELECTED_SESSION_ID },
      ]);

      const { body, rawText, response } = await answer(route);

      route.denied(body);
      expect(createClientMock).not.toHaveBeenCalled();
      expect(getUserMock).not.toHaveBeenCalled();
      expect(lookupCalls()).toEqual([]);
      expect(ownWorkCalls()).toEqual([]);
      expectValueFree(rawText, response);
    }
  });

  it("PRR-004 a superseded session is refused: the browser presents an older UUID, whether the newer login kept the role or changed it to this route's role", async () => {
    // The lookup returns only the newer session. A stale tab, in the same role
    // or left over from another role, still presents the UUID it was given.
    // Selecting by account alone would let it act under the newer session.
    presentCookies(validCookies(SUPERSEDED_SESSION_ID));

    const { body, rawText, response } = await answer(route);

    route.denied(body);
    // The request was verified and the records were read; the comparison is
    // what denied it.
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(lookupCalls()).toContain(FN.sessions);
    expect(ownWorkCalls()).toEqual([]);
    expectValueFree(rawText, response);
  });

  it("PRR-005 a session UUID that is not the selected one is refused in every other form too", async () => {
    for (const presented of [
      "00000000-0000-0000-0000-000000000000",
      SELECTED_SESSION_ID.toUpperCase(),
      `${SELECTED_SESSION_ID}0`,
      ACCOUNT_ID,
    ]) {
      rpcMock.mockClear();
      presentCookies(validCookies(presented));

      const { body, rawText, response } = await answer(route);

      route.denied(body);
      expect(ownWorkCalls()).toEqual([]);
      expectValueFree(rawText, response);
    }
  });

  it("PRR-006 a late or replayed cookie still denies once the session has expired, and the library is handed no cookie setter (item 6)", async () => {
    // The cookies are the right ones, sent after the SolMind session's end
    // (a client that ignores Max-Age, or a captured request). The adapter
    // hands the library the token and no function at all, so there is no
    // cookie setter for anything to reach; the route's own cookie store is
    // not written (expectValueFree checks its set and delete).
    setRecordChain(recordChain(route.role, { id: SELECTED_SESSION_ID, expiresAt: FAR_PAST }));

    const { body, rawText, response } = await answer(route);

    route.denied(body);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(getUserMock.mock.calls).toEqual([[ACCESS_TOKEN]]);
    expect(createClientMock.mock.calls[0][2]).toEqual(CLIENT_OPTIONS);
    const handed = JSON.stringify(createClientMock.mock.calls[0], (_key, value: unknown) =>
      typeof value === "function" ? "a function was handed to the library" : value,
    );
    expect(handed).not.toContain("a function was handed to the library");
    expect(lookupCalls()).toContain(FN.sessions);
    expect(ownWorkCalls()).toEqual([]);
    expectValueFree(rawText, response);
  });

  it("PRR-007 the binding UUID grants nothing on its own: with the right UUID but no verified Supabase user, no record is read", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "session missing" } });

    const { body, rawText, response } = await answer(route);

    route.denied(body);
    expect(lookupCalls()).toEqual([]);
    expect(ownWorkCalls()).toEqual([]);
    expectValueFree(rawText, response);
  });

  it("PRR-008 without a usable trusted origin the route fails closed with its fixed result and reads nothing", async () => {
    for (const origin of [undefined, "http://192.168.1.20:3000"]) {
      rpcMock.mockClear();
      if (origin === undefined) {
        delete process.env.SOLMIND_TRUSTED_APP_ORIGIN;
      } else {
        process.env.SOLMIND_TRUSTED_APP_ORIGIN = origin;
      }

      const { body, rawText, response } = await answer(route);

      // POST routes compare Origin with the trusted origin first, so a wrong
      // one is their fixed denial; everything else is the fixed
      // misconfiguration answer.
      if (origin !== undefined && route.name.startsWith("POST ")) {
        route.denied(body);
      } else {
        route.misconfigured(body);
      }
      expect(createClientMock).not.toHaveBeenCalled();
      expect(lookupCalls()).toEqual([]);
      expect(ownWorkCalls()).toEqual([]);
      expectValueFree(rawText, response);
    }
  });
}));
