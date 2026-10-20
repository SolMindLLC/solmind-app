import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @supabase/supabase-js so no real Supabase project, network, cookies, or
// headers are touched. vi.hoisted gives the (hoisted) vi.mock factory access to
// the shared getUser/createClient stubs. @supabase/ssr is mocked as well, with
// a stub that must never run: the adapter no longer imports that package.
const { getUser, createClientMock, createServerClientMock } = vi.hoisted(() => {
  const getUser = vi.fn<(...args: unknown[]) => Promise<unknown>>();
  // Typed parameter signature so createClientMock.mock.calls[0] is captured
  // as a [url, key, options] tuple rather than an empty tuple.
  const createClientMock = vi.fn(
    (_url: string, _key: string, _options: Record<string, unknown>) => ({ auth: { getUser } }),
  );
  const createServerClientMock = vi.fn(() => {
    throw new Error("the adapter must not build an @supabase/ssr client");
  });
  return { getUser, createClientMock, createServerClientMock };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import {
  createInMemoryRequestCookieAccessor,
  type RequestCookie,
  type RequestCookieAccessor,
} from "../../auth/requestCookieAccessor";
import { SOLMIND_TRUSTED_APP_ORIGIN_ENV } from "../../auth/trustedApplicationOrigin";
import {
  REQUEST_AUTH_ANON_KEY_ENV,
  REQUEST_AUTH_SESSION_COOKIE_POLICY_UNAVAILABLE,
  REQUEST_AUTH_URL_ENV,
  createSupabaseRequestAuthPrincipalSource,
} from "../requestAuthClient";
import * as supabaseBarrel from "../index";

const AUTH_USER_ID = "11111111-1111-1111-1111-111111111111";

// The local (loopback) trusted origin and the cookie names the session-cookie
// policy gives for it (contract 25 Section 5.2). Every value is synthetic.
const LOOPBACK_ORIGIN = "http://127.0.0.1:3000";
const AUTH_COOKIE = "solmind-auth";
const BINDING_COOKIE = "solmind-session";
const HOSTED_ORIGIN = "https://uat.solmind.example";
const HOSTED_AUTH_COOKIE = "__Host-solmind-auth";
const HOSTED_BINDING_COOKIE = "__Host-solmind-session";

const SESSION_ID = "5e5510a0-0000-4000-8000-0000000000a1";
const OTHER_SESSION_ID = "5e5510a0-0000-4000-8000-0000000000a2";

// A well-formed auth cookie value, as the library writes one: `base64-` plus the
// base64url form of a JSON session, with the fields the shared format check's
// field check requires. The marker sits inside the token and lets a test prove
// that no part of the value reaches an error, a log or a result. The expiry is
// far ahead (the first second of the year 2100), so no test here depends on
// the clock.
const SECRET_MARKER = "SYNTHETIC-TOKEN-do-not-leak";
const RENEWAL_TOKEN = "synthetic-refresh-token";
const FAR_FUTURE_EXPIRES_AT = 4102444800;
function sessionText(session: Record<string, unknown>): string {
  return `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
}
// The sign-in token inside the fixture's session: the one thing of the cookie
// that the adapter hands to the library.
function tokenOf(marker: string = SECRET_MARKER): string {
  return `synthetic.${marker}.signature`;
}
function authValue(marker: string = SECRET_MARKER): string {
  return sessionText({
    access_token: tokenOf(marker),
    refresh_token: RENEWAL_TOKEN,
    expires_at: FAR_FUTURE_EXPIRES_AT,
  });
}
const AUTH_VALUE = authValue();
const ACCESS_TOKEN = tokenOf();

// The one options object the adapter may give createClient (contract 25
// Sections 7 and 8): no cookie reader, no cookie setter, no storage.
const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    skipAutoInitialize: true,
  },
};

// Every function found anywhere inside a value (own enumerable properties).
function functionsIn(value: unknown, path: string = "options"): string[] {
  if (typeof value === "function") {
    return [path];
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, item]) => functionsIn(item, `${path}.${key}`));
}

function requestCookies(overrides: RequestCookie[] | null = null): RequestCookie[] {
  return (
    overrides ?? [
      { name: AUTH_COOKIE, value: AUTH_VALUE },
      { name: BINDING_COOKIE, value: SESSION_ID },
    ]
  );
}

function source(cookies: RequestCookie[] = requestCookies()) {
  return createSupabaseRequestAuthPrincipalSource({
    cookies: createInMemoryRequestCookieAccessor(cookies),
  });
}

function verifiedUser(id: string = AUTH_USER_ID): void {
  getUser.mockResolvedValue({ data: { user: { id } }, error: null });
}

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
let consoleSpies: Array<ReturnType<typeof vi.spyOn>> = [];

beforeEach(() => {
  process.env[REQUEST_AUTH_URL_ENV] = "https://example.supabase.co";
  process.env[REQUEST_AUTH_ANON_KEY_ENV] = "anon-key";
  process.env[SOLMIND_TRUSTED_APP_ORIGIN_ENV] = LOOPBACK_ORIGIN;
  // The request-auth path must never depend on the service-role secret.
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  getUser.mockReset();
  createClientMock.mockClear();
  createServerClientMock.mockClear();
  consoleSpies = CONSOLE_METHODS.map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined),
  );
});

afterEach(() => {
  // Nothing in this module may log, whatever the request carried.
  const logged = consoleSpies.map((spy) => spy.mock.calls.length);
  for (const spy of consoleSpies) {
    spy.mockRestore();
  }
  expect(logged).toEqual(CONSOLE_METHODS.map(() => 0));
  // No test here may reach an @supabase/ssr client through the adapter.
  expect(createServerClientMock.mock.calls.length).toBe(0);
  // Whenever the adapter asked the library anything, it asked getUser with
  // exactly one argument (the token), never with none.
  for (const call of getUser.mock.calls) {
    expect(call.length).toBe(1);
    expect(typeof call[0]).toBe("string");
  }
  delete process.env[REQUEST_AUTH_URL_ENV];
  delete process.env[REQUEST_AUTH_ANON_KEY_ENV];
  delete process.env[SOLMIND_TRUSTED_APP_ORIGIN_ENV];
});

describe("createSupabaseRequestAuthPrincipalSource - identity resolution", () => {
  it("maps a verified Supabase user to SupabaseAuthenticatedUser, with the session UUID the request presented", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: AUTH_USER_ID, email: "person@example.com" } },
      error: null,
    });

    await expect(source().resolveAuthenticatedUser()).resolves.toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
      presentedSessionId: SESSION_ID,
    });
  });

  it("returns null when getUser returns an error", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid or expired session" },
    });

    await expect(source().resolveAuthenticatedUser()).resolves.toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("returns null when there is no verified user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(source().resolveAuthenticatedUser()).resolves.toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("returns null for a blank user id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "   " } }, error: null });

    await expect(source().resolveAuthenticatedUser()).resolves.toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("fails closed (null) and does not rethrow when getUser rejects", async () => {
    getUser.mockRejectedValue(
      new Error("token-bearing failure that must not leak"),
    );

    await expect(source().resolveAuthenticatedUser()).resolves.toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});

describe("createSupabaseRequestAuthPrincipalSource - configuration", () => {
  it("throws a value-free config error at construction when the public URL is missing", () => {
    delete process.env[REQUEST_AUTH_URL_ENV];

    try {
      source();
      throw new Error("expected a configuration error to be thrown");
    } catch (caught) {
      const message = (caught as Error).message;
      expect(message).toContain(REQUEST_AUTH_URL_ENV);
      // The error must name the variable but never echo its (here, the anon-key) value.
      expect(message).not.toContain("anon-key");
    }
    // Construction failed before building any Supabase client.
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("throws a value-free config error at construction when the anon key is missing", () => {
    delete process.env[REQUEST_AUTH_ANON_KEY_ENV];

    try {
      source();
      throw new Error("expected a configuration error to be thrown");
    } catch (caught) {
      const message = (caught as Error).message;
      expect(message).toContain(REQUEST_AUTH_ANON_KEY_ENV);
      expect(message).not.toContain("https://example.supabase.co");
    }
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("does not require the service-role key to resolve a principal", async () => {
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    verifiedUser();

    await expect(source().resolveAuthenticatedUser()).resolves.not.toBeNull();
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  it("PRA-001 throws one fixed, value-free error at construction when the session-cookie policy cannot be resolved", () => {
    // A missing or malformed trusted origin, and a plain-http origin that is
    // not a loopback address (contract 25 Section 4: a configuration failure).
    const refused: Array<string | undefined> = [
      undefined,
      "",
      "not an origin",
      "http://192.168.1.20:3000",
      "http://solmind.example",
      "https://uat.solmind.example/path",
      "ftp://127.0.0.1",
    ];
    for (const origin of refused) {
      if (origin === undefined) {
        delete process.env[SOLMIND_TRUSTED_APP_ORIGIN_ENV];
      } else {
        process.env[SOLMIND_TRUSTED_APP_ORIGIN_ENV] = origin;
      }
      let message: string | null = null;
      try {
        source();
      } catch (caught) {
        message = (caught as Error).message;
      }
      expect(message, String(origin)).toBe(REQUEST_AUTH_SESSION_COOKIE_POLICY_UNAVAILABLE);
    }
    // The fixed message carries no origin and no cookie value.
    expect(REQUEST_AUTH_SESSION_COOKIE_POLICY_UNAVAILABLE).not.toMatch(/127|192|example|http/);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe("createSupabaseRequestAuthPrincipalSource - the Supabase client it builds (contract 25 Sections 7 and 8)", () => {
  it("passes the public URL and key to createClient, with no cookie reader, no cookie setter and no storage", async () => {
    verifiedUser();

    await source().resolveAuthenticatedUser();

    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createClientMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("anon-key");
    expect(options).toEqual(CLIENT_OPTIONS);
    // No function of any kind is handed to the library: nothing it could call
    // to read a cookie, to set one, or to store a session.
    expect(functionsIn(options)).toEqual([]);
    expect(createClientMock.mock.calls[0].length).toBe(3);
  });

  it("PRA-002 reads the auth cookie under the shared name, for the local and the hosted policy, and gives the library no cookie name (contract 25 Section 5.2; item 4)", async () => {
    verifiedUser();
    await source().resolveAuthenticatedUser();
    expect(createClientMock.mock.calls[0][2]).toEqual(CLIENT_OPTIONS);
    expect(getUser.mock.calls).toEqual([[ACCESS_TOKEN]]);

    createClientMock.mockClear();
    getUser.mockClear();
    process.env[SOLMIND_TRUSTED_APP_ORIGIN_ENV] = HOSTED_ORIGIN;
    const hostedValue = authValue("HOSTED-TOKEN-do-not-leak");
    await expect(
      source([
        { name: HOSTED_AUTH_COOKIE, value: hostedValue },
        { name: HOSTED_BINDING_COOKIE, value: SESSION_ID },
      ]).resolveAuthenticatedUser(),
    ).resolves.toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
      presentedSessionId: SESSION_ID,
    });
    // The same options for the hosted policy: the cookie's name is the
    // adapter's to read, and the library is told nothing about it.
    expect(createClientMock.mock.calls[0][2]).toEqual(CLIENT_OPTIONS);
    expect(JSON.stringify(createClientMock.mock.calls[0])).not.toContain("solmind-auth");
    expect(getUser.mock.calls).toEqual([[tokenOf("HOSTED-TOKEN-do-not-leak")]]);

    // The other environment's names are not read: hosted names on the local
    // origin, and local names on the hosted origin, find nothing.
    createClientMock.mockClear();
    getUser.mockClear();
    await expect(source().resolveAuthenticatedUser()).resolves.toBeNull();
    process.env[SOLMIND_TRUSTED_APP_ORIGIN_ENV] = LOOPBACK_ORIGIN;
    await expect(
      source([
        { name: HOSTED_AUTH_COOKIE, value: AUTH_VALUE },
        { name: HOSTED_BINDING_COOKIE, value: SESSION_ID },
      ]).resolveAuthenticatedUser(),
    ).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("PRA-003 hands the library the checked auth cookie's sign-in token and nothing else of any request cookie", async () => {
    verifiedUser();
    const whole = AUTH_VALUE;
    const first = whole.slice(0, 20);
    const second = whole.slice(20);
    const VERIFIER = "base64-verifier-not-for-the-library";
    const DEFAULT_NAME_VALUE = authValue("DEFAULT-NAME-TOKEN-not-read");

    await source([
      { name: "unrelated", value: "unrelated-value-not-for-the-library" },
      { name: `${AUTH_COOKIE}.0`, value: first },
      { name: `${AUTH_COOKIE}.1`, value: second },
      { name: `${AUTH_COOKIE}-code-verifier`, value: VERIFIER },
      { name: "sb-127-auth-token", value: DEFAULT_NAME_VALUE },
      { name: BINDING_COOKIE, value: SESSION_ID },
    ]).resolveAuthenticatedUser();

    // The client is built from the two public settings and the fixed options.
    expect(createClientMock.mock.calls).toEqual([
      ["https://example.supabase.co", "anon-key", CLIENT_OPTIONS],
    ]);
    // The one call: getUser with the token of the joined, checked cookie.
    expect(getUser.mock.calls).toEqual([[ACCESS_TOKEN]]);
    // Nothing else of the request reaches either call: no cookie value, whole
    // or in chunks, no renewal token, no expiry, no other cookie, and not the
    // session UUID.
    const handed = JSON.stringify([createClientMock.mock.calls, getUser.mock.calls]);
    for (const kept of [
      whole,
      first,
      second,
      RENEWAL_TOKEN,
      String(FAR_FUTURE_EXPIRES_AT),
      VERIFIER,
      DEFAULT_NAME_VALUE,
      "DEFAULT-NAME-TOKEN-not-read",
      "unrelated-value-not-for-the-library",
      SESSION_ID,
      AUTH_COOKIE,
    ]) {
      expect(handed, kept).not.toContain(kept);
    }
  });

  it("PRA-004 reads the request's cookies once", async () => {
    verifiedUser();
    const getAll = vi.fn(() => requestCookies());
    const setAll = vi.fn();
    const accessor: RequestCookieAccessor = { getAll, setAll };

    await expect(
      createSupabaseRequestAuthPrincipalSource({ cookies: accessor }).resolveAuthenticatedUser(),
    ).resolves.not.toBeNull();

    expect(getAll).toHaveBeenCalledTimes(1);
    expect(setAll).not.toHaveBeenCalled();
  });

  it("PRA-005 nothing reaches the accessor's setAll, whatever the library's call does (contract 25 Sections 7 and 8; item 6)", async () => {
    // The adapter gives the library no cookie setter and never calls the
    // accessor's own. Whatever getUser(token) answers (a user, no user, an
    // error, a rejection), nothing is handed to the accessor, the request's
    // cookies are unchanged, and a verified user still resolves so that the
    // SolMind session decides.
    const answers: Array<[string, () => Promise<unknown>, boolean]> = [
      ["a user", async () => ({ data: { user: { id: AUTH_USER_ID } }, error: null }), true],
      ["no user", async () => ({ data: { user: null }, error: null }), false],
      ["an error", async () => ({ data: { user: null }, error: { message: "refused" } }), false],
      ["a rejection", async () => Promise.reject(new Error("rejected")), false],
    ];
    for (const [label, answer, allowed] of answers) {
      const accessorSetAll = vi.fn();
      const stored = requestCookies();
      const accessor: RequestCookieAccessor = {
        getAll: () => stored.map((cookie) => ({ ...cookie })),
        setAll: accessorSetAll,
      };
      createClientMock.mockClear();
      getUser.mockReset();
      getUser.mockImplementation(answer);

      const principal = await createSupabaseRequestAuthPrincipalSource({
        cookies: accessor,
      }).resolveAuthenticatedUser();
      expect(principal === null, label).toBe(!allowed);
      expect(accessorSetAll, label).not.toHaveBeenCalled();
      expect(stored, label).toEqual(requestCookies());
      expect(functionsIn(createClientMock.mock.calls[0][2]), label).toEqual([]);
      expect(getUser.mock.calls, label).toEqual([[ACCESS_TOKEN]]);
    }

    // With the real read-only accessor the request's cookies are unchanged too.
    createClientMock.mockClear();
    getUser.mockReset();
    verifiedUser();
    const readOnly = createInMemoryRequestCookieAccessor(requestCookies());
    await createSupabaseRequestAuthPrincipalSource({ cookies: readOnly }).resolveAuthenticatedUser();
    expect(readOnly.getAll()).toEqual(requestCookies());
  });

  it("TKA-001 builds the client with exactly persistSession false, autoRefreshToken false, detectSessionInUrl false and skipAutoInitialize true", async () => {
    verifiedUser();

    await source().resolveAuthenticatedUser();

    const options = createClientMock.mock.calls[0][2] as { auth: Record<string, unknown> };
    expect(Object.keys(options)).toEqual(["auth"]);
    expect(Object.keys(options.auth).sort()).toEqual([
      "autoRefreshToken",
      "detectSessionInUrl",
      "persistSession",
      "skipAutoInitialize",
    ]);
    expect(options.auth.persistSession).toBe(false);
    expect(options.auth.autoRefreshToken).toBe(false);
    expect(options.auth.detectSessionInUrl).toBe(false);
    expect(options.auth.skipAutoInitialize).toBe(true);
    // No storage, no cookie functions, no custom fetch, no headers, no flow.
    for (const absent of ["storage", "userStorage", "storageKey", "flowType", "lock", "debug"]) {
      expect(absent in options.auth, absent).toBe(false);
    }
  });

  it("TKA-002 asks getUser once, with the accepted cookie's own sign-in token: whole, in chunks, and for each policy", async () => {
    verifiedUser();
    const chunkedToken = tokenOf("CHUNKED-TOKEN-do-not-leak");
    const chunked = authValue("CHUNKED-TOKEN-do-not-leak");
    const cases: Array<[string, string, RequestCookie[], string]> = [
      ["whole, local", LOOPBACK_ORIGIN, requestCookies(), ACCESS_TOKEN],
      [
        "three chunks, local",
        LOOPBACK_ORIGIN,
        [
          { name: `${AUTH_COOKIE}.0`, value: chunked.slice(0, 30) },
          { name: `${AUTH_COOKIE}.1`, value: chunked.slice(30, 61) },
          { name: `${AUTH_COOKIE}.2`, value: chunked.slice(61) },
          { name: BINDING_COOKIE, value: SESSION_ID },
        ],
        chunkedToken,
      ],
      [
        "whole, hosted",
        HOSTED_ORIGIN,
        [
          { name: HOSTED_AUTH_COOKIE, value: AUTH_VALUE },
          { name: HOSTED_BINDING_COOKIE, value: SESSION_ID },
        ],
        ACCESS_TOKEN,
      ],
      [
        "two chunks, hosted",
        HOSTED_ORIGIN,
        [
          { name: `${HOSTED_AUTH_COOKIE}.0`, value: chunked.slice(0, 45) },
          { name: `${HOSTED_AUTH_COOKIE}.1`, value: chunked.slice(45) },
          { name: HOSTED_BINDING_COOKIE, value: SESSION_ID },
        ],
        chunkedToken,
      ],
    ];
    for (const [label, origin, cookies, token] of cases) {
      process.env[SOLMIND_TRUSTED_APP_ORIGIN_ENV] = origin;
      createClientMock.mockClear();
      getUser.mockClear();
      await expect(source(cookies).resolveAuthenticatedUser(), label).resolves.not.toBeNull();
      expect(createClientMock, label).toHaveBeenCalledTimes(1);
      expect(getUser.mock.calls, label).toEqual([[token]]);
    }
  });

  it("TKA-003 builds a new client for each request and takes the token from that request's own cookies", async () => {
    verifiedUser();
    const first = [
      { name: AUTH_COOKIE, value: authValue("FIRST-REQUEST-TOKEN") },
      { name: BINDING_COOKIE, value: SESSION_ID },
    ];
    const second = [
      { name: AUTH_COOKIE, value: authValue("SECOND-REQUEST-TOKEN") },
      { name: BINDING_COOKIE, value: OTHER_SESSION_ID },
    ];
    let current = first;
    const accessor: RequestCookieAccessor = {
      getAll: () => current.map((cookie) => ({ ...cookie })),
      setAll: () => undefined,
    };
    const oneSource = createSupabaseRequestAuthPrincipalSource({ cookies: accessor });

    await expect(oneSource.resolveAuthenticatedUser()).resolves.toMatchObject({
      presentedSessionId: SESSION_ID,
    });
    current = second;
    await expect(oneSource.resolveAuthenticatedUser()).resolves.toMatchObject({
      presentedSessionId: OTHER_SESSION_ID,
    });

    expect(createClientMock).toHaveBeenCalledTimes(2);
    expect(getUser.mock.calls).toEqual([
      [tokenOf("FIRST-REQUEST-TOKEN")],
      [tokenOf("SECOND-REQUEST-TOKEN")],
    ]);
  });

  // What the cookie says about its own expiry, and whichever renewal token it
  // carries, decide nothing here: the adapter reads no clock and hands neither
  // field to the library. Every row is a session the field check accepts.
  const NOW_SECONDS = Math.floor(Date.UTC(2026, 9, 6, 12, 0, 0) / 1000);
  const EXPIRY_AND_RENEWAL: Array<[string, number, string]> = [
    ["an expiry of 1 (1970)", 1, RENEWAL_TOKEN],
    ["an expiry an hour ago", NOW_SECONDS - 3600, RENEWAL_TOKEN],
    ["an expiry one second ago", NOW_SECONDS - 1, RENEWAL_TOKEN],
    ["an expiry at this very second", NOW_SECONDS, RENEWAL_TOKEN],
    ["an expiry 89 seconds ahead (inside the library's renewal margin)", NOW_SECONDS + 89, RENEWAL_TOKEN],
    ["an expiry 90 seconds ahead", NOW_SECONDS + 90, RENEWAL_TOKEN],
    ["an expiry 95 seconds ahead", NOW_SECONDS + 95, RENEWAL_TOKEN],
    ["an expiry in the year 2100", FAR_FUTURE_EXPIRES_AT, RENEWAL_TOKEN],
    ["the largest safe integer as the expiry", Number.MAX_SAFE_INTEGER, RENEWAL_TOKEN],
    ["a renewal token holding a line feed and a NUL", NOW_SECONDS - 3600, `renewal${String.fromCharCode(10)}forged line${String.fromCharCode(0)}`],
    ["a renewal token of 10,241 characters", 1, "r".repeat(10241)],
  ];

  it.each(EXPIRY_AND_RENEWAL)("TKA-004 the cookie's own expiry and renewal token change nothing the library is given: %s", async (_label, expiresAt, renewalToken) => {
    verifiedUser();
    const clock = vi.spyOn(Date, "now").mockReturnValue(NOW_SECONDS * 1000);
    try {
      await expect(
        source([
          {
            name: AUTH_COOKIE,
            value: sessionText({
              access_token: ACCESS_TOKEN,
              refresh_token: renewalToken,
              expires_at: expiresAt,
            }),
          },
          { name: BINDING_COOKIE, value: SESSION_ID },
        ]).resolveAuthenticatedUser(),
      ).resolves.toEqual({
        providerName: "supabase",
        providerUserId: AUTH_USER_ID,
        presentedSessionId: SESSION_ID,
      });
      expect(createClientMock.mock.calls).toEqual([
        ["https://example.supabase.co", "anon-key", CLIENT_OPTIONS],
      ]);
      expect(getUser.mock.calls).toEqual([[ACCESS_TOKEN]]);
      // The adapter itself never reads the clock (the library is replaced
      // here, so any read would be the adapter's or the policy's).
      expect(clock).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

  it("TKA-005 a clock that gives no number, or that jumps by minutes at every read, changes nothing: the adapter reads none", async () => {
    verifiedUser();
    const broken = vi.spyOn(Date, "now").mockReturnValue(Number.NaN);
    try {
      await expect(source().resolveAuthenticatedUser()).resolves.toEqual({
        providerName: "supabase",
        providerUserId: AUTH_USER_ID,
        presentedSessionId: SESSION_ID,
      });
      expect(broken).not.toHaveBeenCalled();
    } finally {
      broken.mockRestore();
    }

    let reads = 0;
    const jumping = vi.spyOn(Date, "now").mockImplementation(() => {
      reads += 1;
      return (NOW_SECONDS + reads * 600) * 1000;
    });
    try {
      createClientMock.mockClear();
      getUser.mockClear();
      await expect(source().resolveAuthenticatedUser()).resolves.not.toBeNull();
      expect(reads).toBe(0);
      expect(getUser.mock.calls).toEqual([[ACCESS_TOKEN]]);
    } finally {
      jumping.mockRestore();
    }
  });

  it("TKA-006 the adapter's own code: createClient from @supabase/supabase-js, no @supabase/ssr, one getUser call with the token, no setAll call and no clock read", () => {
    const text = readFileSync(
      resolve(process.cwd(), "src/lib/solmind/supabase/requestAuthClient.ts"),
      "utf8",
    );
    // The code without its comments (no string in this file holds `//`).
    const code = text
      .split(/\r?\n/)
      .map((line) => {
        const at = line.indexOf("//");
        return at < 0 ? line : line.slice(0, at);
      })
      .join("\n");

    const imports = [...code.matchAll(/from\s+"([^"]+)"|import\s+"([^"]+)"/g)].map(
      (match) => match[1] ?? match[2],
    );
    expect(imports).toEqual([
      "server-only",
      "@supabase/supabase-js",
      "../auth/requestAuthPrincipalSource",
      "../auth/requestCookieAccessor",
      "../auth/sessionCookiePolicy",
      "../auth/trustedApplicationOrigin",
      "./principalMapping",
    ]);
    expect(code).toContain('import { createClient } from "@supabase/supabase-js";');
    expect(code).not.toContain("@supabase/ssr");
    expect(code).not.toContain("createServerClient");

    // One call on the client, and it carries the token.
    expect(code.match(/\.auth\.[A-Za-z]+\(/g)).toEqual([".auth.getUser("]);
    expect(code).toContain("client.auth.getUser(accessToken)");
    expect(code).not.toMatch(/getUser\(\s*\)/);
    expect(code).toContain("readSessionAuthCookieAccessToken(policy, requestCookies)");

    // No cookie setter is called or handed on, nothing is stored, no session
    // call of another kind is made, and no clock or timer is read.
    for (const absent of [
      "setAll",
      "getSession",
      "setSession",
      "refreshSession",
      "signOut",
      "storage",
      "cookieOptions",
      "Date.",
      "performance.",
      "setTimeout",
      "setInterval",
      "fetch",
      "console.",
      "SERVICE_ROLE",
    ]) {
      expect(code, absent).not.toContain(absent);
    }
    expect(code.match(/cookies\.[A-Za-z]+\(/g)).toEqual(["cookies.getAll("]);
  });

  it("TKA-007 a refusal that quotes the token is neither returned, thrown nor logged", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: `invalid JWT ${ACCESS_TOKEN}`, status: 403 },
    });
    const refused = await source().resolveAuthenticatedUser();
    expect(refused).toBeNull();
    expect(JSON.stringify(refused)).not.toContain(SECRET_MARKER);

    getUser.mockReset();
    getUser.mockRejectedValue(new Error(`Headers.append: "Bearer ${ACCESS_TOKEN}" is an invalid header value.`));
    let thrown: unknown = null;
    let rejected: unknown = "not set";
    try {
      rejected = await source().resolveAuthenticatedUser();
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBeNull();
    expect(rejected).toBeNull();
    // The console spies' own check runs in afterEach.
  });
});

describe("createSupabaseRequestAuthPrincipalSource - the format check before the library (contract 25 Section 14; item 11)", () => {
  // Each of these is refused before any Supabase client exists, so nothing of
  // the value reaches the library.
  const MALFORMED: Array<[string, RequestCookie[]]> = [
    ["a character outside the allowed set", [{ name: AUTH_COOKIE, value: `base64-${SECRET_MARKER}!` }]],
    ["a value without the base64- start", [{ name: AUTH_COOKIE, value: `SECRET${SECRET_MARKER}` }]],
    ["a raw JSON value", [{ name: AUTH_COOKIE, value: `{"access_token":"${SECRET_MARKER}"}` }]],
    [
      "bytes that are not valid UTF-8 (the library's decoder would name a code point)",
      [{ name: AUTH_COOKIE, value: "base64-9YCAgA" }],
    ],
    [
      "a malformed chunk the library would not even read",
      [
        { name: AUTH_COOKIE, value: AUTH_VALUE },
        { name: `${AUTH_COOKIE}.7`, value: `${SECRET_MARKER} with spaces` },
      ],
    ],
    [
      "chunks that join to a malformed value",
      [
        { name: `${AUTH_COOKIE}.0`, value: "base64-" },
        { name: `${AUTH_COOKIE}.1`, value: "9YCAgA" },
      ],
    ],
  ];

  it.each(MALFORMED)("PRA-006 treats a malformed auth cookie as absent and never builds a client: %s", async (_label, authCookies) => {
    verifiedUser();

    await expect(
      source([...authCookies, { name: BINDING_COOKIE, value: SESSION_ID }]).resolveAuthenticatedUser(),
    ).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  // Well-encoded auth cookies (allowed characters, the `base64-` start, strictly
  // valid UTF-8) whose content the field check refuses. The line feed is built
  // with String.fromCharCode, so that this file holds only plain ASCII.
  const LINE_FEED = String.fromCharCode(10);
  const GOOD_SESSION = {
    access_token: `synthetic.${SECRET_MARKER}.signature`,
    refresh_token: "synthetic-refresh-token",
    expires_at: FAR_FUTURE_EXPIRES_AT,
  };
  const FIELD_CHECK_REFUSES: Array<[string, string]> = [
    ["a token holding a line feed", sessionText({ ...GOOD_SESSION, access_token: `synthetic.${SECRET_MARKER}${LINE_FEED}forged line.signature` })],
    ["a token of two parts", sessionText({ ...GOOD_SESSION, access_token: `synthetic.${SECRET_MARKER}` })],
    ["a token given as an array", sessionText({ ...GOOD_SESSION, access_token: [GOOD_SESSION.access_token] })],
    ["no refresh token", sessionText({ access_token: GOOD_SESSION.access_token, expires_at: FAR_FUTURE_EXPIRES_AT })],
    ["an empty refresh token", sessionText({ ...GOOD_SESSION, refresh_token: "" })],
    ["an expiry given as text", sessionText({ ...GOOD_SESSION, expires_at: String(FAR_FUTURE_EXPIRES_AT) })],
    ["an expiry of zero", sessionText({ ...GOOD_SESSION, expires_at: 0 })],
    ["a user given as text", sessionText({ ...GOOD_SESSION, user: SECRET_MARKER })],
    ["text that is not JSON", `base64-${Buffer.from(`${SECRET_MARKER} is not JSON`, "utf8").toString("base64url")}`],
    ["JSON that is not an object", `base64-${Buffer.from(JSON.stringify([GOOD_SESSION]), "utf8").toString("base64url")}`],
  ];

  it.each(FIELD_CHECK_REFUSES)("FCA-001 treats a well-encoded auth cookie that the field check refuses as absent and never builds a client: %s", async (_label, value) => {
    verifiedUser();

    await expect(
      source([
        { name: AUTH_COOKIE, value },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ]).resolveAuthenticatedUser(),
    ).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();

    // Control: the same request with a session of the required form goes on
    // to the library.
    await expect(
      source([
        { name: AUTH_COOKIE, value: sessionText(GOOD_SESSION) },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ]).resolveAuthenticatedUser(),
    ).resolves.not.toBeNull();
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it("PRA-007 denies without a client when the request carries no auth cookie under the shared name", async () => {
    verifiedUser();
    const absent: RequestCookie[][] = [
      [],
      [{ name: BINDING_COOKIE, value: SESSION_ID }],
      // The library's default name is no longer read.
      [
        { name: "sb-127-auth-token", value: AUTH_VALUE },
        { name: "sb-access-token", value: AUTH_VALUE },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ],
      [
        { name: AUTH_COOKIE, value: "" },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ],
      // Only a code verifier: not the auth cookie.
      [
        { name: `${AUTH_COOKIE}-code-verifier`, value: AUTH_VALUE },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ],
    ];
    for (const cookies of absent) {
      await expect(source(cookies).resolveAuthenticatedUser()).resolves.toBeNull();
    }
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("PRA-008 fails closed on a cookie list it cannot read as plain name and value pairs", async () => {
    verifiedUser();
    const getterEntry = Object.defineProperty({ name: AUTH_COOKIE }, "value", {
      enumerable: true,
      get: () => AUTH_VALUE,
    });
    const unreadable: Array<() => unknown> = [
      () => null,
      () => "solmind-auth=x",
      () => [{ name: AUTH_COOKIE, value: AUTH_VALUE, extra: true }, { name: BINDING_COOKIE, value: SESSION_ID }],
      () => [getterEntry, { name: BINDING_COOKIE, value: SESSION_ID }],
      () => [{ name: AUTH_COOKIE, value: 7 }, { name: BINDING_COOKIE, value: SESSION_ID }],
      () => {
        throw new Error(`cookie store failure ${SECRET_MARKER}`);
      },
    ];
    for (const getAll of unreadable) {
      const accessor = { getAll, setAll: () => undefined } as unknown as RequestCookieAccessor;
      await expect(
        createSupabaseRequestAuthPrincipalSource({ cookies: accessor }).resolveAuthenticatedUser(),
      ).resolves.toBeNull();
    }
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe("createSupabaseRequestAuthPrincipalSource - the session-binding cookie (contract 25 Section 8; item 7)", () => {
  it("PRA-009 a Supabase session alone denies before getUser: no binding cookie, no client", async () => {
    verifiedUser();

    await expect(
      source([{ name: AUTH_COOKIE, value: AUTH_VALUE }]).resolveAuthenticatedUser(),
    ).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("PRA-010 presents exactly the binding cookie's UUID, whichever session that is", async () => {
    verifiedUser();

    await expect(
      source([
        { name: AUTH_COOKIE, value: AUTH_VALUE },
        { name: BINDING_COOKIE, value: OTHER_SESSION_ID },
      ]).resolveAuthenticatedUser(),
    ).resolves.toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
      presentedSessionId: OTHER_SESSION_ID,
    });
  });

  it("PRA-011 a repeated binding cookie is ambiguous and counts as none", async () => {
    verifiedUser();
    for (const second of [OTHER_SESSION_ID, SESSION_ID]) {
      await expect(
        source([
          { name: AUTH_COOKIE, value: AUTH_VALUE },
          { name: BINDING_COOKIE, value: SESSION_ID },
          { name: BINDING_COOKIE, value: second },
        ]).resolveAuthenticatedUser(),
      ).resolves.toBeNull();
    }
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("PRA-012 a binding cookie that is not one lowercase canonical UUID counts as none", async () => {
    verifiedUser();
    const refused = [
      "",
      SESSION_ID.toUpperCase(),
      ` ${SESSION_ID}`,
      `${SESSION_ID} `,
      `${SESSION_ID}\n`,
      `{${SESSION_ID}}`,
      SESSION_ID.replace(/-/g, ""),
      SESSION_ID.slice(0, -1),
      `${SESSION_ID}0`,
      SESSION_ID.replace("5", "g"),
      `${SESSION_ID},${OTHER_SESSION_ID}`,
      "null",
      "undefined",
    ];
    for (const value of refused) {
      await expect(
        source([
          { name: AUTH_COOKIE, value: AUTH_VALUE },
          { name: BINDING_COOKIE, value },
        ]).resolveAuthenticatedUser(),
      ).resolves.toBeNull();
    }
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("PRA-013 never returns, throws or logs any part of a cookie value on a denial", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: SECRET_MARKER } });
    const denials: RequestCookie[][] = [
      requestCookies(),
      [{ name: AUTH_COOKIE, value: AUTH_VALUE }],
      [
        { name: AUTH_COOKIE, value: `base64-${SECRET_MARKER}!` },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ],
      [
        { name: AUTH_COOKIE, value: AUTH_VALUE },
        { name: BINDING_COOKIE, value: `${SECRET_MARKER}` },
      ],
    ];
    for (const cookies of denials) {
      const result = await source(cookies).resolveAuthenticatedUser();
      expect(result).toBeNull();
      expect(JSON.stringify(result)).not.toContain(SECRET_MARKER);
    }
    // The console spies' own check runs in afterEach.
  });
});

describe("requestAuthClient barrel exposure", () => {
  it("is not exported from the shared supabase index barrel", () => {
    // The server-only adapter must stay off the shared barrel (AUTH-RLS-DEC-013),
    // mirroring serviceRoleClient. Tests import it by direct path only.
    expect(
      "createSupabaseRequestAuthPrincipalSource" in supabaseBarrel,
    ).toBe(false);
    expect("REQUEST_AUTH_SESSION_COOKIE_POLICY_UNAVAILABLE" in supabaseBarrel).toBe(false);
  });
});
