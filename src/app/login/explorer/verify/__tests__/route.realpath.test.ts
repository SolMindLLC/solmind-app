// Login step 6, sub-slice S6-8: the Explorer "verify the code and sign in"
// route, through its real path.
//
// The actual handler runs with the real same-origin guard, the real body
// parser, the real composition, the real request-scoped dependency factory,
// login step 5's real redeeming caller and composition root, the two real
// lookup callers, the real link client, the real identity bridge with the
// installed `@supabase/ssr` library, the real session caller, and the real
// login-step cookie writer on a real Next.js response. Only true IO edges are
// stood in for, each in process:
//   - the request's cookies (`next/headers`);
//   - the environment (set per test and restored);
//   - the network: the global `fetch`, replaced by a fake that answers the
//     four database functions by name and a fake Supabase Auth by path, and
//     refuses every other request. The configured Supabase host is a
//     reserved name that cannot resolve;
//   - the SMTP socket: `node:net`'s `createConnection`, replaced for this
//     file by a function that refuses every target. This route sends no
//     mail; the control shows none was attempted;
//   - the waiter's timer: `node:timers/promises`, so no test waits the real
//     response floor;
//   - `Date.now`, fixed, so that lifetimes are exact. Deadlines use the
//     monotonic clock, which is left alone.
// Every value is synthetic. Nothing here reaches a network, a database, the
// local mail catcher or a local Supabase stack.
//
// Contract 25 Section 15 item 2 (hold then write: no cookie on any failure
// after the provider sign-in, cleanup attempted, an induced cleanup failure
// still denies), item 3 (both cookies on one response, only after the
// session call answered, with the no-store headers), item 5 (fixation), item
// 9 (CSRF), item 10 (the fixed destination) and item 11 (leaks).

import { inspect, isDeepStrictEqual } from "node:util";

import { createChunks, stringToBase64URL } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const edge = vi.hoisted(() => ({
  cookiesMock: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  refusedTargets: [] as unknown[],
  delays: [] as unknown[],
  events: [] as string[],
  compositionOverride: null as (() => unknown) | null,
  compositionCalls: [] as unknown[][],
}));

vi.mock("next/headers", () => ({
  cookies: (...args: unknown[]) => (edge.cookiesMock as unknown as (...args: unknown[]) => unknown)(...args),
}));

vi.mock("node:net", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:net")>();
  // This route sends no mail: every connection is refused and recorded.
  const createConnection = (...args: unknown[]): never => {
    edge.refusedTargets.push(args);
    throw new Error("test setup: the verify route opens no socket");
  };
  const replaced = { ...actual, createConnection, connect: createConnection };
  return { ...replaced, default: replaced };
});

vi.mock("node:timers/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:timers/promises")>();
  const setTimeoutFake = (milliseconds: unknown): Promise<void> => {
    edge.delays.push(milliseconds);
    edge.events.push("wait");
    return Promise.resolve();
  };
  return { ...actual, default: { ...actual, setTimeout: setTimeoutFake }, setTimeout: setTimeoutFake };
});

// The composition is the real one. The wrapper only records its argument and
// lets one test make it throw, to reach the handler's own last catch.
vi.mock("@/lib/solmind/supabase/explorerSignInComposition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/solmind/supabase/explorerSignInComposition")>();
  return {
    ...actual,
    verifyExplorerSignInCode: (...args: Parameters<typeof actual.verifyExplorerSignInCode>) => {
      edge.compositionCalls.push(args);
      if (edge.compositionOverride !== null) {
        return edge.compositionOverride();
      }
      return actual.verifyExplorerSignInCode(...args);
    },
  };
});

import {
  readSessionAuthCookieAccessToken,
  readSessionAuthCookies,
  resolveSessionCookiePolicy,
} from "@/lib/solmind/auth/sessionCookiePolicy";
import { createSupabaseRequestAuthPrincipalSource } from "@/lib/solmind/supabase/requestAuthClient";

import * as routeModule from "../route";
import { POST } from "../route";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const TRUSTED_ORIGIN = "http://127.0.0.1:3000";
const ROUTE_PATH = "/login/explorer/verify";
const SUPABASE_URL = "http://supabase.invalid";
const SERVICE_KEY = "synthetic-service-role-key-s68-verify";
const ANON_KEY = "synthetic-anon-key-s68-verify";
const PEPPER_TEXT = Buffer.alloc(32, 0x4d).toString("base64url");

const TYPED_EMAIL = "  Explorer.S68@SolMind.Example ";
const EMAIL = "explorer.s68@solmind.example";
const STORED_EMAIL = "stored.explorer.s68@solmind.example";
const ACCOUNT_ID = "1a111111-1111-4111-8111-11111111111f";
const CONTACT_ID = "2b222222-2222-4222-8222-22222222222e";
const PROVIDER_ID = "3f0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const OTHER_PROVIDER_ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const CHALLENGE_ID = "5d0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const SESSION_ID = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
const OLD_SESSION_ID = "0c0c0c0c-8b3d-4c5e-9f7a-1b2c3d4e5f60";
const CODE = "246810";
const LINK_TOKEN = "5f3a1c9e8b7d6a4f2e1c0b9a8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a";
const SENTINEL = "sentinel-s68-verify-detail";
const RETURN_MARKER = "https://attacker.example/s68-return-marker";
const OLD_AUTH_MARKER = "old-auth-cookie-value-s68";
const OLD_VERIFIER_MARKER = "old-code-verifier-value-s68";
const HOME = "/explorer/home";

// A fixed wall clock: 2026-10-07T07:00:00.000Z.
const FIXED_NOW = Date.UTC(2026, 9, 7, 7, 0, 0);
// A fixed monotonic clock, so that the time a request's work takes on a busy
// computer cannot change the delay the real waiter asks the timer for.
const FIXED_MONOTONIC_NOW = 7_200_000;
// The response floor, as the real waiter asks it of the timer when no
// monotonic time has passed: 1,500 ms here. Paul decided on 2026-10-07
// (morning check-in packet, item 5, option 1) "a fixed wait of about one and
// a half seconds, set from the first local run"; the exact value is still
// open until that run. Record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)".
const RESPONSE_FLOOR_MILLISECONDS = 1_500;
const TOKEN_LIFETIME_SECONDS = 3_600;
// Contract 25 Section 7: the token's remaining life minus 120.
const SESSION_SECONDS = 3_480;

const REDEEM = "solmind_redeem_verification_challenge";
const LOOKUP = "solmind_resolve_login_account";
const CONFIRM = "solmind_confirm_redeemed_login_challenge";
const SESSION = "solmind_create_user_session";
const LINK_PATH = "POST /auth/v1/admin/generate_link";
const VERIFY_PATH = "POST /auth/v1/verify";
const LOGOUT_PATH = "POST /auth/v1/logout?scope=local";
const USER_PATH = "GET /auth/v1/user";
const SIGNAL_LINE = "solmind_login_identity_cleanup_failed\n";

const SIGNED_IN_BODY = `{"outcome":"signed_in","destination":"${HOME}"}`;
const DENIED_BODY = '{"outcome":"denied"}';
const CODE_NOT_ACCEPTED_BODY = '{"outcome":"code_not_accepted"}';
const FIXED_HEADERS = [
  ["cache-control", "private, no-cache, no-store, must-revalidate, max-age=0"],
  ["content-type", "application/json"],
  ["expires", "0"],
  ["pragma", "no-cache"],
  ["x-content-type-options", "nosniff"],
];

type Seen = Readonly<{
  key: string;
  body: Record<string, unknown>;
  apikey: string | null;
  authorization: string | null;
}>;
type Handler = (seen: Seen) => Response | Promise<Response>;

let rpcHandlers: Record<string, Handler> = {};
let authHandlers: Record<string, Handler> = {};
let requests: Seen[] = [];
let unexpectedRequests: string[] = [];
let fetchFake: ReturnType<typeof vi.fn>;
let sessionAnswers: Array<Record<string, unknown>> = [];
let answerCount = 0;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
  });
}

function rows(data: unknown): Response {
  return json(200, data);
}

function databaseError(message: string): Response {
  return json(400, { code: "P0001", message, details: null, hint: null });
}

function segment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

// A Supabase Auth session answer, as the verify endpoint sends it.
function sessionAnswer(userId: string = PROVIDER_ID): Record<string, unknown> {
  answerCount += 1;
  const issuedAt = Math.floor(FIXED_NOW / 1000);
  const accessToken = `${segment({ alg: "HS256", typ: "JWT" })}.${segment({
    aud: "authenticated",
    exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    iat: issuedAt,
    sub: userId,
    role: "authenticated",
    session_id: `synthetic-session-s68-${answerCount}`,
  })}.c3ludGhldGljLXNpZ25hdHVyZS1zNjg`;
  const answer = {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: TOKEN_LIFETIME_SECONDS,
    expires_at: issuedAt + TOKEN_LIFETIME_SECONDS,
    refresh_token: `synthetic-refresh-s68-${answerCount}`,
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: STORED_EMAIL,
      app_metadata: { provider: "email" },
      user_metadata: {},
    },
  };
  sessionAnswers.push(answer);
  return answer;
}

function linkAnswerBody(userId: string = PROVIDER_ID): Record<string, unknown> {
  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: STORED_EMAIL,
    action_link: `${SUPABASE_URL}/auth/v1/verify?token=${LINK_TOKEN}&type=magiclink`,
    email_otp: "135791",
    hashed_token: LINK_TOKEN,
    redirect_to: TRUSTED_ORIGIN,
    verification_type: "magiclink",
  };
}

function accountRow(): Record<string, unknown> {
  return {
    user_account_id: ACCOUNT_ID,
    user_contact_method_id: CONTACT_ID,
    normalized_contact_value: STORED_EMAIL,
    provider_user_id: PROVIDER_ID,
  };
}

// `expires_at` as PostgreSQL prints a timestamptz in JSON.
function printedExpiry(secondsFromNow: number): string {
  return new Date(FIXED_NOW + secondsFromNow * 1000).toISOString().replace("Z", "+00:00");
}

function sessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { outcome: "created", user_session_id: SESSION_ID, expires_at: printedExpiry(SESSION_SECONDS), ...overrides };
}

function stubNetwork(): void {
  fetchFake = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
    const key = rpc !== null && url.search === "" ? rpc[1] : `${method} ${url.pathname}${url.search}`;
    const handler = rpc !== null ? rpcHandlers[key] : authHandlers[key];
    if (url.origin !== SUPABASE_URL || handler === undefined || (rpc !== null && method !== "POST")) {
      unexpectedRequests.push(`${method} ${url.origin}${url.pathname}${url.search}`);
      throw new Error("test setup: unexpected request");
    }
    const seen: Seen = Object.freeze({
      key,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {},
      apikey: headers.get("apikey"),
      authorization: headers.get("authorization"),
    });
    requests.push(seen);
    edge.events.push(rpc !== null ? `rpc:${key}` : `auth:${key}`);
    return handler(seen);
  });
  vi.stubGlobal("fetch", fetchFake);
}

function keys(): string[] {
  return requests.map((request) => request.key);
}

function stubEnvironment(overrides: Record<string, string> = {}): void {
  const values: Record<string, string> = {
    SOLMIND_TRUSTED_APP_ORIGIN: TRUSTED_ORIGIN,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    SOLMIND_VERIFICATION_PEPPER: PEPPER_TEXT,
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) {
    vi.stubEnv(name, value);
  }
  // The pepper source refuses to load while its public-name tripwire is set,
  // so the tests do not depend on this computer's own environment.
  vi.stubEnv("NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER", undefined);
}

type CookieEntry = Readonly<{ name: string; value: string }>;

const cookieStoreSet = vi.fn();
const cookieStoreDelete = vi.fn();

function presentCookies(entries: ReadonlyArray<CookieEntry>): void {
  edge.cookiesMock.mockImplementation(async () => {
    edge.events.push("cookies");
    return {
      getAll: () => entries.map((entry) => ({ name: entry.name, value: entry.value })),
      // The request's cookie store must never be written.
      set: cookieStoreSet,
      delete: cookieStoreDelete,
    };
  });
}

type PostOptions = Readonly<{
  origin?: string | null;
  secFetchSite?: string | null;
  contentType?: string | null;
  headers?: Record<string, string>;
  query?: string;
  rawBody?: string | null;
  requestOrigin?: string;
}>;

const VALID_BODY = Object.freeze({ identifier: TYPED_EMAIL, challengeId: CHALLENGE_ID, code: CODE });

function post(body: unknown = VALID_BODY, options: PostOptions = {}): NextRequest {
  const headers = new Headers(options.headers);
  const origin = options.origin === undefined ? (options.requestOrigin ?? TRUSTED_ORIGIN) : options.origin;
  if (origin !== null) {
    headers.set("origin", origin);
  }
  const secFetchSite = options.secFetchSite === undefined ? "same-origin" : options.secFetchSite;
  if (secFetchSite !== null) {
    headers.set("sec-fetch-site", secFetchSite);
  }
  const contentType = options.contentType === undefined ? "application/json" : options.contentType;
  if (contentType !== null) {
    headers.set("content-type", contentType);
  }
  const raw = options.rawBody === undefined ? JSON.stringify(body) : options.rawBody;
  return new NextRequest(`${options.requestOrigin ?? TRUSTED_ORIGIN}${ROUTE_PATH}${options.query ?? ""}`, {
    method: "POST",
    headers,
    // An untyped blob, so no content type is added behind the test's back.
    body: raw === null ? null : new Blob([raw]),
  });
}

type SetCookie = Readonly<{ name: string; value: string; attributes: ReadonlyMap<string, string | true>; raw: string }>;

// The installed Next.js mirrors every cookie set on a NextResponse into this
// header on the response object. As read from its source (not run), its
// server drops the header before a route handler's response is sent
// (`send-response.js`: "an internal header not needed for the response").
// Here it is treated as what it is, a second copy of Set-Cookie: it is kept
// apart from the other headers and must hold exactly the Set-Cookie list.
const INTERNAL_COOKIE_MIRROR = "x-middleware-set-cookie";

type Answer = Readonly<{
  status: number;
  text: string;
  // Every header except Set-Cookie and its internal mirror, sorted.
  headers: string[][];
  setCookies: ReadonlyArray<SetCookie>;
  cookieMirror: string | null;
}>;

const answers: Answer[] = [];

function parseSetCookie(raw: string): SetCookie {
  const [pair, ...rest] = raw.split("; ");
  const at = pair.indexOf("=");
  const attributes = new Map<string, string | true>();
  for (const part of rest) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      attributes.set(part.toLowerCase(), true);
    } else {
      attributes.set(part.slice(0, separator).toLowerCase(), part.slice(separator + 1));
    }
  }
  return Object.freeze({ name: pair.slice(0, at), value: decodeURIComponent(pair.slice(at + 1)), attributes, raw });
}

async function read(response: Response): Promise<Answer> {
  const answer: Answer = Object.freeze({
    status: response.status,
    text: await response.text(),
    headers: [...response.headers.entries()]
      .filter(([name]) => name !== "set-cookie" && name !== INTERNAL_COOKIE_MIRROR)
      .sort(([a], [b]) => a.localeCompare(b)),
    setCookies: response.headers.getSetCookie().map(parseSetCookie),
    cookieMirror: response.headers.get(INTERNAL_COOKIE_MIRROR),
  });
  answers.push(answer);
  return answer;
}

async function send(request: NextRequest = post()): Promise<Answer> {
  return read(await POST(request));
}

function expectNoCookie(answer: Answer, body: string, label: string): void {
  expect(answer.status, label).toBe(200);
  expect(answer.text, label).toBe(body);
  expect(answer.headers, label).toEqual(FIXED_HEADERS);
  expect(answer.setCookies.length === 0, `${label}: no cookie is set`).toBe(true);
}

// Nothing was redeemed, looked up, exchanged, created or waited for.
function expectNoEffect(label: string): void {
  expect(requests.length === 0, `${label}: no request was recorded`).toBe(true);
  expect(fetchFake.mock.calls.length === 0, `${label}: the fetch fake was not called`).toBe(true);
  expect(edge.delays, label).toEqual([]);
}

function storedValue(answer: Record<string, unknown>): string {
  return `base64-${stringToBase64URL(JSON.stringify(answer))}`;
}

// The cookies a success must carry for this session answer: the library's
// own encoding of it, as N alone or N.0 to N.k.
function expectedAuthCookies(answer: Record<string, unknown>): CookieEntry[] {
  return createChunks("solmind-auth", storedValue(answer)).map((chunk) => ({ name: chunk.name, value: chunk.value }));
}

function expectSessionAttributes(cookie: SetCookie, label: string): void {
  expect(cookie.attributes.get("path"), label).toBe("/");
  const publishedAge = Number(cookie.attributes.get("max-age"));
  expect(publishedAge >= SESSION_SECONDS - 1 && publishedAge <= SESSION_SECONDS, label).toBe(true);
  expect(cookie.attributes.get("httponly"), label).toBe(true);
  expect(String(cookie.attributes.get("samesite")).toLowerCase(), label).toBe("lax");
  expect(cookie.attributes.has("domain"), label).toBe(false);
  // The trusted origin is plain-http loopback: no Secure and no prefix.
  expect(cookie.attributes.has("secure"), label).toBe(false);
  expect(cookie.name.startsWith("__Host-"), label).toBe(false);
  // The framework derives Expires from the same Max-Age.
  if (cookie.attributes.has("expires")) {
    expect(cookie.attributes.get("expires"), label).toBe(new Date(FIXED_NOW + publishedAge * 1000).toUTCString());
  }
}

function expectRemoval(cookie: SetCookie | undefined, label: string): void {
  expect(cookie, label).toBeDefined();
  expect(cookie?.value === "", `${label}: the value is empty`).toBe(true);
  expect(cookie?.attributes.get("max-age"), label).toBe("0");
  expect(cookie?.attributes.get("path"), label).toBe("/");
  expect(cookie?.attributes.get("httponly"), label).toBe(true);
  expect(cookie?.attributes.has("domain"), label).toBe(false);
}

// A success's cookies: the auth cookie (or chunks) and the binding cookie.
function expectSignedIn(answer: Answer, session: Record<string, unknown>, label: string): void {
  expect(answer.status, label).toBe(200);
  expect(answer.text, label).toBe(SIGNED_IN_BODY);
  expect(answer.headers, label).toEqual(FIXED_HEADERS);
  const written = answer.setCookies.filter((cookie) => cookie.value !== "");
  const expected = [...expectedAuthCookies(session), { name: "solmind-session", value: SESSION_ID }];
  const writtenCookies = written.map((cookie) => ({ name: cookie.name, value: cookie.value }));
  expect(JSON.stringify(writtenCookies) === JSON.stringify(expected), label).toBe(true);
  for (const cookie of written) {
    expectSessionAttributes(cookie, `${label}: ${cookie.name}`);
  }
  // The binding cookie is written last.
  expect(answer.setCookies[answer.setCookies.length - 1].name, label).toBe("solmind-session");
}

// --- the leak scan (contract 25 Section 15 item 11) --------------------------

const knownValues = new Map<string, string>();
let stdoutChunks: string[] = [];
let stderrChunks: string[] = [];
const warnings: string[] = [];
const unhandled: string[] = [];
const onWarning = (warning: unknown): void => {
  warnings.push(inspect(warning));
};
const onUnhandled = (reason: unknown): void => {
  unhandled.push(inspect(reason));
};

function encodingsOf(value: string): string[] {
  const bytes = Buffer.from(value, "utf8");
  return [...new Set([value, bytes.toString("base64"), bytes.toString("base64url"), bytes.toString("hex"), encodeURIComponent(value)])];
}

// No recorded sink holds any of this test's known values, plain or encoded.
// By design a value appears in one place only: the cookie values, in
// Set-Cookie, on a success. So the scan covers every console call, both
// output streams, warnings, unhandled rejections, and every answer's body
// and non-cookie headers; and a Set-Cookie header only for a value that is
// not that cookie's own.
function scanForLeaks(): void {
  const consoleText = CONSOLE_METHODS.flatMap((method) =>
    vi.mocked(console[method]).mock.calls.map((call) => inspect(call, { depth: 8 })),
  );
  const answerText = answers.map((answer) => `${answer.text}\n${JSON.stringify(answer.headers)}`);
  const cookieNames = answers.flatMap((answer) => answer.setCookies.map((cookie) => cookie.name));
  const sinks = [...consoleText, ...stdoutChunks, ...stderrChunks, ...warnings, ...unhandled, ...answerText, ...cookieNames].join("\n");
  for (const [label, value] of knownValues) {
    for (const encoded of encodingsOf(value)) {
      expect(sinks.includes(encoded), `${label} appears in a recorded sink`).toBe(false);
    }
  }
  // Request values that must never be echoed into a cookie either.
  for (const answer of answers) {
    for (const cookie of answer.setCookies) {
      for (const label of ["the code", "the selector", "the typed email", "the stored email", "the pepper", "the service-role key", "the link token", "a return address", "an old auth cookie value", "an old code verifier value", "an old session id"]) {
        const value = knownValues.get(label);
        if (value !== undefined) {
          expect(cookie.raw.includes(value), `${label} appears in a Set-Cookie header`).toBe(false);
        }
      }
    }
  }
}

let realConnect: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
  stdoutChunks = [];
  stderrChunks = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdoutChunks.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  });
  warnings.length = 0;
  unhandled.length = 0;
  process.on("warning", onWarning);
  process.on("unhandledRejection", onUnhandled);
  const actualNet = await vi.importActual<typeof import("node:net")>("node:net");
  realConnect = vi.spyOn(actualNet.Socket.prototype, "connect").mockImplementation(() => {
    throw new Error("test setup: a real socket is never opened");
  });
  vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
  vi.spyOn(performance, "now").mockReturnValue(FIXED_MONOTONIC_NOW);

  edge.cookiesMock = vi.fn();
  edge.refusedTargets.length = 0;
  edge.delays.length = 0;
  edge.events.length = 0;
  edge.compositionOverride = null;
  edge.compositionCalls.length = 0;
  cookieStoreSet.mockReset();
  cookieStoreDelete.mockReset();
  answers.length = 0;
  requests = [];
  unexpectedRequests = [];
  sessionAnswers = [];
  rpcHandlers = {
    [REDEEM]: () => rows([{ outcome: "redeemed" }]),
    [LOOKUP]: () => rows([accountRow()]),
    [CONFIRM]: () => rows([{ confirmed: true }]),
    [SESSION]: () => rows([sessionRow()]),
  };
  authHandlers = {
    [LINK_PATH]: () => json(200, linkAnswerBody()),
    [VERIFY_PATH]: () => json(200, sessionAnswer()),
    [LOGOUT_PATH]: () => new Response(null, { status: 204 }),
  };
  knownValues.clear();
  for (const [label, value] of [
    ["the pepper", PEPPER_TEXT],
    ["the service-role key", SERVICE_KEY],
    ["the anon key", ANON_KEY],
    ["the typed email", EMAIL],
    ["the stored email", STORED_EMAIL],
    ["the account id", ACCOUNT_ID],
    ["the contact id", CONTACT_ID],
    ["the provider user id", PROVIDER_ID],
    ["the selector", CHALLENGE_ID],
    ["the code", CODE],
    ["the link token", LINK_TOKEN],
    ["a sentinel", SENTINEL],
    ["a return address", RETURN_MARKER],
    ["an old auth cookie value", OLD_AUTH_MARKER],
    ["an old code verifier value", OLD_VERIFIER_MARKER],
    ["an old session id", OLD_SESSION_ID],
  ] as const) {
    knownValues.set(label, value);
  }
  presentCookies([]);
  stubEnvironment();
  stubNetwork();
});

afterEach(() => {
  process.off("warning", onWarning);
  process.off("unhandledRejection", onUnhandled);

  // The checks run in `try` and the restores in `finally`, so that a failed
  // check here cannot leave a spy in place for the tests after it.
  try {
    // ESR-L-001: the leak scan, after every test. Every verifier, token and
    // cookie value this test produced is added first. The session UUID and
    // the cookie values may appear in Set-Cookie on a success, and nowhere
    // else.
    for (const request of requests) {
      if (request.key === REDEEM && typeof request.body.p_verifier === "string") {
        knownValues.set("a verifier", request.body.p_verifier);
      }
    }
    knownValues.set("the session id", SESSION_ID);
    sessionAnswers.forEach((answer, index) => {
      knownValues.set(`access token ${index}`, answer.access_token as string);
      knownValues.set(`refresh token ${index}`, answer.refresh_token as string);
      expectedAuthCookies(answer).forEach((cookie, chunk) => {
        knownValues.set(`auth cookie value ${index}.${chunk}`, cookie.value);
      });
    });
    scanForLeaks();
    for (const method of CONSOLE_METHODS) {
      expect(vi.mocked(console[method]).mock.calls.length === 0, `console.${method} was not called`).toBe(true);
    }
    expect(stdoutChunks.length === 0, "nothing was written to standard output").toBe(true);
    // Standard error carries nothing but the one fixed signal line.
    for (const chunk of stderrChunks) {
      expect(chunk === SIGNAL_LINE, "standard error carries nothing but the fixed signal line").toBe(true);
    }
    expect(warnings.length === 0, "no process warning was raised").toBe(true);
    expect(unhandled.length === 0, "no rejection was left unhandled").toBe(true);

    // The control check, after every test: no socket was asked for or
    // opened, no request left for an unexpected address, and the request's
    // own cookie store was never written.
    expect(edge.refusedTargets).toEqual([]);
    expect(realConnect).not.toHaveBeenCalled();
    expect(unexpectedRequests).toEqual([]);
    expect(cookieStoreSet.mock.calls.length === 0, "the request's cookie store was never set").toBe(true);
    expect(cookieStoreDelete).not.toHaveBeenCalled();
    // Every answer has the fixed status and headers; only a success sets a
    // cookie.
    for (const answer of answers) {
      expect(answer.status).toBe(200);
      expect(answer.headers).toEqual(FIXED_HEADERS);
      if (answer.text !== SIGNED_IN_BODY) {
        expect(answer.setCookies.length === 0, "an answer that is not a success sets no cookie").toBe(true);
        expect(answer.cookieMirror === null, "an answer that is not a success has no cookie mirror").toBe(true);
      } else {
        // The framework's internal mirror holds the Set-Cookie list and
        // nothing else.
        expect(
          answer.cookieMirror === answer.setCookies.map((cookie) => cookie.raw).join(","),
          "the cookie mirror holds exactly the Set-Cookie list",
        ).toBe(true);
      }
    }
    // No request cookie's value ever reached the composition.
    for (const [verification] of edge.compositionCalls as Array<[{ requestCookies: ReadonlyArray<CookieEntry> }]>) {
      for (const cookie of verification.requestCookies) {
        expect(Object.keys(cookie).sort()).toEqual(["name", "value"]);
        expect(cookie.value === "", "a request cookie reached the composition with an empty value").toBe(true);
      }
    }
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

// Lets every already-settled promise chain run on: one turn of the event loop.
function turn(): Promise<void> {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe("POST /login/explorer/verify - success (contract 25 Section 15 item 3)", () => {
  it("ESR-V-001 a success runs in contract 21's order and writes the auth cookie and the binding cookie on one response, with the session's lifetime, the fixed destination and the no-store headers, without the wait", async () => {
    const answer = await send();
    expectSignedIn(answer, sessionAnswers[0], "success");
    // One event list: the request's cookie names, then redemption, lookup,
    // confirmation, the internal exchange, and the session, in that order.
    expect(edge.events).toEqual([
      "cookies",
      `rpc:${REDEEM}`,
      `rpc:${LOOKUP}`,
      `rpc:${CONFIRM}`,
      `auth:${LINK_PATH}`,
      `auth:${VERIFY_PATH}`,
      `rpc:${SESSION}`,
    ]);
    expect(edge.delays).toEqual([]);
    const [redeem, lookup, confirm, link, verify, session] = requests;
    expect(Object.keys(redeem.body).sort()).toEqual(["p_purpose", "p_verification_challenge_id", "p_verifier"]);
    expect(redeem.body).toMatchObject({ p_purpose: "login", p_verification_challenge_id: CHALLENGE_ID });
    const verifier = redeem.body.p_verifier;
    expect(typeof verifier === "string" && !verifier.includes(CODE), "the verifier is a text that does not hold the code").toBe(true);
    expect(
      isDeepStrictEqual(lookup.body, {
        p_normalized_login_identifier: EMAIL,
        p_login_identifier_type: "email",
        p_requested_role_context: "explorer",
      }),
      "the lookup's three arguments",
    ).toBe(true);
    expect(confirm.body).toEqual({
      p_user_account_id: ACCOUNT_ID,
      p_verification_challenge_id: CHALLENGE_ID,
      p_expected_purpose: "login",
    });
    // The link is asked for the looked-up email with the service key; the
    // exchange carries only the link's token hash, with the anon key.
    expect(
      isDeepStrictEqual(link.body, { type: "magiclink", email: STORED_EMAIL }),
      "the link is asked for the looked-up email",
    ).toBe(true);
    expect(link.authorization === `Bearer ${SERVICE_KEY}`, "the link request carries the service key").toBe(true);
    expect(
      isDeepStrictEqual(verify.body, { token_hash: LINK_TOKEN, type: "email", gotrue_meta_security: {} }),
      "the exchange carries only the link's token hash",
    ).toBe(true);
    expect(verify.apikey === ANON_KEY, "the exchange carries the anon key").toBe(true);
    expect(session.body).toEqual({
      p_user_account_id: ACCOUNT_ID,
      p_active_role_context: "explorer",
      p_verification_challenge_id: CHALLENGE_ID,
      p_expected_purpose: "login",
      p_requested_duration_seconds: SESSION_SECONDS,
    });
    for (const request of [redeem, lookup, confirm, session]) {
      expect(request.apikey === SERVICE_KEY, "each database request carries the service key").toBe(true);
    }
    // No cleanup request on a success, and no signal.
    expect(keys()).not.toContain(LOGOUT_PATH);
    expect(stderrChunks.length === 0, "nothing was written to standard error").toBe(true);
    expect(answer.setCookies.length === 2, "a success sets exactly two cookies").toBe(true);
  });

  it("ESR-V-002 a long session is written as N.0 to N.k and the binding cookie, all on the one response; `existing` is written like `created`", async () => {
    authHandlers[VERIFY_PATH] = () => {
      const long = sessionAnswer();
      (long.user as Record<string, unknown>).user_metadata = { padding: "p".repeat(5_000) };
      return json(200, long);
    };
    rpcHandlers[SESSION] = () => rows([sessionRow({ outcome: "existing" })]);
    const answer = await send();
    expectSignedIn(answer, sessionAnswers[0], "a long session");
    const chunkNames = answer.setCookies.map((cookie) => cookie.name);
    expect(chunkNames.length).toBeGreaterThan(2);
    expect(chunkNames.slice(0, -1)).toEqual(chunkNames.slice(0, -1).map((_, index) => `solmind-auth.${index}`));
    expect(chunkNames).not.toContain("solmind-auth");
  });

  it("ESR-V-003 no response is returned before the session answer", async () => {
    let release!: (response: Response) => void;
    rpcHandlers[SESSION] = () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });
    let settled = false;
    const running = POST(post()).then((response) => {
      settled = true;
      return response;
    });
    for (let turns = 0; turns < 500 && !keys().includes(SESSION); turns += 1) {
      await turn();
    }
    expect(keys()).toEqual([REDEEM, LOOKUP, CONFIRM, LINK_PATH, VERIFY_PATH, SESSION]);
    for (let turns = 0; turns < 20; turns += 1) {
      await turn();
    }
    // The session call has been made and has not answered: the handler has
    // returned no response.
    expect(settled).toBe(false);
    release(rows([sessionRow()]));
    const answer = await read(await running);
    expectSignedIn(answer, sessionAnswers[0], "after the session call answered");
  });
});

describe("POST /login/explorer/verify - the guard first (contract 25 Section 15 item 9)", () => {
  it("ESR-V-004 a cross-site, missing or wrong Origin, a wrong Sec-Fetch-Site, a wrong content type, or a malformed body is denied with no redemption, no cookie read and no cookie written; Host/forwarded headers do not substitute for an acceptable Origin", async () => {
    presentCookies([{ name: "solmind-auth", value: OLD_AUTH_MARKER }]);
    const CASES: ReadonlyArray<readonly [string, () => NextRequest]> = [
      ["no Origin", () => post(VALID_BODY, { origin: null })],
      ["another site's Origin", () => post(VALID_BODY, { origin: "https://attacker.example" })],
      ["localhost where the trusted origin is 127.0.0.1", () => post(VALID_BODY, { origin: "http://localhost:3000" })],
      ["the opaque Origin", () => post(VALID_BODY, { origin: "null" })],
      ["Sec-Fetch-Site cross-site", () => post(VALID_BODY, { secFetchSite: "cross-site" })],
      ["Sec-Fetch-Site same-site", () => post(VALID_BODY, { secFetchSite: "same-site" })],
      ["Sec-Fetch-Site none", () => post(VALID_BODY, { secFetchSite: "none" })],
      ["no Sec-Fetch-Site", () => post(VALID_BODY, { secFetchSite: null })],
      ["content type text/plain", () => post(VALID_BODY, { contentType: "text/plain" })],
      ["a form content type", () => post(VALID_BODY, { contentType: "application/x-www-form-urlencoded" })],
      ["no content type", () => post(VALID_BODY, { contentType: null })],
      [
        "hostile Host and forwarded headers with no Origin",
        () =>
          post(VALID_BODY, {
            origin: null,
            headers: { host: "127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000", "x-forwarded-proto": "http" },
          }),
      ],
      ["an empty body", () => post(VALID_BODY, { rawBody: "" })],
      ["no body at all", () => post(VALID_BODY, { rawBody: null })],
      ["a body over the cap", () => post(VALID_BODY, { rawBody: JSON.stringify({ ...VALID_BODY, identifier: "a".repeat(17_000) }) })],
      ["text that is not JSON", () => post(VALID_BODY, { rawBody: "code=246810" })],
      ["a JSON list", () => post(VALID_BODY, { rawBody: JSON.stringify([VALID_BODY]) })],
    ];
    for (const [label, build] of CASES) {
      expectNoCookie(await send(build()), DENIED_BODY, label);
      expectNoEffect(label);
      expect(edge.cookiesMock, label).not.toHaveBeenCalled();
    }
    // With no trusted origin configured: the generic deny before the body is
    // read.
    vi.stubEnv("SOLMIND_TRUSTED_APP_ORIGIN", "");
    const unread = post();
    expectNoCookie(await send(unread), DENIED_BODY, "no trusted origin");
    expect(unread.bodyUsed).toBe(false);
    expectNoEffect("no trusted origin");
    expect(edge.compositionCalls.length === 0, "the composition was never called").toBe(true);
  });

  it("ESR-V-005 the module exports only POST and dynamic; any query parameter, and any body key beyond the three strings, is denied whole with no effect", async () => {
    expect(Object.keys(routeModule).sort()).toEqual(["POST", "dynamic"]);
    expect(routeModule.dynamic).toBe("force-dynamic");
    const queries = [`?returnTo=${encodeURIComponent(RETURN_MARKER)}`, "?next=%2F%2Fattacker.example", "?role=admin", "?code=246810"];
    for (const [index, query] of queries.entries()) {
      // A fixed label, the case's number: one of the queries holds a code.
      const label = `query ${index + 1} of ${queries.length}`;
      expectNoCookie(await send(post(VALID_BODY, { query })), DENIED_BODY, label);
      expectNoEffect(label);
    }
    const widened: ReadonlyArray<Record<string, unknown>> = [
      { ...VALID_BODY, role: "admin" },
      { ...VALID_BODY, activeRoleContext: "guide" },
      { ...VALID_BODY, userAccountId: ACCOUNT_ID },
      { ...VALID_BODY, sessionId: OLD_SESSION_ID },
      { ...VALID_BODY, purpose: "role_reentry" },
      { ...VALID_BODY, duration: 86_400 },
      { ...VALID_BODY, returnTo: RETURN_MARKER },
      { ...VALID_BODY, next: "//attacker.example" },
      { ...VALID_BODY, redirect: "\\\\attacker.example" },
      { ...VALID_BODY, destination: "/admin" },
      { ...VALID_BODY, code: 246810 },
      { ...VALID_BODY, challengeId: null },
      { identifier: TYPED_EMAIL, code: CODE },
      { challengeId: CHALLENGE_ID, code: CODE },
      {},
    ];
    for (const [index, body] of widened.entries()) {
      // A fixed label, the case's number: the bodies hold the typed email
      // and the code.
      const label = `widened body ${index + 1} of ${widened.length}`;
      expectNoCookie(await send(post(body)), DENIED_BODY, label);
      expectNoEffect(label);
    }
    expect(edge.compositionCalls.length === 0, "the composition was never called").toBe(true);
  });

  it("ESR-V-006 a configuration failure is the generic deny before the code is spent: a missing setting, and a trusted origin that is not a loopback origin", async () => {
    for (const [label, overrides] of [
      ["no pepper", { SOLMIND_VERIFICATION_PEPPER: "" }],
      ["no service-role key", { SUPABASE_SERVICE_ROLE_KEY: "" }],
      ["no anon key", { NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }],
      ["no Supabase URL", { NEXT_PUBLIC_SUPABASE_URL: "" }],
    ] as const) {
      stubEnvironment(overrides);
      expectNoCookie(await send(), DENIED_BODY, label);
      expectNoEffect(label);
      vi.unstubAllEnvs();
    }
    for (const hosted of ["https://uat.solmind.example", "http://192.168.1.10:3000"]) {
      stubEnvironment({ SOLMIND_TRUSTED_APP_ORIGIN: hosted });
      expectNoCookie(await send(post(VALID_BODY, { requestOrigin: hosted })), DENIED_BODY, hosted);
      expectNoEffect(hosted);
      vi.unstubAllEnvs();
    }
    // Not an email: the generic deny, with no redemption and no wait.
    stubEnvironment();
    expectNoCookie(await send(post({ ...VALID_BODY, identifier: "not an email" })), DENIED_BODY, "not an email");
    expectNoEffect("not an email");
  });

  it("ESR-V-007 if reading the cookies or the composition ever threw, the handler would still answer the generic deny with no cookie", async () => {
    edge.cookiesMock.mockImplementation(async () => {
      throw new Error(SENTINEL);
    });
    expectNoCookie(await send(), DENIED_BODY, "cookies() throws");
    expectNoEffect("cookies() throws");
    presentCookies([]);
    for (const fault of [
      () => {
        throw new Error(SENTINEL);
      },
      () => Promise.reject(new Error(SENTINEL)),
      // A composition that claimed success without a response would not be
      // sent either: the handler returns only what it was handed.
      () => Promise.resolve({ outcome: "unknown" }),
    ]) {
      edge.compositionOverride = fault;
      expectNoCookie(await send(), DENIED_BODY, "a broken promise");
      expectNoEffect("a broken promise");
    }
  });
});

describe("POST /login/explorer/verify - hold, then write (contract 25 Section 15 item 2)", () => {
  it("ESR-V-008 a refused code (one scripted refused answer from the redemption call, or a malformed selector or code refused before any request) is code_not_accepted and every other listed failure before the exchange is the generic deny: no Supabase Auth request, no cleanup, no cookie, and one wait", async () => {
    type Case = readonly [string, () => void, string, ReadonlyArray<string>];
    const CASES: ReadonlyArray<Case> = [
      // A scripted refusal: the fake answers the redemption call with
      // `denied`. That one answer stands in for a wrong, an expired, a used
      // and an unknown code; no database refusal cause is executed here.
      [
        "one scripted refused answer from the redemption call",
        () => {
          rpcHandlers[REDEEM] = () => rows([{ outcome: "denied" }]);
        },
        CODE_NOT_ACCEPTED_BODY,
        [REDEEM],
      ],
      [
        "a failed redemption",
        () => {
          rpcHandlers[REDEEM] = () => json(500, { message: SENTINEL });
        },
        DENIED_BODY,
        [REDEEM],
      ],
      [
        "a redemption network failure",
        () => {
          rpcHandlers[REDEEM] = () => Promise.reject(new TypeError(`fetch failed: ${SENTINEL}`));
        },
        DENIED_BODY,
        [REDEEM],
      ],
      [
        "redeemed, then no eligible Explorer account for the typed email",
        () => {
          rpcHandlers[LOOKUP] = () => rows([]);
        },
        DENIED_BODY,
        [REDEEM, LOOKUP],
      ],
      [
        "redeemed, then a failed lookup",
        () => {
          rpcHandlers[LOOKUP] = () => databaseError(SENTINEL);
        },
        DENIED_BODY,
        [REDEEM, LOOKUP],
      ],
      [
        "redeemed, then a bound provider id that is not a UUID",
        () => {
          rpcHandlers[LOOKUP] = () => rows([{ ...accountRow(), provider_user_id: "auth-user-1" }]);
        },
        DENIED_BODY,
        [REDEEM, LOOKUP],
      ],
      [
        "redeemed, then the challenge is not this account's own (another person's email with one's own code)",
        () => {
          rpcHandlers[CONFIRM] = () => rows([{ confirmed: false }]);
        },
        DENIED_BODY,
        [REDEEM, LOOKUP, CONFIRM],
      ],
      [
        "redeemed, then a failed confirmation",
        () => {
          rpcHandlers[CONFIRM] = () => databaseError("solmind_login_confirm_invalid_challenge");
        },
        DENIED_BODY,
        [REDEEM, LOOKUP, CONFIRM],
      ],
    ];
    for (const [label, arrange, body, expected] of CASES) {
      requests = [];
      edge.delays.length = 0;
      rpcHandlers = {
        [REDEEM]: () => rows([{ outcome: "redeemed" }]),
        [LOOKUP]: () => rows([accountRow()]),
        [CONFIRM]: () => rows([{ confirmed: true }]),
        [SESSION]: () => rows([sessionRow()]),
      };
      arrange();
      expectNoCookie(await send(), body, label);
      expect(keys(), label).toEqual(expected);
      expect(edge.delays, label).toEqual([RESPONSE_FLOOR_MILLISECONDS]);
    }
    // A malformed selector or code is refused by the redeeming caller with no
    // database call at all, and is code_not_accepted after the same wait.
    const malformedBodies = [
      { ...VALID_BODY, challengeId: "not-a-selector" },
      { ...VALID_BODY, challengeId: CHALLENGE_ID.toUpperCase() },
      { ...VALID_BODY, code: "12345" },
      { ...VALID_BODY, code: "12345a" },
      { ...VALID_BODY, code: "" },
    ];
    for (const [index, malformed] of malformedBodies.entries()) {
      requests = [];
      edge.delays.length = 0;
      // A fixed label, the case's number: each body holds the typed email and
      // a code.
      const label = `malformed selector or code ${index + 1} of ${malformedBodies.length}`;
      expectNoCookie(await send(post(malformed)), CODE_NOT_ACCEPTED_BODY, label);
      expect(requests.length === 0, `${label}: no request was recorded`).toBe(true);
      expect(edge.delays).toEqual([RESPONSE_FLOOR_MILLISECONDS]);
    }
    expect(stderrChunks.length === 0, "nothing was written to standard error").toBe(true);
  });

  it("ESR-V-009 a link made for another user, or a failed link request, is denied before any exchange: no session is minted and no cleanup is needed; a rejected link request prints nothing", async () => {
    type Case = readonly [string, Handler];
    const CASES: ReadonlyArray<Case> = [
      ["a link made for another user", () => json(200, linkAnswerBody(OTHER_PROVIDER_ID))],
      ["a refused link request", () => json(422, { code: "validation_failed", msg: SENTINEL })],
      ["a link answer of the wrong type", () => json(200, { ...linkAnswerBody(), verification_type: "signup" })],
      ["a link request that rejects with a sentinel-bearing error", () => Promise.reject(new TypeError(`fetch failed: ${SENTINEL}`))],
    ];
    for (const [label, handler] of CASES) {
      requests = [];
      edge.delays.length = 0;
      authHandlers[LINK_PATH] = handler;
      expectNoCookie(await send(), DENIED_BODY, label);
      expect(keys(), label).toEqual([REDEEM, LOOKUP, CONFIRM, LINK_PATH]);
      expect(edge.delays, label).toEqual([RESPONSE_FLOOR_MILLISECONDS]);
    }
    expect(stderrChunks.length === 0, "nothing was written to standard error").toBe(true);
  });

  // A failure of the cookie writer is not among these cases: here the real
  // writer writes onto a real response and no case makes it fail. It is
  // covered apart, by ESC-007 in
  // `src/lib/solmind/supabase/__tests__/explorerSignInComposition.test.ts`
  // (the writer denies, or the response throws on a header or a cookie: no
  // response is returned and discard is awaited) and, for the writer's own
  // `failed` result, by LCW-017 in
  // `src/lib/solmind/supabase/__tests__/loginCookieWriter.test.ts`.
  it("ESR-V-010 each listed failure after the exchange (the session function refuses, fails or cannot be reached; its answer is malformed, has an extra column, a session id that is not canonical or an expiry out of range; the exchange's session is another user's) sets no cookie and attempts cleanup exactly once, with the transient session's own access token", async () => {
    type Case = readonly [string, () => void];
    const CASES: ReadonlyArray<Case> = [
      ...[
        "solmind_session_ineligible_account",
        "solmind_session_ineligible_role",
        "solmind_session_ineligible_evidence",
        "solmind_session_conflicting_retry",
        "solmind_session_evidence_consumed",
        "solmind_session_stale_evidence",
        "solmind_session_older_evidence",
      ].map(
        (message): Case => [
          `the session function refuses: ${message}`,
          () => {
            rpcHandlers[SESSION] = () => databaseError(message);
          },
        ],
      ),
      [
        "the session function fails",
        () => {
          rpcHandlers[SESSION] = () => json(500, { message: SENTINEL });
        },
      ],
      [
        "the session call's network fails",
        () => {
          rpcHandlers[SESSION] = () => Promise.reject(new TypeError(`fetch failed: ${SENTINEL}`));
        },
      ],
      [
        "a malformed session answer (two rows)",
        () => {
          rpcHandlers[SESSION] = () => rows([sessionRow(), sessionRow()]);
        },
      ],
      [
        "a session answer with an extra column",
        () => {
          rpcHandlers[SESSION] = () => rows([sessionRow({ user_account_id: ACCOUNT_ID })]);
        },
      ],
      [
        "a session id that is not canonical",
        () => {
          rpcHandlers[SESSION] = () => rows([sessionRow({ user_session_id: SESSION_ID.toUpperCase() })]);
        },
      ],
      [
        "a session already at its end",
        () => {
          rpcHandlers[SESSION] = () => rows([sessionRow({ expires_at: printedExpiry(0) })]);
        },
      ],
      [
        "a session that would outlast the hour (an abnormal clock)",
        () => {
          rpcHandlers[SESSION] = () => rows([sessionRow({ expires_at: printedExpiry(3_601) })]);
        },
      ],
      [
        "the exchange returns a session for another user (the bridge's own deny)",
        () => {
          authHandlers[VERIFY_PATH] = () => json(200, sessionAnswer(OTHER_PROVIDER_ID));
        },
      ],
    ];
    for (const [label, arrange] of CASES) {
      requests = [];
      edge.delays.length = 0;
      edge.events.length = 0;
      rpcHandlers[SESSION] = () => rows([sessionRow()]);
      authHandlers[VERIFY_PATH] = () => json(200, sessionAnswer());
      const before = sessionAnswers.length;
      arrange();
      expectNoCookie(await send(), DENIED_BODY, label);
      const logouts = requests.filter((request) => request.key === LOGOUT_PATH);
      expect(logouts.length === 1, `${label}: exactly one cleanup request`).toBe(true);
      expect(
        logouts[0].authorization === `Bearer ${sessionAnswers[before].access_token as string}`,
        label,
      ).toBe(true);
      // The cleanup request was sent before the answer, and before the wait.
      expect(edge.events.indexOf(`auth:${LOGOUT_PATH}`), label).toBeGreaterThan(edge.events.indexOf(`auth:${VERIFY_PATH}`));
      expect(edge.events.indexOf(`auth:${LOGOUT_PATH}`), label).toBeLessThan(edge.events.indexOf("wait"));
      expect(edge.events[edge.events.length - 1], label).toBe("wait");
      expect(edge.delays, label).toEqual([RESPONSE_FLOOR_MILLISECONDS]);
      // At most one session call per request, and no retry.
      expect(requests.filter((request) => request.key === SESSION).length, label).toBeLessThanOrEqual(1);
    }
    expect(stderrChunks.length === 0, "nothing was written to standard error").toBe(true);
  });

  it("ESR-V-011 an induced cleanup failure still denies: no cookie, the same answer, and exactly one fixed, value-free signal line", async () => {
    rpcHandlers[SESSION] = () => databaseError("solmind_session_stale_evidence");
    const FAILURES: ReadonlyArray<readonly [string, Handler]> = [
      ["a 500 from the revocation", () => json(500, { code: "unexpected_failure", msg: SENTINEL })],
      ["a 401 from the revocation", () => json(401, { code: "bad_jwt", msg: SENTINEL })],
      ["a network error on the revocation", () => Promise.reject(new TypeError(`fetch failed: ${SENTINEL}`))],
    ];
    for (const [label, handler] of FAILURES) {
      requests = [];
      stderrChunks = [];
      authHandlers[LOGOUT_PATH] = handler;
      expectNoCookie(await send(), DENIED_BODY, label);
      expect(
        requests.filter((request) => request.key === LOGOUT_PATH).length === 1,
        `${label}: exactly one cleanup request`,
      ).toBe(true);
      expect(
        stderrChunks.length === 1 && stderrChunks[0] === SIGNAL_LINE,
        `${label}: exactly one fixed signal line on standard error`,
      ).toBe(true);
    }
    // Control: a cleanup that works raises no signal.
    requests = [];
    stderrChunks = [];
    authHandlers[LOGOUT_PATH] = () => new Response(null, { status: 204 });
    expectNoCookie(await send(), DENIED_BODY, "a clean revocation");
    expect(stderrChunks.length === 0, "nothing was written to standard error").toBe(true);
  });
});

describe("POST /login/explorer/verify - fixation and the fixed destination (contract 25 Section 15 items 5 and 10)", () => {
  const OLD_COOKIES: ReadonlyArray<CookieEntry> = [
    { name: "solmind-auth", value: OLD_AUTH_MARKER },
    { name: "solmind-auth.0", value: OLD_AUTH_MARKER },
    { name: "solmind-auth.5", value: OLD_AUTH_MARKER },
    { name: "solmind-auth-code-verifier", value: OLD_VERIFIER_MARKER },
    { name: "solmind-auth-code-verifier.0", value: OLD_VERIFIER_MARKER },
    { name: "solmind-session", value: OLD_SESSION_ID },
    { name: "unrelated-preference", value: "dark" },
  ];

  it("ESR-V-012 old auth and binding cookies never sign anyone in: with a refused code nothing is created, exchanged or written, and writer input is names only", async () => {
    presentCookies(OLD_COOKIES);
    rpcHandlers[REDEEM] = () => rows([{ outcome: "denied" }]);
    expectNoCookie(await send(), CODE_NOT_ACCEPTED_BODY, "old cookies with a refused code");
    expect(keys()).toEqual([REDEEM]);
    // The composition received the names, with every value emptied.
    const [verification] = edge.compositionCalls[0] as [{ requestCookies: ReadonlyArray<CookieEntry> }];
    expect(
      isDeepStrictEqual(verification.requestCookies, OLD_COOKIES.map((cookie) => ({ name: cookie.name, value: "" }))),
      "the composition received every cookie's name with an empty value",
    ).toBe(true);
    // No request to the database or to Supabase Auth carried an old value.
    const sent = JSON.stringify(requests);
    for (const old of [OLD_AUTH_MARKER, OLD_VERIFIER_MARKER, OLD_SESSION_ID]) {
      expect(sent.includes(old), "an old cookie value appears in a recorded request").toBe(false);
    }
  });

  it("captures a valid old candidate once despite Next cookie metadata; a refused fresh code never verifies or revokes it", async () => {
    const oldAccess = `${segment({ alg: "HS256", typ: "JWT" })}.${segment({ sub: PROVIDER_ID, exp: Math.floor(FIXED_NOW / 1000) + 3600 })}.c3ludGhldGlj`;
    const oldRefresh = "synthetic-prior-candidate-refresh";
    const old = createChunks("solmind-auth", `base64-${stringToBase64URL(JSON.stringify({ access_token: oldAccess, refresh_token: oldRefresh, expires_at: Math.floor(FIXED_NOW / 1000) + 3600, user: {} }))}`);
    const nextResponse = new NextResponse();
    for (const cookie of old) {
      nextResponse.cookies.set(cookie);
    }
    const incoming = nextResponse.cookies.getAll();
    expect(incoming.every((cookie) => cookie.path === "/")).toBe(true);
    const getAll = vi.fn(() => incoming.map((cookie) => ({ ...cookie })));
    edge.cookiesMock.mockImplementation(async () => {
      edge.events.push("cookies");
      return { getAll, set: cookieStoreSet, delete: cookieStoreDelete };
    });
    rpcHandlers[REDEEM] = () => rows([{ outcome: "denied" }]);
    expectNoCookie(await send(), CODE_NOT_ACCEPTED_BODY, "captured old candidate and denied fresh code");
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(keys()).toEqual([REDEEM]);
    const verification = edge.compositionCalls[0][0] as { priorCleanupCandidate: { accessToken: string; refreshToken: string }; requestCookies: CookieEntry[] };
    expect(Object.isFrozen(verification.priorCleanupCandidate) && verification.priorCleanupCandidate.accessToken === oldAccess && verification.priorCleanupCandidate.refreshToken === oldRefresh).toBe(true);
    expect(verification.requestCookies.every((cookie) => cookie.value === "")).toBe(true);
    expect(JSON.stringify(requests).includes(oldAccess) || JSON.stringify(requests).includes(oldRefresh)).toBe(false);
  });

  it("ESR-V-013 a success replaces them: every old auth chunk it did not rewrite and every code verifier is cleared, the binding cookie holds the database's session UUID, and an unrelated cookie is left alone", async () => {
    presentCookies(OLD_COOKIES);
    const answer = await send();
    expectSignedIn(answer, sessionAnswers[0], "a success with old cookies");
    const byName = new Map(answer.setCookies.map((cookie) => [cookie.name, cookie]));
    for (const name of ["solmind-auth.0", "solmind-auth.5", "solmind-auth-code-verifier", "solmind-auth-code-verifier.0"]) {
      expectRemoval(byName.get(name), name);
    }
    // N itself is rewritten with the new session, not cleared.
    expect(
      byName.get("solmind-auth")?.value === expectedAuthCookies(sessionAnswers[0])[0].value,
      "the auth cookie is rewritten with the new session",
    ).toBe(true);
    expect(
      byName.get("solmind-session")?.value === SESSION_ID,
      "the binding cookie holds the database's session UUID",
    ).toBe(true);
    expect(byName.has("unrelated-preference")).toBe(false);
    expect(answer.setCookies.map((cookie) => cookie.name)).toEqual([
      "solmind-auth.0",
      "solmind-auth.5",
      "solmind-auth-code-verifier",
      "solmind-auth-code-verifier.0",
      "solmind-auth",
      "solmind-session",
    ]);
    const sent = JSON.stringify(requests);
    for (const old of [OLD_AUTH_MARKER, OLD_VERIFIER_MARKER, OLD_SESSION_ID]) {
      expect(sent.includes(old), "an old cookie value appears in a recorded request").toBe(false);
      expect(
        JSON.stringify(answer.setCookies.map((cookie) => cookie.raw)).includes(old),
        "an old cookie value appears in a Set-Cookie header",
      ).toBe(false);
    }
  });

  it("ESR-V-014 a hostile incoming auth cookie does not stop a sign-in and prints nothing: the hold client never sees it, and it is cleared", async () => {
    presentCookies([
      { name: "solmind-auth", value: "base64-9YCAgA" },
      { name: "solmind-auth.1", value: `not base64 ${String.fromCharCode(0x7f)} ${SENTINEL}` },
    ]);
    const answer = await send();
    expectSignedIn(answer, sessionAnswers[0], "a hostile incoming cookie");
    expectRemoval(answer.setCookies.find((cookie) => cookie.name === "solmind-auth.1"), "solmind-auth.1");
    expect(JSON.stringify(requests).includes("9YCAgA"), "the hostile cookie's value appears in a recorded request").toBe(false);
  });

  it("ESR-V-015 with a return address in a header the answer has the same response body and non-cookie headers as the plain success, and the address appears nowhere in it", async () => {
    const plain = await send();
    const withMarkers = await send(
      post(VALID_BODY, {
        headers: {
          referer: RETURN_MARKER,
          "x-forwarded-host": "attacker.example",
          "x-forwarded-proto": "https",
          "x-return-to": RETURN_MARKER,
          "x-original-url": `//attacker.example/${SENTINEL}`,
        },
      }),
    );
    expect(withMarkers.text).toBe(plain.text);
    expect(withMarkers.text).toBe(SIGNED_IN_BODY);
    expect(withMarkers.headers).toEqual(plain.headers);
    expect(JSON.parse(withMarkers.text)).toEqual({ outcome: "signed_in", destination: HOME });
    const everything = `${withMarkers.text}\n${JSON.stringify(withMarkers.headers)}\n${withMarkers.setCookies.map((cookie) => cookie.raw).join("\n")}`;
    expect(everything.includes("attacker.example"), "the return address's host appears in the answer").toBe(false);
    // A failure names no destination at all.
    rpcHandlers[REDEEM] = () => rows([{ outcome: "denied" }]);
    const failure = await send();
    expect(failure.text).toBe(CODE_NOT_ACCEPTED_BODY);
    expect(failure.text).not.toContain("destination");
  });
});

describe("POST /login/explorer/verify - the round trip into the per-request check (the S6-4 draft's modules)", () => {
  it("ESR-V-016 the cookies this route wrote pass the shared format check and give back the session's own token; with both cookies the per-request adapter verifies that token and carries the session UUID, and the same auth cookie without the binding cookie is refused before Supabase Auth is asked", async () => {
    const answer = await send();
    expectSignedIn(answer, sessionAnswers[0], "the sign-in");
    const browserCookies = answer.setCookies
      .filter((cookie) => cookie.value !== "")
      .map((cookie) => ({ name: cookie.name, value: cookie.value }));
    const policy = resolveSessionCookiePolicy(TRUSTED_ORIGIN);
    expect(policy).not.toBeNull();
    if (policy === null) {
      return;
    }
    const check = readSessionAuthCookies(policy, browserCookies);
    expect(check.status).toBe("present");
    const accessToken = sessionAnswers[0].access_token as string;
    expect(readSessionAuthCookieAccessToken(policy, browserCookies) === accessToken).toBe(true);

    // Positive control: both cookies. The adapter asks Supabase Auth about
    // exactly that token and passes the binding UUID on.
    authHandlers[USER_PATH] = () => json(200, sessionAnswers[0].user);
    requests = [];
    const withBoth = createSupabaseRequestAuthPrincipalSource({
      cookies: { getAll: () => browserCookies.map((cookie) => ({ ...cookie })), setAll: () => undefined },
    });
    expect(
      isDeepStrictEqual(await withBoth.resolveAuthenticatedUser(), {
        providerName: "supabase",
        providerUserId: PROVIDER_ID,
        presentedSessionId: SESSION_ID,
      }),
      "with both cookies the adapter gives the provider user and the session UUID",
    ).toBe(true);
    expect(keys()).toEqual([USER_PATH]);
    expect(
      requests[0].authorization === `Bearer ${accessToken}`,
      "the adapter asks Supabase Auth about exactly the session's token",
    ).toBe(true);

    // The negative: a Supabase session alone. The same auth cookie with no
    // binding cookie is refused, and Supabase Auth is not asked.
    requests = [];
    const authOnly = browserCookies.filter((cookie) => cookie.name !== policy.bindingCookieName);
    expect(authOnly.length).toBe(browserCookies.length - 1);
    const withoutBinding = createSupabaseRequestAuthPrincipalSource({
      cookies: { getAll: () => authOnly.map((cookie) => ({ ...cookie })), setAll: () => undefined },
    });
    expect(
      (await withoutBinding.resolveAuthenticatedUser()) === null,
      "without the binding cookie the adapter refuses",
    ).toBe(true);
    expect(requests.length === 0, "Supabase Auth was not asked").toBe(true);
  });
});
