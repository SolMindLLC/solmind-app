// Login step 6, sub-slice S6-4, the token-only verification (contract 25
// Sections 7 and 8), against the REAL installed Supabase library.
//
// Contract 25 Section 7 allows a claim about renewal only for "a separately
// verified no-refresh path (for example, verifying with `getUser(jwt)`, F11),
// tested with late and replayed cookies". These are those tests. The adapter
// gives the library the checked cookie's sign-in token and nothing else, on a
// client that holds no cookie, no session and no cookie setter. The adapter
// cases use the accepted cookies and expiries listed below. They show at most
// one GET /user request with the accepted token and no request to the token
// endpoint or cookie setter. TKL-008 expects the library's transport-error
// line; TKL-009 separately tests the client construction without an adapter
// cookie. Most are paired with a control that hands the same cookie to a
// cookie-reading client of the library (createServerClient from @supabase/ssr
// and getUser() with no argument), which does ask for a renewal.
//
// The library is real. `@supabase/supabase-js` is wrapped, not replaced: the
// wrapper calls the real createClient, records what it was given, and lets a
// test run one step between the adapter's check of the cookie and the
// library's call, which is how a test moves the clock forward by minutes at
// exactly that point. Only fetch is replaced, by a stand-in for Supabase
// Auth; what the real Supabase Auth answers is not tested here.
//
// Odd characters are built with String.fromCharCode, so that this file holds
// only plain ASCII. Every value is synthetic. No request leaves the process.

import { Buffer } from "node:buffer";
import { formatWithOptions } from "node:util";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// What the adapter gave the real createClient, the clients it got back, and
// the step a test may run between the cookie check and the library's call.
const { seam } = vi.hoisted(() => ({
  seam: {
    afterClientBuilt: null as (() => void) | null,
    calls: [] as Array<{ url: unknown; key: unknown; options: unknown; argumentCount: number }>,
    clients: [] as unknown[],
  },
}));

vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  return {
    ...actual,
    createClient: (...args: unknown[]) => {
      const client = (actual.createClient as (...given: unknown[]) => unknown)(...args);
      seam.calls.push({ url: args[0], key: args[1], options: args[2], argumentCount: args.length });
      seam.clients.push(client);
      const step = seam.afterClientBuilt;
      if (step !== null) {
        step();
      }
      return client;
    },
  };
});

import {
  type RequestCookie,
  type RequestCookieAccessor,
} from "../../auth/requestCookieAccessor";
import { SOLMIND_TRUSTED_APP_ORIGIN_ENV } from "../../auth/trustedApplicationOrigin";
import {
  REQUEST_AUTH_ANON_KEY_ENV,
  REQUEST_AUTH_URL_ENV,
  createSupabaseRequestAuthPrincipalSource,
} from "../requestAuthClient";

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY = "anon-test-key-not-a-secret";
const AUTH_COOKIE = "solmind-auth";
const BINDING_COOKIE = "solmind-session";
const SESSION_ID = "5e5510a0-0000-4000-8000-0000000000f1";
const AUTH_USER_ID = "22222222-2222-4222-8222-222222222222";
const ACCESS_TOKEN = "synthetic.ACCESSmarkQ7zk9xKw.token-do-not-leak";
const REFRESH_TOKEN = "RENEWALmarkQ7zk9xKw-do-not-leak";
const TOKEN_PATH = "/auth/v1/token?grant_type=refresh_token";
const USER_PATH = "/auth/v1/user";
const PRINCIPAL = {
  providerName: "supabase",
  providerUserId: AUTH_USER_ID,
  presentedSessionId: SESSION_ID,
};
// The one options object the adapter gives createClient.
const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    skipAutoInitialize: true,
  },
};

const ch = (code: number): string => String.fromCharCode(code);
const LF = ch(10);
const CR = ch(13);
const NUL = ch(0);

function encoded(text: string): string {
  return `base64-${Buffer.from(text, "utf8").toString("base64url")}`;
}

// The request's cookies: an auth cookie that the shared format check accepts,
// whose token expires at `expiresAt` (whole seconds since 1970), and the
// binding cookie.
function cookiesExpiringAt(expiresAt: number, refreshToken: string = REFRESH_TOKEN): RequestCookie[] {
  return [
    {
      name: AUTH_COOKIE,
      value: encoded(
        JSON.stringify({
          access_token: ACCESS_TOKEN,
          refresh_token: refreshToken,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: expiresAt,
          user: { id: AUTH_USER_ID, aud: "authenticated" },
        }),
      ),
    },
    { name: BINDING_COOKIE, value: SESSION_ID },
  ];
}

function cookiesExpiringIn(seconds: number, refreshToken: string = REFRESH_TOKEN): RequestCookie[] {
  return cookiesExpiringAt(Math.floor(Date.now() / 1000) + seconds, refreshToken);
}

function renewalTokenOf(cookies: RequestCookie[]): string {
  return (JSON.parse(
    Buffer.from(cookies[0].value.slice("base64-".length), "base64url").toString("utf8"),
  ) as { refresh_token: string }).refresh_token;
}

function recordingAccessor(cookies: RequestCookie[]): {
  accessor: RequestCookieAccessor;
  getAll: ReturnType<typeof vi.fn>;
  setAll: ReturnType<typeof vi.fn>;
} {
  const getAll = vi.fn(() => cookies.map((cookie) => ({ ...cookie })));
  const setAll = vi.fn();
  return { accessor: { getAll, setAll }, getAll, setAll };
}

// The same cookies handed to a cookie-reading client of the library, with an
// optional step between building the client and its call. The adapter does
// not do this. What reaches the client's cookie setter is collected.
async function cookieReadingClient(
  cookies: RequestCookie[],
  betweenBuildAndCall: (() => void) | null = null,
): Promise<Array<{ name: string; value: string }>> {
  const written: Array<{ name: string; value: string }> = [];
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookieOptions: { name: AUTH_COOKIE },
    cookies: {
      getAll: () => cookies.filter((cookie) => cookie.name !== BINDING_COOKIE).map((cookie) => ({ ...cookie })),
      setAll: (cookiesToSet) => {
        written.push(...cookiesToSet.map((cookie) => ({ name: cookie.name, value: cookie.value })));
      },
    },
  });
  if (betweenBuildAndCall !== null) {
    betweenBuildAndCall();
  }
  try {
    await client.auth.getUser();
  } catch {
    // A rejected call is not what these controls are about.
  }
  return written;
}

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
type ConsoleSpies = Record<(typeof CONSOLE_METHODS)[number], ReturnType<typeof vi.spyOn>>;
let consoleSpies: ConsoleSpies;
let fetchMock: ReturnType<typeof vi.fn>;
let webSocketsOpened = 0;
// Every path the library asked for while a request was going through the
// adapter, over the whole test. Checked after each test: never the token
// endpoint, never anything but the user endpoint.
let adapterPaths: string[] = [];
const savedEnv: Record<string, string | undefined> = {};

function consoleLines(): string[] {
  const lines: string[] = [];
  for (const method of CONSOLE_METHODS) {
    for (const call of consoleSpies[method].mock.calls) {
      lines.push(`console.${method}: ${formatWithOptions({ colors: false }, ...call)}`);
    }
  }
  return lines;
}

function clearConsole(): void {
  for (const method of CONSOLE_METHODS) {
    consoleSpies[method].mockClear();
  }
}

beforeEach(() => {
  for (const name of [REQUEST_AUTH_URL_ENV, REQUEST_AUTH_ANON_KEY_ENV, SOLMIND_TRUSTED_APP_ORIGIN_ENV]) {
    savedEnv[name] = process.env[name];
  }
  process.env[REQUEST_AUTH_URL_ENV] = SUPABASE_URL;
  process.env[REQUEST_AUTH_ANON_KEY_ENV] = ANON_KEY;
  process.env[SOLMIND_TRUSTED_APP_ORIGIN_ENV] = "http://127.0.0.1:3000";
  fetchMock = vi.fn(async () => {
    throw new Error("unexpected network call");
  });
  vi.stubGlobal("fetch", fetchMock);
  // No other connection may be opened either.
  webSocketsOpened = 0;
  vi.stubGlobal(
    "WebSocket",
    class {
      constructor() {
        webSocketsOpened += 1;
        throw new Error("unexpected WebSocket");
      }
    },
  );
  seam.afterClientBuilt = null;
  seam.calls.length = 0;
  seam.clients.length = 0;
  adapterPaths = [];
  consoleSpies = Object.fromEntries(
    CONSOLE_METHODS.map((method) => [method, vi.spyOn(console, method).mockImplementation(() => undefined)]),
  ) as ConsoleSpies;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  seam.afterClientBuilt = null;
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  // Whatever the test was about: through the adapter the library asked for
  // nothing but the user endpoint, and opened no other connection.
  expect(adapterPaths.filter((path) => path !== USER_PATH)).toEqual([]);
  expect(adapterPaths.some((path) => path.includes("/token"))).toBe(false);
  expect(webSocketsOpened).toBe(0);
});

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function requestedPaths(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]).replace(SUPABASE_URL, ""));
}

// The renewal token of each request sent to the token endpoint.
function renewalTokensSent(): unknown[] {
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).includes("/auth/v1/token"))
    .map((call) => (JSON.parse(String((call[1] as { body?: unknown }).body)) as { refresh_token?: unknown }).refresh_token);
}

// A stand-in for Supabase Auth. Like the platform's fetch, it first builds a
// Request from its arguments, which checks every header value. For the user
// endpoint it answers what `user` says for the bearer it was sent (by default
// it accepts the test's token). It REFUSES every renewal with a message that
// repeats the renewal token it was sent. Whether the real Supabase Auth ever
// repeats one is not established; this stand-in does, to show what a
// cookie-reading client prints if a server does.
function answerAsSupabaseAuth(user: (bearer: string) => Response = acceptTheTestToken): void {
  fetchMock.mockImplementation(async (url: unknown, init?: unknown) => {
    const request = new Request(String(url), init as RequestInit);
    const path = new URL(request.url).pathname;
    if (path === USER_PATH) {
      const authorization = request.headers.get("authorization") ?? "";
      return user(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    }
    if (path === "/auth/v1/token") {
      const sent = (JSON.parse(await request.text()) as { refresh_token?: unknown }).refresh_token;
      return jsonResponse(
        { code: "validation_failed", message: `refresh token ${String(sent)} is not valid` },
        400,
      );
    }
    throw new Error("unexpected network call");
  });
}

function acceptTheTestToken(bearer: string): Response {
  if (bearer === ACCESS_TOKEN) {
    return jsonResponse({ id: AUTH_USER_ID, aud: "authenticated" }, 200);
  }
  return jsonResponse({ code: "bad_jwt", message: "invalid JWT" }, 403);
}

// A refusal for a token past its end, in the form of the library's error
// answers (a status, a code and a message). The answer is this stand-in's,
// not one recorded from Supabase Auth; its message repeats the bearer, to
// show that a returned error is never printed.
function refuseAsExpired(bearer: string): Response {
  return jsonResponse(
    { code: "bad_jwt", message: `invalid JWT: token is expired: ${bearer}` },
    403,
    { "x-supabase-api-version": "2024-01-01" },
  );
}

// Supabase Auth cannot be reached: after the platform's own check of the
// request, fetch rejects as the platform does for a refused connection.
function answerAsUnreachable(): void {
  fetchMock.mockImplementation(async (url: unknown, init?: unknown) => {
    new Request(String(url), init as RequestInit);
    const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:54321"), {
      code: "ECONNREFUSED",
      syscall: "connect",
      address: "127.0.0.1",
      port: 54321,
    });
    throw new TypeError("fetch failed", { cause });
  });
}

// Every place a line could appear while `run` works and for a moment after it
// (the library starts a background session load that nobody awaits): the
// console methods, direct writes to stdout and stderr, process warnings, and
// unhandled rejections.
type Recorded<T> = { value: T; lines: string[]; unhandled: string[]; milliseconds: number };

async function recordEverySink<T>(run: () => Promise<T>): Promise<Recorded<T>> {
  const lines: string[] = [];
  const unhandled: string[] = [];
  clearConsole();
  const streamSpy = (stream: NodeJS.WriteStream) =>
    vi.spyOn(stream, "write").mockImplementation(((chunk: unknown) => {
      lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8"));
      return true;
    }) as never);
  const stdoutSpy = streamSpy(process.stdout);
  const stderrSpy = streamSpy(process.stderr);
  const onWarning = (warning: Error): void => {
    lines.push(`process warning: ${warning.name}: ${warning.message}`);
  };
  const onUnhandled = (reason: unknown): void => {
    unhandled.push(formatWithOptions({ colors: false }, reason));
  };
  process.on("warning", onWarning);
  process.on("unhandledRejection", onUnhandled);
  let value: T;
  let milliseconds = 0;
  try {
    const started = performance.now();
    value = await run();
    milliseconds = performance.now() - started;
    await new Promise((resolve) => setTimeout(resolve, 30));
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
    process.removeListener("warning", onWarning);
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  }
  lines.push(...consoleLines());
  return { value, lines, unhandled, milliseconds };
}

// Does a printed text carry any 8 characters of a visitor-chosen string, as
// they are, JSON-escaped, percent-encoded, in hex or in base64, without
// regard to case?
function carries(text: string, secrets: ReadonlyArray<string>): boolean {
  const haystack = text.toLowerCase();
  for (const secret of secrets) {
    const bytes = Buffer.from(secret, "utf8");
    const forms = [secret, JSON.stringify(secret).slice(1, -1), bytes.toString("hex")];
    try {
      forms.push(encodeURIComponent(secret));
    } catch {
      // A lone surrogate cannot be percent-encoded; the other forms stand.
    }
    for (let shift = 0; shift < 3 && shift < bytes.length; shift += 1) {
      forms.push(bytes.subarray(shift).toString("base64"), bytes.subarray(shift).toString("base64url"));
    }
    for (const form of forms) {
      const needle = form.toLowerCase();
      for (let index = 0; index + 8 <= needle.length; index += 1) {
        if (haystack.includes(needle.slice(index, index + 8))) {
          return true;
        }
      }
    }
  }
  return false;
}

type ThroughTheAdapter = Recorded<unknown> & {
  getAll: ReturnType<typeof vi.fn>;
  setAll: ReturnType<typeof vi.fn>;
  paths: string[];
  requests: Array<{ method: string; path: string; authorization: string | null; apikey: string | null; body: unknown }>;
};

// One request through the real adapter and the real library, with every sink
// recorded and every request the library made while it ran.
async function throughTheAdapter(cookies: RequestCookie[]): Promise<ThroughTheAdapter> {
  const { accessor, getAll, setAll } = recordingAccessor(cookies);
  const before = fetchMock.mock.calls.length;
  const recorded = await recordEverySink(() =>
    createSupabaseRequestAuthPrincipalSource({ cookies: accessor }).resolveAuthenticatedUser(),
  );
  const made = fetchMock.mock.calls.slice(before) as Array<[unknown, { method?: string; headers?: unknown; body?: unknown }?]>;
  const requests = made.map(([url, init]) => {
    const headers = new Headers((init?.headers ?? {}) as HeadersInit);
    return {
      method: String(init?.method),
      path: String(url).replace(SUPABASE_URL, ""),
      authorization: headers.get("authorization"),
      apikey: headers.get("apikey"),
      body: init?.body,
    };
  });
  const paths = requests.map((request) => request.path);
  adapterPaths.push(...paths);
  return { ...recorded, getAll, setAll, paths, requests };
}

// What every request through the adapter must look like when the library was
// asked at all: one GET to the user endpoint, the cookie's own token as the
// bearer, the public key, no body; nothing set, nothing printed, no
// unhandled rejection; the accessor read once.
function expectOneVerificationAndSilence(adapter: ThroughTheAdapter): void {
  expect(adapter.requests).toEqual([
    { method: "GET", path: USER_PATH, authorization: `Bearer ${ACCESS_TOKEN}`, apikey: ANON_KEY, body: undefined },
  ]);
  expect(adapter.getAll).toHaveBeenCalledTimes(1);
  expect(adapter.setAll).not.toHaveBeenCalled();
  expect(adapter.lines).toEqual([]);
  expect(adapter.unhandled).toEqual([]);
}

describe("request-auth adapter with the real Supabase library - token-only verification: late, replayed and hand-made auth cookies (contract 25 Sections 7 and 8; items 6 and 11)", () => {
  const hostileNul = `RENEWALnulQ7zk9xKw${NUL}tail`;
  const hostileHeader = `RENEWALcrlfQ7zk9xKw${CR}${LF}X-Injected: 1`;
  const hostileLong = `RENEWALlongQ7zk9xKw${"x".repeat(10222)}`;

  // [label, the cookies, whether a cookie-reading client would ask for a
  // renewal (the token is past its end or inside the library's 90-second
  // margin), whether the token is already past its end]
  const COOKIES: Array<[string, () => RequestCookie[], boolean, boolean]> = [
    ["a token ten minutes past its end (a cookie sent late)", () => cookiesExpiringIn(-600), true, true],
    ["a token a day past its end (a replayed cookie)", () => cookiesExpiringIn(-86400), true, true],
    ["expires_at 1, a hand-made cookie", () => cookiesExpiringAt(1), true, true],
    ["a token one second past its end", () => cookiesExpiringIn(-1), true, true],
    ["a token with 30 seconds left", () => cookiesExpiringIn(30), true, false],
    ["a token with 80 seconds left, inside the library's renewal margin", () => cookiesExpiringIn(80), true, false],
    ["a token with 93 seconds left", () => cookiesExpiringIn(93), false, false],
    ["a token with an hour left", () => cookiesExpiringIn(3600), false, false],
    ["a hand-made cookie that claims the year 2100", () => cookiesExpiringAt(4102444800), false, false],
    ["a hand-made cookie that claims the largest safe integer", () => cookiesExpiringAt(Number.MAX_SAFE_INTEGER), false, false],
    ["a late cookie whose renewal token holds a NUL", () => cookiesExpiringIn(-600, hostileNul), true, true],
    ["a late cookie whose renewal token holds CR LF and a header line", () => cookiesExpiringIn(-600, hostileHeader), true, true],
    ["a late cookie whose renewal token is 10,241 characters long", () => cookiesExpiringIn(-600, hostileLong), true, true],
    ["a fresh cookie whose renewal token holds CR LF and a header line", () => cookiesExpiringIn(3600, hostileHeader), false, false],
  ];

  it.each(COOKIES)("TKL-001 one request, to the user endpoint with the cookie's token; none to the token endpoint; nothing set and nothing printed: %s", async (_label, makeCookies, aCookieReaderWouldRenew, pastItsEnd) => {
    // The stand-in refuses the token in the rows where it is past its end
    // (what the real Supabase Auth answers is not tested here), and accepts
    // the test's token otherwise.
    answerAsSupabaseAuth(pastItsEnd ? refuseAsExpired : acceptTheTestToken);
    const cookies = makeCookies();
    const renewalToken = renewalTokenOf(cookies);

    const adapter = await throughTheAdapter(cookies);

    expectOneVerificationAndSilence(adapter);
    expect(adapter.value).toEqual(pastItsEnd ? null : PRINCIPAL);
    expect(renewalTokensSent()).toEqual([]);
    // The client was built by the real createClient, from the two public
    // settings and the fixed options, and holds no session afterwards.
    expect(seam.calls).toEqual([{ url: SUPABASE_URL, key: ANON_KEY, options: CLIENT_OPTIONS, argumentCount: 3 }]);
    const held = await (seam.clients[0] as ReturnType<typeof createClient>).auth.getSession();
    expect(held.data.session).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Control: a cookie-reading client, given the same auth cookie.
    fetchMock.mockClear();
    const alone = await recordEverySink(() => cookieReadingClient(cookies));
    if (aCookieReaderWouldRenew) {
      // It asks the token endpoint first and sends the cookie's renewal token
      // unchanged.
      expect(requestedPaths()[0]).toBe(TOKEN_PATH);
      expect(renewalTokensSent()).toEqual([renewalToken]);
    } else {
      expect(requestedPaths()).toEqual([USER_PATH]);
    }
    if (pastItsEnd) {
      // The renewal is refused and the token is past its end: the client
      // prints lines of its own for the refusal, and they repeat what the
      // server answered, which in this stand-in repeats the renewal token.
      expect(alone.lines.length).toBeGreaterThan(0);
      expect(alone.lines.some((line) => carries(line, [renewalToken]))).toBe(true);
    }
  });

  it("TKL-002 with a server whose refusal repeats the renewal token, a cookie-reading client prints the visitor's text with its real line break; through the adapter the token endpoint is not asked and nothing is printed", async () => {
    answerAsSupabaseAuth(refuseAsExpired);
    const cookies = cookiesExpiringIn(-600, hostileHeader);

    const alone = await recordEverySink(() => cookieReadingClient(cookies));
    const printed = alone.lines.join(LF);
    expect(printed).toContain(`RENEWALcrlfQ7zk9xKw${CR}${LF}X-Injected: 1`);
    expect(requestedPaths()).toEqual([TOKEN_PATH]);

    fetchMock.mockClear();
    const adapter = await throughTheAdapter(cookies);
    expect(adapter.value).toBeNull();
    expectOneVerificationAndSilence(adapter);
    expect(renewalTokensSent()).toEqual([]);
  });

  it("TKL-003 a replay inside the token's life is verified like any request, each time with one request and no renewal: the SolMind session decides such a request", async () => {
    answerAsSupabaseAuth();
    const cookies = cookiesExpiringIn(3000);

    for (let presented = 0; presented < 3; presented += 1) {
      fetchMock.mockClear();
      const adapter = await throughTheAdapter(cookies);
      expect(adapter.value).toEqual(PRINCIPAL);
      expectOneVerificationAndSilence(adapter);
    }
    // A new client for each request: nothing is kept from one to the next.
    expect(seam.calls).toHaveLength(3);
    expect(new Set(seam.clients).size).toBe(3);
  });
});

describe("request-auth adapter with the real Supabase library - token-only verification: time passing between the check and the call (contract 25 Section 7; review #161a, B1)", () => {
  const EXPIRES_AT_SECONDS = 1791234567;

  // Only the clock is replaced; timers and promises run as usual.
  function setLifeLeft(millisecondsLeft: number): void {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(EXPIRES_AT_SECONDS * 1000 - millisecondsLeft);
  }

  // [label, the token's life left when the request arrives, the time that
  // passes between the adapter's check of the cookie and the library's call]
  const PAUSES: Array<[string, number, number]> = [
    ["95,000 ms left at the check, then 5,001 ms pass (the case review #161a gave)", 95000, 5001],
    ["95,000 ms left at the check, then 10 minutes pass", 95000, 600000],
    ["one hour left at the check, then 59 minutes pass", 3600000, 3540000],
    ["one hour left at the check, then 3 hours pass", 3600000, 10800000],
    ["one second left at the check, then 2 minutes pass", 1000, 120000],
    ["ten minutes past its end at the check, then 10 more minutes pass", -600000, 600000],
    ["one hour left at the check, then 30 days pass", 3600000, 2592000000],
  ];

  it.each(PAUSES)("TKL-004 the clock moved forward between the check and the call changes nothing that is sent: %s", async (_label, lifeLeft, pause) => {
    answerAsSupabaseAuth();
    const cookies = cookiesExpiringAt(EXPIRES_AT_SECONDS);

    // Through the adapter. The step runs inside the adapter, after the shared
    // check has accepted the cookie and the client has been built, and before
    // the library's call.
    setLifeLeft(lifeLeft);
    const clockAtCheck = Date.now();
    let clockAtCall = 0;
    seam.afterClientBuilt = () => {
      vi.setSystemTime(Date.now() + pause);
      clockAtCall = Date.now();
    };
    const adapter = await throughTheAdapter(cookies);
    seam.afterClientBuilt = null;

    expect(clockAtCall - clockAtCheck).toBe(pause);
    expect(seam.calls).toHaveLength(1);
    expectOneVerificationAndSilence(adapter);
    expect(adapter.value).toEqual(PRINCIPAL);
    expect(renewalTokensSent()).toEqual([]);

    // The same request with no pause sends exactly the same.
    fetchMock.mockClear();
    setLifeLeft(lifeLeft);
    const unpaused = await throughTheAdapter(cookies);
    expectOneVerificationAndSilence(unpaused);
    expect(unpaused.requests).toEqual(adapter.requests);

    // Control: a cookie-reading client with the same cookie and the same
    // pause between its build and its call. After the pause the token has
    // under 90,000 ms left in every row, and the client asks for a renewal
    // with the cookie's renewal token.
    expect(lifeLeft - pause).toBeLessThan(90000);
    fetchMock.mockClear();
    setLifeLeft(lifeLeft);
    await cookieReadingClient(cookies, () => {
      vi.setSystemTime(Date.now() + pause);
    });
    expect(requestedPaths()[0]).toBe(TOKEN_PATH);
    expect(renewalTokensSent()[0]).toBe(REFRESH_TOKEN);
  });

  it("TKL-005 a clock that jumps five minutes at every read changes nothing that is sent", async () => {
    answerAsSupabaseAuth();
    // 95 seconds of life by the first reading of the clock.
    const start = EXPIRES_AT_SECONDS * 1000 - 95000;
    let reads = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      reads += 1;
      return start + (reads - 1) * 300000;
    });
    const cookies = cookiesExpiringAt(EXPIRES_AT_SECONDS);

    const adapter = await throughTheAdapter(cookies);

    expectOneVerificationAndSilence(adapter);
    expect(adapter.value).toEqual(PRINCIPAL);
    expect(renewalTokensSent()).toEqual([]);

    // Control: a cookie-reading client under the same clock reads it and asks
    // for a renewal. That the adapter's own code reads no clock is shown where
    // the library is replaced (TKA-004, TKA-005 and TKA-006), not here.
    fetchMock.mockClear();
    reads = 0;
    await cookieReadingClient(cookies);
    expect(reads).toBeGreaterThan(0);
    expect(requestedPaths()[0]).toBe(TOKEN_PATH);
    clock.mockRestore();
  });

  it("TKL-006 the call leaves nothing running: no timer is pending afterwards, an hour later nothing more has been asked, and the client still holds no session", async () => {
    answerAsSupabaseAuth();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(EXPIRES_AT_SECONDS * 1000 - 95000);
    const { accessor, setAll } = recordingAccessor(cookiesExpiringAt(EXPIRES_AT_SECONDS));

    const principal = await createSupabaseRequestAuthPrincipalSource({ cookies: accessor }).resolveAuthenticatedUser();
    adapterPaths.push(...requestedPaths());

    expect(principal).toEqual(PRINCIPAL);
    expect(requestedPaths()).toEqual([USER_PATH]);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(3600000);
    expect(vi.getTimerCount()).toBe(0);
    expect(requestedPaths()).toEqual([USER_PATH]);
    adapterPaths.push(...requestedPaths());
    expect(setAll).not.toHaveBeenCalled();
    expect(consoleLines()).toEqual([]);
    const held = await (seam.clients[0] as ReturnType<typeof createClient>).auth.getSession();
    expect(held.data.session).toBeNull();
    expect(requestedPaths()).toEqual([USER_PATH]);

    // Control, the installed library with its own defaults on a server: a
    // client built with no options starts a renewal timer. The adapter's
    // options are what keep one from starting.
    fetchMock.mockClear();
    const defaults = createClient(SUPABASE_URL, ANON_KEY);
    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await defaults.auth.stopAutoRefresh();
    expect(vi.getTimerCount()).toBe(0);
    expect(requestedPaths()).toEqual([]);
  });
});

describe("request-auth adapter with the real Supabase library - token-only verification: what Supabase Auth's refusals give (contract 25 Sections 7 and 8)", () => {
  // [label, the stand-in's answer for the user endpoint]. Every message that
  // repeats the bearer is this stand-in's own, to show that nothing of a
  // returned error is printed.
  const REFUSALS: Array<[string, (bearer: string) => Response]> = [
    ["a token past its end (403 bad_jwt, with the API version header)", refuseAsExpired],
    ["a forged token (403 bad_jwt)", (bearer) => jsonResponse({ code: "bad_jwt", message: `invalid JWT: signature is invalid: ${bearer}` }, 403)],
    ["a refusal in the older form (401 with msg)", (bearer) => jsonResponse({ code: 401, msg: `Invalid token ${bearer}` }, 401)],
    [
      "a session that is gone (403 session_not_found, with the API version header)",
      () =>
        jsonResponse(
          { code: "session_not_found", message: "Session from session_id claim in JWT does not exist" },
          403,
          { "x-supabase-api-version": "2024-01-01" },
        ),
    ],
    [
      "a session that is gone (403 session_not_found, in the older form)",
      () => jsonResponse({ error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" }, 403),
    ],
    ["a user that no longer exists (404 user_not_found)", () => jsonResponse({ code: "user_not_found", message: "User from sub claim in JWT does not exist" }, 404, { "x-supabase-api-version": "2024-01-01" })],
    ["a refusal whose body is not JSON (403)", (bearer) => new Response(`<html>forbidden ${bearer}</html>`, { status: 403 })],
    ["a rate limit (429)", () => jsonResponse({ code: "over_request_rate_limit", message: "Request rate limit reached" }, 429)],
    ["a server error (500)", (bearer) => jsonResponse({ code: "unexpected_failure", message: `boom ${bearer}` }, 500)],
    ["a gateway error (503, not JSON)", () => new Response("upstream connect error", { status: 503 })],
    ["an OK answer that is not JSON", (bearer) => new Response(`not json ${bearer}`, { status: 200 })],
    ["an OK answer with no user id", () => jsonResponse({ aud: "authenticated" }, 200)],
    ["an OK answer with a blank user id", () => jsonResponse({ id: "   ", aud: "authenticated" }, 200)],
  ];

  it.each(REFUSALS)("TKL-007 the request is denied with the fixed result after one request, with no retry, nothing set and nothing printed: %s", async (_label, user) => {
    answerAsSupabaseAuth(user);
    const cookies = cookiesExpiringIn(-600);

    const adapter = await throughTheAdapter(cookies);

    // The denial is the adapter's one fixed result: null, with nothing of the
    // answer in it.
    expect(adapter.value).toBeNull();
    expectOneVerificationAndSilence(adapter);
    expect(renewalTokensSent()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("TKL-008 Supabase Auth unreachable: one attempt and no retry, the request is denied, and the one printed line is the library's print of the platform's error, with no cookie text in it", async () => {
    answerAsUnreachable();
    const cookies = cookiesExpiringIn(3000);

    const adapter = await throughTheAdapter(cookies);

    expect(adapter.value).toBeNull();
    expect(adapter.paths).toEqual([USER_PATH]);
    expect(adapter.setAll).not.toHaveBeenCalled();
    expect(adapter.unhandled).toEqual([]);
    expect(adapter.lines).toHaveLength(1);
    expect(adapter.lines[0].startsWith("console.error: ")).toBe(true);
    expect(adapter.lines[0]).toContain("fetch failed");
    expect(carries(adapter.lines[0], [ACCESS_TOKEN, REFRESH_TOKEN, SESSION_ID, cookies[0].value])).toBe(false);
    // No wait: the library tries its one request once. (The time a real
    // unreachable host takes is the platform's, and is not shown here.)
    expect(adapter.milliseconds).toBeLessThan(2000);

    // The same for a late cookie: one attempt, one line, no wait.
    fetchMock.mockClear();
    const late = await throughTheAdapter(cookiesExpiringIn(-600));
    expect(late.value).toBeNull();
    expect(late.paths).toEqual([USER_PATH]);
    expect(late.lines).toHaveLength(1);
    expect(late.milliseconds).toBeLessThan(2000);

    // Control: a cookie-reading client with a late cookie, under a clock that
    // this test moves forward, retries its renewal 8 times over 25,400 ms of
    // waiting.
    fetchMock.mockClear();
    clearConsole();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const startedAt = Date.now();
    let finishedAt = startedAt;
    const pending = cookieReadingClient(cookiesExpiringAt(Math.floor(startedAt / 1000) - 600)).then(() => {
      finishedAt = Date.now();
    });
    await vi.advanceTimersByTimeAsync(60000);
    await pending;
    vi.useRealTimers();
    expect(requestedPaths()).toEqual(Array.from({ length: 8 }, () => TOKEN_PATH));
    expect(finishedAt - startedAt).toBeGreaterThanOrEqual(25400);
    expect(finishedAt - startedAt).toBeLessThan(30000);
  });
});

describe("request-auth adapter with the real Supabase library - token-only verification: what the construction rests on in the installed library (auth-js 2.108.2)", () => {
  it("TKL-009 a client built as the adapter builds it sends one GET /user for getUser(token), holds no session before or after, and for getUser() with no argument asks nothing at all", async () => {
    answerAsSupabaseAuth();
    const client = createClient(SUPABASE_URL, ANON_KEY, CLIENT_OPTIONS);

    // It holds no session, and asking for one sends nothing.
    expect((await client.auth.getSession()).data.session).toBeNull();
    expect(requestedPaths()).toEqual([]);

    const verified = await recordEverySink(() => client.auth.getUser(ACCESS_TOKEN));
    expect(verified.value.error).toBeNull();
    expect(verified.value.data.user?.id).toBe(AUTH_USER_ID);
    expect(requestedPaths()).toEqual([USER_PATH]);
    expect(verified.lines).toEqual([]);
    expect(verified.unhandled).toEqual([]);
    // Verifying a token stores nothing.
    expect((await client.auth.getSession()).data.session).toBeNull();

    // With no argument the same client has no session to verify: it returns
    // the library's "session missing" error and sends nothing. So the token
    // argument is what makes the adapter's one request, and a call without it
    // could never be allowed.
    fetchMock.mockClear();
    const missing = await client.auth.getUser();
    expect(missing.data.user).toBeNull();
    expect(missing.error?.name).toBe("AuthSessionMissingError");
    expect(requestedPaths()).toEqual([]);

    // Asked to renew, it has nothing to renew with and sends nothing.
    const renewal = await client.auth.refreshSession();
    expect(renewal.data.session).toBeNull();
    expect(renewal.error?.name).toBe("AuthSessionMissingError");
    expect(requestedPaths()).toEqual([]);
    expect(consoleLines()).toEqual([]);
  });
});
