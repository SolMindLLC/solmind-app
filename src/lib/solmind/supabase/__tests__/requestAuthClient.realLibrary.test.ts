// Login step 6, sub-slice S6-4: the request-auth adapter against the REAL
// installed Supabase library (nothing in this file mocks the library).
//
// Why a separate file: requestAuthClient.test.ts replaces the library, so it can
// show that no client is built for a refused auth cookie but not what the
// library itself does. Here the library is real, the network is a stub that
// records every call, and the console is spied on.
//
// The adapter gives the library the checked cookie's sign-in token and
// nothing else: it builds its client with createClient from
// @supabase/supabase-js and calls getUser(token). Each refusal here is paired
// with a control, `libraryAlone`, that hands the same cookie to a
// cookie-reading client of the library (createServerClient from @supabase/ssr
// and getUser() with no argument). That is the form the adapter had before
// this slice and the form any reader has that gives the library the cookie
// itself; it then warns, prints, renews or throws. The controls show what the
// shared format check of contract 25 Section 14 keeps away from such a client,
// and what the adapter's own form never does.
//
// The field check (`FCL-001` to `FCL-004`, and `PRL-007` and `PRL-010`). The
// format check's last step opens the cookie and refuses it unless the session
// inside has the form the library can use safely. `FCL-001` hands the adapter
// hostile cookies of every kind the study of 2026-10-06 listed and records
// every place a line could appear: the console methods, direct writes to
// stdout and stderr, process warnings and unhandled rejections. `FCL-002` shows
// with the library alone that the same recording does catch what the library
// does with such cookies. `FCL-003` covers what the check does not judge,
// and `FCL-004` is the round trip: cookies that the library's own writer
// produces are accepted.
//
// A late or replayed auth cookie (`PRL-008` and `PRL-009`) passes the format
// check. Through the adapter its token is sent once to Supabase Auth's user
// endpoint, no renewal is asked for, nothing reaches a cookie setter and
// nothing is printed; the stand-in for Supabase Auth refuses the token and
// the request is denied. The controls show the renewal that a cookie-reading
// client asks for with the same cookie. More of the same, with a clock that
// is moved between the check and the call, is in
// requestAuthClient.directToken.realLibrary.test.ts.
//
// Odd characters are built with String.fromCharCode, so that this file holds
// only plain ASCII. Every value is synthetic. No request leaves the process:
// fetch is replaced.

import { Buffer } from "node:buffer";
import { formatWithOptions } from "node:util";

import { createServerClient } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createInMemoryRequestCookieAccessor,
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
const LIBRARY_DEFAULT_AUTH_COOKIE = "sb-127-auth-token";
const SESSION_ID = "5e5510a0-0000-4000-8000-0000000000b1";
const AUTH_USER_ID = "22222222-2222-4222-8222-222222222222";
const ACCESS_TOKEN = "synthetic.access.token-do-not-leak";
const REFRESH_TOKEN = "synthetic-refresh-token-do-not-leak";
const ROTATED_ACCESS_TOKEN = "synthetic.ROTATED.access.token-do-not-leak";
const ROTATED_REFRESH_TOKEN = "synthetic-ROTATED-refresh-token-do-not-leak";
const TOKEN_TEXT_MARKER = "TOKEN-TEXT-do-not-leak";

const ch = (code: number): string => String.fromCharCode(code);
const BS = ch(92);
const LF = ch(10);
const CR = ch(13);
const NUL = ch(0);
const ESC = ch(27);
const BOM = ch(0xfeff);
const KELVIN = ch(0x212a);
const LONG_S = ch(0x17f);
const E_ACUTE = ch(0xe9);
const N_TILDE = ch(0xf1);
const U0100 = ch(0x100);
const EMOJI = String.fromCodePoint(0x1f600);

function encoded(text: string): string {
  return `base64-${Buffer.from(text, "utf8").toString("base64url")}`;
}

function inSeconds(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

// A synthetic stored session as the library keeps one, as an object. By
// default it is far from expiry; a negative expiresInSeconds makes it an
// expired one, which the library alone would try to renew.
function sessionObject(
  overrides: { accessToken?: string; expiresInSeconds?: number } = {},
): Record<string, unknown> {
  return {
    access_token: overrides.accessToken ?? ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    token_type: "bearer",
    expires_in: 3000,
    expires_at: inSeconds(overrides.expiresInSeconds ?? 3000),
    user: { id: AUTH_USER_ID, aud: "authenticated" },
  };
}

function sessionValue(
  overrides: { accessToken?: string; expiresInSeconds?: number } = {},
): string {
  return encoded(JSON.stringify(sessionObject(overrides)));
}

// The JSON text of a good session with one field written as raw JSON text, so
// that a number can be written as `1e400`, a key can be written twice, and a
// string can carry a JSON escape that this file spells out with BS.
const RAW_SLOT = "@@RAW-SLOT@@";
function sessionTextWithRaw(field: string, rawJson: string): string {
  return JSON.stringify({ ...sessionObject(), [field]: RAW_SLOT }).replace(
    JSON.stringify(RAW_SLOT),
    () => rawJson,
  );
}

function requestCookies(authValue: string): RequestCookie[] {
  return [
    { name: AUTH_COOKIE, value: authValue },
    { name: BINDING_COOKIE, value: SESSION_ID },
  ];
}

function source(cookies: RequestCookie[]) {
  return createSupabaseRequestAuthPrincipalSource({
    cookies: createInMemoryRequestCookieAccessor(cookies),
  });
}

// The same cookies handed to a cookie-reading client of the library
// (@supabase/ssr and getUser() with no argument), with no format check first.
// The adapter does not do this: it hands the library the checked cookie's
// token only. A rejected getUser() is reported, not thrown.
async function libraryAlone(
  cookies: RequestCookie[],
  setAll: (cookiesToSet: Array<{ name: string; value: string }>) => void = () => undefined,
): Promise<{ rejected: boolean }> {
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookieOptions: { name: AUTH_COOKIE },
    cookies: {
      getAll: () => cookies.map((cookie) => ({ ...cookie })),
      setAll: (cookiesToSet) => setAll(cookiesToSet.map((cookie) => ({ name: cookie.name, value: cookie.value }))),
    },
  });
  try {
    await client.auth.getUser();
    return { rejected: false };
  } catch {
    return { rejected: true };
  }
}

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
type ConsoleSpies = Record<(typeof CONSOLE_METHODS)[number], ReturnType<typeof vi.spyOn>>;
let consoleSpies: ConsoleSpies;
let fetchMock: ReturnType<typeof vi.fn>;
const savedEnv: Record<string, string | undefined> = {};

function consoleCallCount(): number {
  return CONSOLE_METHODS.reduce((total, method) => total + consoleSpies[method].mock.calls.length, 0);
}

function consoleText(): string {
  return CONSOLE_METHODS.flatMap((method) => consoleSpies[method].mock.calls)
    .flat()
    .map((part) => (part instanceof Error ? `${part.name}: ${part.message}` : String(part)))
    .join("\n");
}

beforeEach(() => {
  for (const name of [REQUEST_AUTH_URL_ENV, REQUEST_AUTH_ANON_KEY_ENV, SOLMIND_TRUSTED_APP_ORIGIN_ENV]) {
    savedEnv[name] = process.env[name];
  }
  process.env[REQUEST_AUTH_URL_ENV] = SUPABASE_URL;
  process.env[REQUEST_AUTH_ANON_KEY_ENV] = ANON_KEY;
  process.env[SOLMIND_TRUSTED_APP_ORIGIN_ENV] = "http://127.0.0.1:3000";
  // No request may leave the process. A test that expects a call sets an answer.
  fetchMock = vi.fn(async () => {
    throw new Error("unexpected network call");
  });
  vi.stubGlobal("fetch", fetchMock);
  consoleSpies = Object.fromEntries(
    CONSOLE_METHODS.map((method) => [method, vi.spyOn(console, method).mockImplementation(() => undefined)]),
  ) as ConsoleSpies;
});

afterEach(() => {
  for (const method of CONSOLE_METHODS) {
    consoleSpies[method].mockRestore();
  }
  vi.unstubAllGlobals();
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The paths the library asked the Auth server for, in order.
function requestedPaths(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]).replace(SUPABASE_URL, ""));
}

// A stand-in for Supabase Auth that first does what the platform's fetch does
// before any network use: it builds a Request from its arguments, which checks
// every header value. A token in `accepted` gets the user; any other token
// gets a refusal whose message REPEATS the token text, so that a test can show
// that the error the library returns is never printed. A renewal request gets
// `renewal`, when one is given. When none is given it gets a fixed refusal
// that the library does not retry: a thrown call would count as a network
// failure, which the library retries for about 25 seconds, long enough to
// reach the fetch stub of the tests that follow.
function answerAsSupabaseAuth(options: { accepted?: string[]; renewal?: () => Response } = {}): void {
  const accepted = options.accepted ?? [ACCESS_TOKEN];
  fetchMock.mockImplementation(async (url: unknown, init?: unknown) => {
    const request = new Request(String(url), init as RequestInit);
    const path = new URL(request.url).pathname;
    if (path === "/auth/v1/user") {
      const authorization = request.headers.get("authorization") ?? "";
      const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (accepted.includes(bearer)) {
        return jsonResponse({ id: AUTH_USER_ID, aud: "authenticated" }, 200);
      }
      return jsonResponse({ code: "bad_jwt", message: `invalid JWT: ${bearer}` }, 403);
    }
    if (path === "/auth/v1/token" && options.renewal !== undefined) {
      return options.renewal();
    }
    if (path === "/auth/v1/token") {
      return jsonResponse({ code: "validation_failed", message: "no renewal answer configured" }, 400);
    }
    throw new Error("unexpected network call");
  });
}

// Every place a line could appear while `run` works and for a moment after it
// (the library starts two background session loads that nobody awaits): the
// console methods, direct writes to stdout and stderr, process warnings, and
// unhandled rejections. While the unhandled-rejection listener here is
// registered, the test runner leaves such rejections to it.
type Recorded<T> = { value: T; lines: string[]; unhandled: string[] };

async function recordEverySink<T>(run: () => Promise<T>): Promise<Recorded<T>> {
  const lines: string[] = [];
  const unhandled: string[] = [];
  const before = consoleCallCount();
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
    // As Next prints one: the reason itself, through console.error.
    unhandled.push(formatWithOptions({ colors: false }, reason));
  };
  process.on("warning", onWarning);
  process.on("unhandledRejection", onUnhandled);
  let value: T;
  try {
    value = await run();
    await new Promise((resolve) => setTimeout(resolve, 30));
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
    process.removeListener("warning", onWarning);
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  }
  for (const method of CONSOLE_METHODS) {
    for (const call of consoleSpies[method].mock.calls) {
      lines.push(`console.${method}: ${formatWithOptions({ colors: false }, ...call)}`);
    }
  }
  expect(before).toBe(0);
  return { value, lines, unhandled };
}

// Does a printed text carry anything of a visitor-chosen string? Any 8
// characters of it count, as they are or JSON-escaped, percent-encoded, in
// hex or in base64, without regard to case; and so does the platform's
// message that gives a position and a character code.
function carries(text: string, secrets: ReadonlyArray<string>): boolean {
  if (/index \d+ has a value of \d+/.test(text)) {
    return true;
  }
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

describe("request-auth adapter with the real Supabase library -a malformed auth cookie (contract 25 Section 14; item 11)", () => {
  // Values the library's own base64url decoder throws on. The first is review
  // #149a's: four bytes that add up to a code point above U+10FFFF, which the
  // decoder's error names as a number. The second is an invalid UTF-8 start
  // byte. The third has a character outside the decoder's alphabet. The
  // fourth is the first one's four bytes inside the `note` string of a session
  // that is good in every other respect, where only the strict UTF-8 step of
  // the format check can refuse it (a bare value is no session, so the field
  // check would refuse it in any case).
  const [SESSION_HEAD, SESSION_TAIL] = JSON.stringify({ ...sessionObject(), note: "@@" }).split("@@");
  const DECODER_THROWS: Array<[string, string]> = [
    ["a code point above U+10FFFF", "base64-9YCAgA"],
    ["an invalid UTF-8 sequence", "base64-gA"],
    ["a character outside the alphabet", "base64-AAA!"],
    [
      "a code point above U+10FFFF inside a session",
      `base64-${Buffer.concat([
        Buffer.from(SESSION_HEAD, "utf8"),
        Buffer.from([0xf5, 0x80, 0x80, 0x80]),
        Buffer.from(SESSION_TAIL, "utf8"),
      ]).toString("base64url")}`,
    ],
  ];

  it.each(DECODER_THROWS)("PRL-001 is refused before the library reads it, so the library's warning never runs: %s", async (_label, value) => {
    const cookies: RequestCookie[] = [
      { name: AUTH_COOKIE, value },
      { name: BINDING_COOKIE, value: SESSION_ID },
    ];

    await expect(source(cookies).resolveAuthenticatedUser()).resolves.toBeNull();
    expect(consoleCallCount()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();

    // Control: a cookie-reading client, with no format check first, decodes
    // the same cookie, fails, and passes its decoder's error to console.warn.
    await libraryAlone(cookies);
    expect(consoleSpies.warn).toHaveBeenCalled();
    expect(consoleText()).toContain("could not base64url-decode chunked cookie value");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PRL-002 the refused value is the one whose library warning would carry a number derived from the cookie", async () => {
    const cookies: RequestCookie[] = [
      { name: AUTH_COOKIE, value: "base64-9YCAgA" },
      { name: BINDING_COOKIE, value: SESSION_ID },
    ];

    await expect(source(cookies).resolveAuthenticatedUser()).resolves.toBeNull();
    expect(consoleText()).toBe("");

    await libraryAlone(cookies);
    // 0x140000, the code point the four bytes F5 80 80 80 add up to.
    expect(consoleText()).toContain("1310720");
  });

  it("PRL-003 a malformed chunk beside a well-formed auth cookie refuses the whole cookie, with no library call", async () => {
    const cookies: RequestCookie[] = [
      { name: AUTH_COOKIE, value: sessionValue() },
      { name: `${AUTH_COOKIE}.0`, value: "not base64url: <>" },
      { name: BINDING_COOKIE, value: SESSION_ID },
    ];

    await expect(source(cookies).resolveAuthenticatedUser()).resolves.toBeNull();
    expect(consoleCallCount()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("request-auth adapter with the real Supabase library -the shared name and the binding cookie (contract 25 Sections 5.2 and 8)", () => {
  function answerUserRequest(): void {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ id: AUTH_USER_ID, aud: "authenticated" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  it("PRL-004 the auth cookie is read under the shared name, the library verifies its token once with Supabase, and the presented session UUID rides on the principal", async () => {
    answerUserRequest();

    await expect(
      source([
        { name: AUTH_COOKIE, value: sessionValue() },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ]).resolveAuthenticatedUser(),
    ).resolves.toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
      presentedSessionId: SESSION_ID,
    });

    // One verification request, to the Auth server's user endpoint, carrying
    // the access token from the cookie; no refresh and no other call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [unknown, { method?: string; headers?: unknown }];
    expect(String(url)).toBe(`${SUPABASE_URL}/auth/v1/user`);
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers as HeadersInit).get("authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(consoleCallCount()).toBe(0);
  });

  it("PRL-005 the same session under the library's default cookie name is not read: no verification request is made", async () => {
    answerUserRequest();

    await expect(
      source([
        { name: LIBRARY_DEFAULT_AUTH_COOKIE, value: sessionValue() },
        { name: BINDING_COOKIE, value: SESSION_ID },
      ]).resolveAuthenticatedUser(),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleCallCount()).toBe(0);
  });

  it("PRL-006 a Supabase session alone is not verified at all: without the binding cookie no request is made", async () => {
    answerUserRequest();

    await expect(
      source([{ name: AUTH_COOKIE, value: sessionValue() }]).resolveAuthenticatedUser(),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleCallCount()).toBe(0);
  });

  it("PRL-007 a well-encoded auth cookie that is not a session is refused by the field check before the library reads it: a silent console, where the library alone prints its invalid-JSON warning", async () => {
    // Text that is not JSON passes every earlier step of the format check
    // (allowed characters, the base64- start, strictly valid UTF-8). The
    // field check refuses it, so the library never decodes it.
    const marker = "plain text, not a session";
    const cookies = requestCookies(encoded(marker));
    await expect(source(cookies).resolveAuthenticatedUser()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleCallCount()).toBe(0);

    // Control: the library alone treats the same cookie as absent and says so
    // with its own warning, which carries no part of the value.
    await libraryAlone(cookies);
    expect(consoleSpies.warn).toHaveBeenCalled();
    expect(consoleText()).toContain("chunked cookie decoded to invalid JSON");
    expect(consoleText()).not.toContain(marker);
    expect(consoleText()).not.toContain(SESSION_ID);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// An accessor whose setter records what the adapter hands it. On a route the
// accessor's setter is the banked no-op.
function recordingAccessor(cookies: RequestCookie[]): {
  accessor: RequestCookieAccessor;
  setAll: ReturnType<typeof vi.fn>;
} {
  const setAll = vi.fn();
  return {
    accessor: { getAll: () => cookies.map((cookie) => ({ ...cookie })), setAll },
    setAll,
  };
}

describe("request-auth adapter with the real Supabase library -a late or replayed auth cookie (contract 25 Section 7; items 6 and 11)", () => {
  // A well-formed auth cookie whose access token expired ten minutes ago, as a
  // Cookie header sent late or replayed carries one. A cookie-reading client
  // of the library would try to renew it; the adapter hands the library the
  // cookie's token only, and Supabase Auth's answer about that token decides.
  function lateCookies(): RequestCookie[] {
    return [
      { name: AUTH_COOKIE, value: sessionValue({ expiresInSeconds: -600 }) },
      { name: BINDING_COOKIE, value: SESSION_ID },
    ];
  }

  function rotatedSession(): Record<string, unknown> {
    return {
      access_token: ROTATED_ACCESS_TOKEN,
      refresh_token: ROTATED_REFRESH_TOKEN,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: inSeconds(3600),
      user: { id: AUTH_USER_ID, aud: "authenticated" },
    };
  }

  // Through the adapter, for a late cookie: one verification request that
  // carries the cookie's own token, no request to the token endpoint, nothing
  // handed to the accessor's setter, nothing printed, no unhandled rejection,
  // and a denial (the stand-in refuses the cookie's token; what the real
  // Supabase Auth answers is not tested here).
  async function expectVerifiedOnceAndDenied(cookies: RequestCookie[]): Promise<void> {
    const { accessor, setAll } = recordingAccessor(cookies);
    const recorded = await recordEverySink(() =>
      createSupabaseRequestAuthPrincipalSource({ cookies: accessor }).resolveAuthenticatedUser(),
    );

    expect(recorded.value).toBeNull();
    expect(requestedPaths()).toEqual(["/auth/v1/user"]);
    const [, verification] = fetchMock.mock.calls[0] as [unknown, { method?: string; headers?: unknown; body?: unknown }];
    expect(verification.method).toBe("GET");
    expect(verification.body).toBe(undefined);
    expect(new Headers(verification.headers as HeadersInit).get("authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(setAll).not.toHaveBeenCalled();
    expect(recorded.lines).toEqual([]);
    expect(recorded.unhandled).toEqual([]);

    // With the banked read-only accessor the request's cookies are unchanged.
    fetchMock.mockClear();
    const readOnly = createInMemoryRequestCookieAccessor(cookies);
    await expect(
      createSupabaseRequestAuthPrincipalSource({ cookies: readOnly }).resolveAuthenticatedUser(),
    ).resolves.toBeNull();
    expect(readOnly.getAll()).toEqual(cookies);
    expect(requestedPaths()).toEqual(["/auth/v1/user"]);
    expect(consoleCallCount()).toBe(0);
    fetchMock.mockClear();
  }

  it("PRL-008 a late auth cookie: the adapter asks Supabase Auth about the cookie's token once, asks for no renewal, hands nothing to a cookie setter and prints nothing, and the refused token denies; where a cookie-reading client renews the token and hands the rotated session to its setter", async () => {
    // Supabase Auth would accept the renewal and the rotated token, and
    // refuses the cookie's own token.
    answerAsSupabaseAuth({
      accepted: [ROTATED_ACCESS_TOKEN],
      renewal: () => jsonResponse(rotatedSession(), 200),
    });
    const cookies = lateCookies();

    await expectVerifiedOnceAndDenied(cookies);

    // Control: a cookie-reading client, given the same cookies, asks for a
    // renewal with the cookie's renewal token, verifies with the rotated
    // access token, and hands the rotated session to its cookie setter.
    const written: Array<{ name: string; value: string }> = [];
    await libraryAlone(cookies, (cookiesToSet) => {
      written.push(...cookiesToSet);
    });
    expect(requestedPaths()).toEqual(["/auth/v1/token?grant_type=refresh_token", "/auth/v1/user"]);
    const [, renewal] = fetchMock.mock.calls[0] as [unknown, { body?: unknown }];
    expect(JSON.parse(String(renewal.body))).toEqual({ refresh_token: REFRESH_TOKEN });
    const [, verification] = fetchMock.mock.calls[1] as [unknown, { headers?: unknown }];
    expect(new Headers(verification.headers as HeadersInit).get("authorization")).toBe(
      `Bearer ${ROTATED_ACCESS_TOKEN}`,
    );
    expect(written.map((cookie) => cookie.name)).toEqual([AUTH_COOKIE]);
    const rotated = JSON.parse(
      Buffer.from(written[0].value.slice("base64-".length), "base64url").toString("utf8"),
    ) as { access_token?: unknown; refresh_token?: unknown };
    expect(rotated.access_token).toBe(ROTATED_ACCESS_TOKEN);
    expect(rotated.refresh_token).toBe(ROTATED_REFRESH_TOKEN);
  });

  it("PRL-009 a replayed auth cookie whose renewal the Auth server would refuse (an already used refresh token): the adapter asks for no renewal and prints nothing, and the refused token denies; where a cookie-reading client asks once, prints lines of its own and hands removal entries to its setter", async () => {
    answerAsSupabaseAuth({
      accepted: [],
      renewal: () =>
        jsonResponse(
          {
            code: 400,
            error_code: "refresh_token_already_used",
            msg: "Invalid Refresh Token: Already Used",
          },
          400,
        ),
    });
    const cookies = lateCookies();

    await expectVerifiedOnceAndDenied(cookies);

    // Control: a cookie-reading client makes one renewal attempt and no
    // verification, clears its stored session by handing removal entries to
    // its setter (an empty value under the auth cookie's own name), and prints
    // lines of its own for the refused renewal. Those lines carry no token and
    // no session UUID.
    const written: Array<{ name: string; value: string }> = [];
    await libraryAlone(cookies, (cookiesToSet) => {
      written.push(...cookiesToSet);
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(requestedPaths()).toEqual(["/auth/v1/token?grant_type=refresh_token"]);
    expect(written.length).toBeGreaterThan(0);
    for (const cookie of written) {
      expect(cookie.name === AUTH_COOKIE || cookie.name.startsWith(`${AUTH_COOKIE}.`)).toBe(true);
      expect(cookie.value).toBe("");
    }
    expect(consoleCallCount()).toBeGreaterThan(0);
    const printed = consoleText();
    for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN, "do-not-leak", SESSION_ID]) {
      expect(printed).not.toContain(secret);
    }
  });
});

describe("request-auth adapter with the real Supabase library -token text the platform refuses, inside a well-encoded auth cookie (contract 25 Section 14: the field check)", () => {
  // Each cookie passes every earlier step of the shared format check: allowed
  // characters, the base64- start, and strictly valid UTF-8. The session
  // inside holds an access token that cannot be an HTTP header value.
  const REFUSED_TOKEN_TEXT: Array<[string, string, string]> = [
    ["a line break", `synthetic${LF}${TOKEN_TEXT_MARKER} second line`, TOKEN_TEXT_MARKER],
    ["a NUL character", `synthetic${NUL}${TOKEN_TEXT_MARKER}`, TOKEN_TEXT_MARKER],
    ["a character above U+00FF", `synthetic${ch(0x2713)}${TOKEN_TEXT_MARKER}`, "has a value of 10003"],
  ];

  it.each(REFUSED_TOKEN_TEXT)("PRL-010 an access token holding %s is refused by the field check before the library exists: no request, nothing set and a silent console, where the library alone prints the platform's refusal", async (_label, accessToken, printedByTheLibrary) => {
    answerAsSupabaseAuth();

    // Control: an ordinary token passes the same stand-in, silently.
    await expect(source(requestCookies(sessionValue())).resolveAuthenticatedUser()).resolves.not.toBeNull();
    expect(consoleCallCount()).toBe(0);
    fetchMock.mockClear();

    const cookies = requestCookies(sessionValue({ accessToken }));
    const { accessor, setAll } = recordingAccessor(cookies);
    const recorded = await recordEverySink(() =>
      createSupabaseRequestAuthPrincipalSource({ cookies: accessor }).resolveAuthenticatedUser(),
    );

    // The field check refuses the cookie: the library is never built, so no
    // request is attempted, nothing is set and nothing is printed anywhere.
    expect(recorded.value).toBeNull();
    expect(requestedPaths()).toEqual([]);
    expect(setAll).not.toHaveBeenCalled();
    expect(recorded.lines).toEqual([]);
    expect(recorded.unhandled).toEqual([]);

    // Control: the library alone builds its request from the token text, the
    // platform refuses the Authorization header, and the library prints that
    // error with console.error. For a line break or a NUL the error quotes the
    // text; for a character above U+00FF it gives the character's code.
    await libraryAlone(cookies);
    expect(requestedPaths()).toEqual(["/auth/v1/user"]);
    expect(consoleSpies.error).toHaveBeenCalledTimes(1);
    expect(consoleText()).toContain(printedByTheLibrary);
  });
});

describe("request-auth adapter with the real Supabase library -the field check against hostile cookies (contract 25 Section 14; item 11)", () => {
  const GOOD = sessionObject();
  const marker = (name: string): string => `MARK${name}Q7zk9xKw`;
  const hostileToken = (name: string, odd: string): string => `synthetic.${marker(name)}${odd}tail.signature`;

  // [label, the cookie's decoded text, the visitor-chosen strings in it]. The
  // study's list (the challenge report's recommendation), each through the
  // adapter. Where a JSON string cannot hold a character raw, the escape is
  // spelled out with BS.
  const HOSTILE: Array<[string, string, string[]]> = [
    ["the Kelvin sign in the token", JSON.stringify({ ...GOOD, access_token: hostileToken("KELVIN", KELVIN) }), [marker("KELVIN")]],
    ["the long s in the token", JSON.stringify({ ...GOOD, access_token: hostileToken("LONGS", LONG_S) }), [marker("LONGS")]],
    ["a good token followed by one line feed", JSON.stringify({ ...GOOD, access_token: `${ACCESS_TOKEN}${LF}` }), [ACCESS_TOKEN]],
    ["a good token, a line feed, then free text", JSON.stringify({ ...GOOD, access_token: `${ACCESS_TOKEN}${LF}${marker("SECONDLINE")} forged log line` }), [marker("SECONDLINE")]],
    ["the token as an array", JSON.stringify({ ...GOOD, access_token: [hostileToken("ARRAY", LF)] }), [marker("ARRAY")]],
    ["the token as an object with a toString key", JSON.stringify({ ...GOOD, access_token: { toString: 1, note: marker("OBJECT") } }), [marker("OBJECT")]],
    ["the token written twice: good first, hostile last", `${JSON.stringify(GOOD).slice(0, -1)},"access_token":${JSON.stringify(hostileToken("DUPLAST", LF))}}`, [marker("DUPLAST")]],
    ["a __proto__ key that carries the fields, none at the top level", `{"__proto__":${JSON.stringify({ ...GOOD, access_token: hostileToken("PROTO", LF) })}}`, [marker("PROTO")]],
    ["a byte-order mark before a good session", `${BOM}${JSON.stringify(GOOD)}`, []],
    ["a byte-order mark before a hostile session", `${BOM}${JSON.stringify({ ...GOOD, access_token: hostileToken("BOM", LF) })}`, [marker("BOM")]],
    ["expires_at written 1e400", sessionTextWithRaw("expires_at", "1e400"), []],
    ["expires_at 2 to the 53", sessionTextWithRaw("expires_at", "9007199254740992"), []],
    ["expires_at 0.5", sessionTextWithRaw("expires_at", "0.5"), []],
    ["expires_at 0", sessionTextWithRaw("expires_at", "0"), []],
    ["expires_at -5", sessionTextWithRaw("expires_at", "-5"), []],
    ["expires_at as an object with a toString key", sessionTextWithRaw("expires_at", '{"toString":1}'), []],
    ["expires_at as the text 1", sessionTextWithRaw("expires_at", '"1"'), []],
    ["a line feed in the token, carried by a JSON escape", sessionTextWithRaw("access_token", `"synthetic.${marker("ESCLF")}${BS}ntail.signature"`), [marker("ESCLF")]],
    ["a carriage return in the token, carried by a JSON escape", sessionTextWithRaw("access_token", `"synthetic.${marker("ESCCR")}${BS}rtail.signature"`), [marker("ESCCR")]],
    ["a NUL in the token, carried by a JSON escape", sessionTextWithRaw("access_token", `"synthetic.${marker("ESCNUL")}${BS}u0000tail.signature"`), [marker("ESCNUL")]],
    ["an ESC sequence in the token, carried by a JSON escape", sessionTextWithRaw("access_token", `"synthetic.${marker("ESCESC")}${BS}u001b[2J${BS}ntail.signature"`), [marker("ESCESC")]],
    ["a character above U+00FF in the token, raw", JSON.stringify({ ...GOOD, access_token: hostileToken("RAWHIGH", U0100) }), [marker("RAWHIGH")]],
    ["a character above U+00FF in the token, as a JSON escape", sessionTextWithRaw("access_token", `"synthetic.${marker("ESCHIGH")}${BS}u0100tail.signature"`), [marker("ESCHIGH")]],
    ["the user as text", JSON.stringify({ ...GOOD, user: marker("USERTEXT") }), [marker("USERTEXT")]],
    ["an empty refresh token", JSON.stringify({ ...GOOD, refresh_token: "" }), []],
    ["text that is not JSON", `${marker("NOTJSON")} is not JSON`, [marker("NOTJSON")]],
    ["JSON that is not a session", JSON.stringify({ note: marker("NOTSESSION") }), [marker("NOTSESSION")]],
  ];

  it.each(HOSTILE)("FCL-001 through the adapter nothing is requested, set or printed anywhere, and no rejection goes unhandled: %s", async (_label, text) => {
    answerAsSupabaseAuth();
    const cookies = requestCookies(encoded(text));
    // The cookie passes every earlier step of the format check.
    expect(cookies[0].value).toMatch(/^base64-[A-Za-z0-9_-]+$/);
    expect(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      Buffer.from(cookies[0].value.slice("base64-".length), "base64url"),
    )).toBe(text);
    const { accessor, setAll } = recordingAccessor(cookies);

    const recorded = await recordEverySink(() =>
      createSupabaseRequestAuthPrincipalSource({ cookies: accessor }).resolveAuthenticatedUser(),
    );

    expect(recorded.value).toBeNull();
    expect(requestedPaths()).toEqual([]);
    expect(setAll).not.toHaveBeenCalled();
    expect(recorded.lines).toEqual([]);
    expect(recorded.unhandled).toEqual([]);
  });

  // What the library ALONE does with a few of the same cookies. These controls
  // show that the recording above does catch a printed line, a rejected call
  // and an unhandled rejection when there is one, so that a silent result in
  // FCL-001 means something. They pin the installed library's behaviour.
  it("FCL-002 control, the library alone: it prints the token text or numbers taken from it, rejects, leaves rejections unhandled, or prints its invalid-JSON warning", async () => {
    answerAsSupabaseAuth();
    const textOf = (label: string): [string, string[]] => {
      const found = HOSTILE.find((row) => row[0] === label);
      if (found === undefined) {
        throw new Error(`test setup: no hostile cookie named ${label}`);
      }
      return [found[1], found[2]];
    };
    const alone = async (label: string): Promise<Recorded<{ rejected: boolean }> & { secrets: string[] }> => {
      for (const method of CONSOLE_METHODS) {
        consoleSpies[method].mockClear();
      }
      const [text, secrets] = textOf(label);
      const recorded = await recordEverySink(() => libraryAlone(requestCookies(encoded(text))));
      return { ...recorded, secrets };
    };

    // The platform refuses the header, and the library prints the refusal,
    // which quotes the token text with its real line feed in it.
    const lineFeed = await alone("a line feed in the token, carried by a JSON escape");
    expect(lineFeed.lines.filter((line) => carries(line, lineFeed.secrets))).toHaveLength(1);
    expect(lineFeed.lines.join("")).toContain(`${marker("ESCLF")}${LF}tail`);
    const secondLine = await alone("a good token, a line feed, then free text");
    expect(secondLine.lines.some((line) => carries(line, secondLine.secrets))).toBe(true);
    // For a character above U+00FF the refusal gives a position and a code.
    for (const label of ["the Kelvin sign in the token", "a character above U+00FF in the token, as a JSON escape"]) {
      const high = await alone(label);
      expect(high.lines.filter((line) => /index \d+ has a value of \d+/.test(line)), label).toHaveLength(1);
      expect(high.lines.some((line) => carries(line, [])), label).toBe(true);
    }
    // A token that is an object makes the library's call reject.
    const tokenObject = await alone("the token as an object with a toString key");
    expect(tokenObject.value.rejected).toBe(true);
    // A user that is text leaves the library's two background loads rejected
    // with nobody handling them.
    const userText = await alone("the user as text");
    expect(userText.unhandled).toHaveLength(2);
    // Text that is not JSON: the library's own fixed warning, three times.
    const notJson = await alone("text that is not JSON");
    expect(notJson.lines.filter((line) => line.includes("chunked cookie decoded to invalid JSON"))).toHaveLength(3);
    expect(notJson.lines.some((line) => carries(line, notJson.secrets))).toBe(false);
  });

  it("FCL-003 what the field check does not judge never reaches the library and prints nothing: hostile text in every field but the token, and a hostile renewal token; and a well-shaped token that Supabase Auth refuses prints nothing either", async () => {
    const hostile = `${marker("OTHER")}${LF}${NUL}${ESC}[2J${U0100}${EMOJI}`;
    const hostileRenewal = `${marker("RENEWAL")}${CR}${LF}X-Injected: 1${NUL}`;
    const forged = `forged.${marker("FORGED")}.signature`;
    answerAsSupabaseAuth();

    // Every field but the token is hostile; the token is good. The adapter
    // hands the library the token only, so none of the rest reaches it.
    const everythingElse = JSON.stringify({
      ...GOOD,
      refresh_token: hostileRenewal,
      token_type: hostile,
      expires_in: hostile,
      provider_token: hostile,
      weak_password: { message: hostile, reasons: [hostile] },
      [`key ${hostile}`]: hostile,
      user: { id: AUTH_USER_ID, email: hostile, role: hostile, user_metadata: { note: hostile } },
    });
    const accepted = await recordEverySink(() =>
      source(requestCookies(encoded(everythingElse))).resolveAuthenticatedUser(),
    );
    expect(accepted.value).toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
      presentedSessionId: SESSION_ID,
    });
    // One verification request with the good token, and nothing else: the
    // renewal token is sent nowhere, and no hostile text is in the URL or in
    // any header.
    expect(requestedPaths()).toEqual(["/auth/v1/user"]);
    const [url, init] = fetchMock.mock.calls[0] as [unknown, { headers?: unknown; body?: unknown }];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(init.body).toBe(undefined);
    const sent = [String(url), ...Array.from(headers.entries()).map(([name, value]) => `${name}: ${value}`)].join(LF);
    expect(carries(sent, [marker("OTHER"), marker("RENEWAL")])).toBe(false);
    expect(accepted.lines).toEqual([]);
    expect(accepted.unhandled).toEqual([]);

    // A key written twice with the hostile value first, and a `__proto__` key
    // that carries a hostile token beside a good session: the token handed to
    // the library is the good one in both, the one the field check judged,
    // and the library stays silent.
    const hostileFirst = `{"access_token":${JSON.stringify(hostileToken("DUPFIRST", LF))},${JSON.stringify(GOOD).slice(1)}`;
    const protoBeside = `{"__proto__":{"access_token":${JSON.stringify(hostileToken("PROTOBESIDE", LF))}},${JSON.stringify(GOOD).slice(1)}`;
    for (const text of [hostileFirst, protoBeside]) {
      fetchMock.mockClear();
      const quiet = await recordEverySink(() => source(requestCookies(encoded(text))).resolveAuthenticatedUser());
      expect(quiet.value).not.toBeNull();
      expect(requestedPaths()).toEqual(["/auth/v1/user"]);
      const [, quietInit] = fetchMock.mock.calls[0] as [unknown, { headers?: unknown }];
      expect(new Headers(quietInit.headers as HeadersInit).get("authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
      expect(quiet.lines).toEqual([]);
      expect(quiet.unhandled).toEqual([]);
    }

    // A well-shaped token that Supabase Auth refuses. The stand-in's refusal
    // repeats the token text; the library returns that error, the adapter
    // drops it, and nothing is printed.
    fetchMock.mockClear();
    const refused = await recordEverySink(() =>
      source(requestCookies(encoded(JSON.stringify({ ...GOOD, access_token: forged })))).resolveAuthenticatedUser(),
    );
    expect(refused.value).toBeNull();
    expect(requestedPaths()).toEqual(["/auth/v1/user"]);
    expect(refused.lines).toEqual([]);
    expect(refused.unhandled).toEqual([]);
  });

  it("FCL-003b when Supabase Auth says the session is gone, the request is denied after one request, nothing reaches the accessor's setter and nothing is printed; where a cookie-reading client hands removal entries to its setter", async () => {
    fetchMock.mockImplementation(async (url: unknown, init?: unknown) => {
      new Request(String(url), init as RequestInit);
      return jsonResponse(
        { error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" },
        403,
      );
    });
    const cookies = requestCookies(sessionValue());
    const { accessor, setAll } = recordingAccessor(cookies);

    const recorded = await recordEverySink(() =>
      createSupabaseRequestAuthPrincipalSource({ cookies: accessor }).resolveAuthenticatedUser(),
    );

    // The library clears its own empty in-memory store and tells its own
    // listener; the adapter gave it no cookie setter, so nothing is handed on.
    expect(recorded.value).toBeNull();
    expect(requestedPaths()).toEqual(["/auth/v1/user"]);
    expect(setAll).not.toHaveBeenCalled();
    expect(recorded.lines).toEqual([]);
    expect(recorded.unhandled).toEqual([]);
    // With the banked read-only accessor the request's cookies are unchanged.
    const readOnly = createInMemoryRequestCookieAccessor(cookies);
    await createSupabaseRequestAuthPrincipalSource({ cookies: readOnly }).resolveAuthenticatedUser();
    expect(readOnly.getAll()).toEqual(cookies);

    // Control: a cookie-reading client, given the same cookies and the same
    // answer, hands removal entries to its setter: an empty value under the
    // auth cookie's name, a chunk name, or the library's code-verifier name.
    fetchMock.mockClear();
    const written: Array<{ name: string; value: string }> = [];
    await libraryAlone(cookies, (cookiesToSet) => {
      written.push(...cookiesToSet);
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(requestedPaths()).toEqual(["/auth/v1/user"]);
    expect(written.length).toBeGreaterThan(0);
    for (const cookie of written) {
      expect(
        cookie.name === AUTH_COOKIE ||
          cookie.name.startsWith(`${AUTH_COOKIE}.`) ||
          cookie.name.startsWith(`${AUTH_COOKIE}-code-verifier`),
      ).toBe(true);
      expect(cookie.value).toBe("");
    }
  });
});

describe("request-auth adapter with the real Supabase library -cookies the library's own writer produces are accepted (contract 25 Section 14: the round trip)", () => {
  // A token in the form Supabase Auth issues: three base64url parts, with a
  // header for the signing method and a synthetic signature of that method's
  // length. Nothing here is signed.
  type Signing = "HS256" | "ES256" | "RS256";
  function tokenShaped(signing: Signing, claims: Record<string, unknown>): string {
    const part = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
    const header = signing === "HS256" ? { alg: signing, typ: "JWT" } : { alg: signing, kid: "synthetic-key-id", typ: "JWT" };
    const length = signing === "HS256" ? 43 : signing === "ES256" ? 86 : 342;
    const signature = "sIGNATURE-synthetic_".repeat(20).slice(0, length);
    return `${part(header)}.${part({ sub: AUTH_USER_ID, aud: "authenticated", role: "authenticated", ...claims })}.${signature}`;
  }

  function tokenAnswer(signing: Signing, profile: Record<string, unknown> = {}): Record<string, unknown> {
    const expiresAt = inSeconds(3600);
    return {
      access_token: tokenShaped(signing, { exp: expiresAt, user_metadata: profile }),
      token_type: "bearer",
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: "synthrefresh1",
      user: {
        id: AUTH_USER_ID,
        aud: "authenticated",
        role: "authenticated",
        email: "synthetic@example.invalid",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: profile,
      },
    };
  }

  // The cookies the installed library's own writer produces for a sign-in
  // whose token answer is `answer`: its JSON, its encoding and its chunker.
  async function writtenByTheLibrary(
    answer: Record<string, unknown>,
    how: "code" | "password",
    tokensOnly: boolean,
  ): Promise<RequestCookie[]> {
    fetchMock.mockImplementation(async () => jsonResponse(answer, 200));
    // The last value the library hands its setter for each cookie name.
    const captured = new Map<string, string>();
    const client = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookieOptions: { name: AUTH_COOKIE },
      cookies: {
        getAll: () => [],
        setAll: (cookiesToSet) => {
          for (const cookie of cookiesToSet) {
            captured.set(cookie.name, cookie.value);
          }
        },
        ...(tokensOnly ? { encode: "tokens-only" as const } : {}),
      },
    });
    const result =
      how === "password"
        ? await client.auth.signInWithPassword({ email: "synthetic@example.invalid", password: "synthetic-password-value" })
        : await client.auth.verifyOtp({ email: "synthetic@example.invalid", token: "123456", type: "email" });
    expect(result.error).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 30));
    fetchMock.mockClear();
    return Array.from(captured.entries())
      .filter(([, value]) => value !== "")
      .map(([name, value]) => ({ name, value }));
  }

  function decodedText(cookies: RequestCookie[]): string {
    const joined = cookies.length === 1 ? cookies[0].value : cookies.map((cookie) => cookie.value).join("");
    return Buffer.from(joined.slice("base64-".length), "base64url").toString("utf8");
  }

  // Through the adapter: the principal resolves after exactly one
  // verification request that carries the token the library wrote, and
  // nothing is printed anywhere.
  async function expectAccepted(written: RequestCookie[], accessToken: string): Promise<void> {
    answerAsSupabaseAuth({ accepted: [accessToken] });
    const recorded = await recordEverySink(() =>
      source([...written, { name: BINDING_COOKIE, value: SESSION_ID }]).resolveAuthenticatedUser(),
    );
    expect(recorded.value).toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
      presentedSessionId: SESSION_ID,
    });
    expect(requestedPaths()).toEqual(["/auth/v1/user"]);
    const [, init] = fetchMock.mock.calls[0] as [unknown, { headers?: unknown }];
    expect(new Headers(init.headers as HeadersInit).get("authorization")).toBe(`Bearer ${accessToken}`);
    expect(recorded.lines).toEqual([]);
    expect(recorded.unhandled).toEqual([]);
  }

  const SIGNINGS: Array<[Signing, "code" | "password"]> = [
    ["HS256", "code"],
    ["ES256", "password"],
    ["RS256", "code"],
  ];

  it.each(SIGNINGS)("FCL-004 a session with a %s-shaped token, written by the library after a sign-in by %s, is accepted", async (signing, how) => {
    const answer = tokenAnswer(signing);
    const written = await writtenByTheLibrary(answer, how, false);
    expect(written.length).toBeGreaterThan(0);
    expect((JSON.parse(decodedText(written)) as { access_token: unknown }).access_token).toBe(answer.access_token);
    await expectAccepted(written, String(answer.access_token));
  });

  it("FCL-004 a long profile with accents, an emoji, non-Latin names, quotation marks, a backslash and line breaks, which the library writes in several chunks, is accepted", async () => {
    const profile = {
      full_name: `Jos${E_ACUTE} "Pepe" Nu${N_TILDE}ez ${EMOJI} ${ch(0x674e)}${ch(0x96f7)} ${ch(0x417)}${ch(0x43e)}${ch(0x44f)}`,
      note: `line one${LF}line two ${BS} backslash${ch(9)}tab${CR}${LF}`,
      bio: `plain words about a person ${E_ACUTE}${EMOJI} `.repeat(90),
    };
    const answer = tokenAnswer("HS256", profile);
    const written = await writtenByTheLibrary(answer, "code", false);
    expect(written.length).toBeGreaterThan(1);
    expect(written.map((cookie) => cookie.name)).toEqual(written.map((_, index) => `${AUTH_COOKIE}.${index}`));
    const stored = JSON.parse(decodedText(written)) as { user: { user_metadata: Record<string, unknown> } };
    expect(stored.user.user_metadata).toEqual(profile);
    // The stored text holds a backslash (JSON's escapes) and characters above
    // U+00FF, which is why no filter on the whole text can be used.
    expect(decodedText(written)).toContain(BS);
    expect(Array.from(decodedText(written)).some((character) => character.charCodeAt(0) > 0xff)).toBe(true);
    await expectAccepted(written, String(answer.access_token));
  });

  it("FCL-004 the library's tokens-only form, which keeps no user in the cookie, is accepted", async () => {
    const answer = tokenAnswer("HS256");
    const written = await writtenByTheLibrary(answer, "code", true);
    expect(written.length).toBeGreaterThan(0);
    const stored = JSON.parse(decodedText(written)) as Record<string, unknown>;
    expect("user" in stored).toBe(false);
    expect(stored.access_token).toBe(answer.access_token);
    await expectAccepted(written, String(answer.access_token));
  });

  it("FCL-004 the cookie the library writes after it renews a session is accepted", async () => {
    // The library alone, given an expired session, renews it and hands the
    // new session to its cookie setter. That cookie is what a later writer of
    // renewed sessions would store.
    const renewed = tokenAnswer("ES256");
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes("/auth/v1/token")) {
        return jsonResponse(renewed, 200);
      }
      return jsonResponse({ id: AUTH_USER_ID, aud: "authenticated" }, 200);
    });
    const handed = new Map<string, string>();
    await libraryAlone(requestCookies(sessionValue({ expiresInSeconds: -600 })), (cookiesToSet) => {
      for (const cookie of cookiesToSet) {
        handed.set(cookie.name, cookie.value);
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(requestedPaths()[0]).toBe("/auth/v1/token?grant_type=refresh_token");
    const written: RequestCookie[] = Array.from(handed.entries())
      .filter(([, value]) => value !== "")
      .map(([name, value]) => ({ name, value }));
    expect(written.length).toBeGreaterThan(0);
    expect((JSON.parse(decodedText(written)) as { access_token: unknown }).access_token).toBe(renewed.access_token);
    fetchMock.mockClear();
    await expectAccepted(written, String(renewed.access_token));
  });
});
