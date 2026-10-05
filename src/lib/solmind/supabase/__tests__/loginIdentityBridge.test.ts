// Login step 6, sub-slice S6-7: the Supabase identity bridge (contract 25
// Section 6, hold then write; contract 21 Section 7.9; contract 25 Section 15
// item 2 and the bridge's own deny test), and its module boundary. The
// installed Supabase SSR library runs for real against a fake Supabase Auth
// (a fake fetch); one block replaces the library with a scripted stand-in to
// induce hand-overs the real library never makes. Released cookies are fed to
// S6-2's real login-step cookie writer. Late answers, concurrent attempts and
// the link seam's fetch precondition run against the same fakes. Nothing here
// reaches a network, a database or a local Supabase stack.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import { createChunks, stringToBase64URL } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authBarrel from "../../auth/index";
import { resolveSessionCookiePolicy, type SessionCookiePolicy } from "../../auth/sessionCookiePolicy";
import * as contextBarrel from "../../context/index";
import * as supabaseBarrel from "../index";
import * as bridgeModule from "../loginIdentityBridge";
import {
  LOGIN_IDENTITY_BRIDGE_LIMITS,
  LoginIdentityBridgeConfigurationError,
  createLoginIdentityBridge,
  type LoginIdentityBridge,
  type LoginIdentityHold,
  type LoginIdentityLinkAdmin,
} from "../loginIdentityBridge";
import { writeLoginSessionCookies, type SessionCookieResponse } from "../loginCookieWriter";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY = "synthetic-anon-key-s67";
const SERVICE_KEY = "synthetic-service-role-key-s67";
const BOUND_ID = "3f0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const OTHER_ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const GUIDE_EMAIL = "guide.s67@solmind.example";
const EXPLORER_EMAIL = "explorer.s67@solmind.example";
const PASSWORD = "Synthetic-Password-S67";
const LINK_TOKEN = "5f3a1c9e8b7d6a4f2e1c0b9a8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a";
const SESSION_ID = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
const TIMEOUT = 200;

const LOGOUT_PATH = "/auth/v1/logout?scope=local";
const PASSWORD_PATH = "/auth/v1/token?grant_type=password";
const VERIFY_PATH = "/auth/v1/verify";
const LINK_PATH = "/auth/v1/admin/generate_link";

function policyFor(origin: string): SessionCookiePolicy {
  const resolved = resolveSessionCookiePolicy(origin);
  if (resolved === null) {
    throw new Error("test setup: the policy did not resolve");
  }
  return resolved;
}

const LOOPBACK_ORIGIN = "http://127.0.0.1:3000";
const HOSTED_ORIGIN = "https://uat.solmind.example";
const LOOPBACK = policyFor(LOOPBACK_ORIGIN);
const HOSTED = policyFor(HOSTED_ORIGIN);

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function syntheticAccessToken(claims: Record<string, unknown>): string {
  return `${encodeSegment({ alg: "HS256", typ: "JWT" })}.${encodeSegment(claims)}.c3ludGhldGljLXNpZ25hdHVyZQ`;
}

type AnswerOptions = Readonly<{
  userId?: string;
  subject?: string;
  email?: string;
  padding?: number;
  expOffset?: number;
  expiresAtOffset?: number;
  omitExpiresAt?: boolean;
  accessToken?: string;
}>;

let answerCount = 0;

// A Supabase Auth session answer, as the token and verify endpoints send it.
function sessionAnswer(options: AnswerOptions = {}): Record<string, unknown> {
  answerCount += 1;
  const issuedAt = nowSeconds();
  const userId = options.userId ?? BOUND_ID;
  const accessToken =
    options.accessToken ??
    syntheticAccessToken({
      aud: "authenticated",
      exp: issuedAt + 3600 + (options.expOffset ?? 0),
      iat: issuedAt,
      sub: options.subject ?? userId,
      role: "authenticated",
      session_id: `synthetic-session-${answerCount}`,
      padding: "p".repeat(options.padding ?? 0),
    });
  const answer: Record<string, unknown> = { access_token: accessToken, token_type: "bearer", expires_in: 3600 };
  if (options.omitExpiresAt !== true) {
    answer.expires_at = issuedAt + 3600 + (options.expiresAtOffset ?? 0);
  }
  answer.refresh_token = `synthetic-refresh-${answerCount}`;
  answer.user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: options.email ?? GUIDE_EMAIL,
    app_metadata: { provider: "email" },
    user_metadata: {},
  };
  return answer;
}

function accessTokenOf(answer: Record<string, unknown>): string {
  return answer.access_token as string;
}

function expOf(accessToken: string): number {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")) as {
    exp: number;
  };
  return payload.exp;
}

function jsonAnswer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
  });
}

type Recorded = Readonly<{
  method: string;
  path: string;
  authorization: string | null;
  apikey: string | null;
  body: unknown;
  signal: AbortSignal | null;
}>;

type Responder = (request: Recorded) => Response | Promise<Response>;

type Routes = Partial<
  Readonly<{ password: Responder; verify: Responder; logout: Responder; generateLink: Responder }>
>;

function linkAnswerBody(userId: string = BOUND_ID): Record<string, unknown> {
  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: EXPLORER_EMAIL,
    action_link: `${SUPABASE_URL}/auth/v1/verify?token=${LINK_TOKEN}&type=magiclink`,
    email_otp: "246810",
    hashed_token: LINK_TOKEN,
    redirect_to: LOOPBACK_ORIGIN,
    verification_type: "magiclink",
  };
}

// A fake Supabase Auth behind a fake fetch. Every request is recorded.
function fakeAuthServer(routes: Routes = {}) {
  const requests: Recorded[] = [];
  const answers: Record<string, unknown>[] = [];
  const respondWithSession: Responder = () => {
    const answer = sessionAnswer();
    answers.push(answer);
    return jsonAnswer(200, answer);
  };
  const send = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const recorded: Recorded = Object.freeze({
      method: init?.method ?? "GET",
      path: `${url.pathname}${url.search}`,
      authorization: headers.get("authorization"),
      apikey: headers.get("apikey"),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      signal: init?.signal ?? null,
    });
    requests.push(recorded);
    if (recorded.path === PASSWORD_PATH) {
      return (routes.password ?? respondWithSession)(recorded);
    }
    if (recorded.path === VERIFY_PATH) {
      return (routes.verify ?? respondWithSession)(recorded);
    }
    if (recorded.path === LOGOUT_PATH) {
      return (routes.logout ?? (() => new Response(null, { status: 204 })))(recorded);
    }
    if (recorded.path === LINK_PATH) {
      return (routes.generateLink ?? (() => jsonAnswer(200, linkAnswerBody())))(recorded);
    }
    return jsonAnswer(404, { code: "not_found", message: "unexpected request" });
  });
  const paths = () => requests.map((request) => request.path);
  return { send, requests, answers, paths };
}

type AuthServer = ReturnType<typeof fakeAuthServer>;

function linkSeamAnswer(
  options: Readonly<{ userId?: string; hashedToken?: unknown; verificationType?: unknown }> = {},
): Record<string, unknown> {
  return {
    data: {
      properties: {
        action_link: `${SUPABASE_URL}/auth/v1/verify?type=magiclink`,
        email_otp: "246810",
        hashed_token: "hashedToken" in options ? options.hashedToken : LINK_TOKEN,
        redirect_to: LOOPBACK_ORIGIN,
        verification_type: "verificationType" in options ? options.verificationType : "magiclink",
      },
      user: { id: options.userId ?? BOUND_ID, email: EXPLORER_EMAIL },
    },
    error: null,
  };
}

// A stand-in for the service-role client's Auth admin API.
function fakeLinkAdmin(answer: () => unknown = () => linkSeamAnswer()) {
  const calls: unknown[] = [];
  const admin = {
    generateLink: vi.fn(async (params: unknown) => {
      calls.push(params);
      return answer();
    }),
  };
  return { admin, calls };
}

type BridgeOverrides = Readonly<{
  linkAdmin?: LoginIdentityLinkAdmin;
  signal?: () => void;
  authCookieName?: string;
  timeout?: number;
}>;

function bridgeWith(server: AuthServer, overrides: BridgeOverrides = {}) {
  const signal = vi.fn(overrides.signal ?? ((): void => undefined));
  const bridge = createLoginIdentityBridge(
    {
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
      authCookieName: overrides.authCookieName ?? LOOPBACK.authCookieName,
      providerTimeoutMilliseconds: overrides.timeout ?? TIMEOUT,
    },
    {
      fetch: server.send as unknown as typeof fetch,
      linkAdmin: overrides.linkAdmin ?? fakeLinkAdmin().admin,
      signalCleanupFailure: signal,
    },
  );
  return { bridge, signal };
}

async function heldPasswordSignIn(bridge: LoginIdentityBridge): Promise<LoginIdentityHold> {
  const result = await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD });
  if (result.outcome !== "held") {
    throw new Error("test setup: the sign-in did not hold");
  }
  return result.hold;
}

function storedValue(answer: Record<string, unknown>): string {
  return `base64-${stringToBase64URL(JSON.stringify(answer))}`;
}

function expectedHeld(name: string, answer: Record<string, unknown>) {
  return createChunks(name, storedValue(answer)).map((chunk) => ({ name: chunk.name, value: chunk.value }));
}

function logoutRequestFor(answer: Record<string, unknown>) {
  return expect.objectContaining({
    method: "POST",
    path: LOGOUT_PATH,
    authorization: `Bearer ${accessTokenOf(answer)}`,
  });
}

function textOf(value: unknown): string {
  return [
    String(value),
    JSON.stringify(value),
    inspect(value, { showHidden: true, depth: 6 }),
    value instanceof Error ? `${value.name} ${value.message} ${value.stack ?? ""}` : "",
  ].join(" ");
}

function hangingUntilAborted(request: Recorded): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    request.signal?.addEventListener("abort", () => {
      reject(new DOMException("This operation was aborted", "AbortError"));
    });
  });
}

function neverAnswering(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

// Waits, bounded, until `check` holds, so that late work finishes inside the
// test that started it.
async function eventually(check: () => boolean, label: string): Promise<void> {
  const giveUpAt = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > giveUpAt) {
      throw new Error(`test wait timed out: ${label}`);
    }
    await delay(10);
  }
}

// A successful answer that arrives whole after `milliseconds`, whatever the
// abort says, as from a transport that ignores it.
function lateAnswer(body: unknown, milliseconds: number): Promise<Response> {
  return new Promise<Response>((resolve) => {
    setTimeout(() => resolve(jsonAnswer(200, body)), milliseconds);
  });
}

// A successful answer whose status and headers arrive at once but whose body
// completes only after `milliseconds`. With `request`, the body stream errors
// as soon as the abort reaches it, as a transport that cancels the body does;
// without it, the abort is ignored.
function delayedBodyAnswer(body: unknown, milliseconds: number, request?: Recorded): Response {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const timer = setTimeout(() => {
          controller.enqueue(bytes);
          controller.close();
        }, milliseconds);
        request?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          controller.error(new DOMException("This operation was aborted", "AbortError"));
        });
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" } },
  );
}

beforeEach(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
});

afterEach(() => {
  for (const method of CONSOLE_METHODS) {
    expect(console[method]).not.toHaveBeenCalled();
  }
  vi.restoreAllMocks();
});

describe("loginIdentityBridge - hold, then write (contract 25 Section 6; Section 15 item 2)", () => {
  it("LIB-001 a Guide or Admin sign-in sends one request, holds exactly the library's session cookies, and releases nothing before it is asked", async () => {
    const answer = sessionAnswer();
    const server = fakeAuthServer({ password: () => jsonAnswer(200, answer) });
    const { bridge, signal } = bridgeWith(server);
    const hold = await heldPasswordSignIn(bridge);
    // One request, with the anon key and exactly the typed credentials.
    expect(server.requests).toEqual([
      expect.objectContaining({
        method: "POST",
        path: PASSWORD_PATH,
        apikey: ANON_KEY,
        authorization: `Bearer ${ANON_KEY}`,
        body: { email: GUIDE_EMAIL, password: PASSWORD, gotrue_meta_security: {} },
      }),
    ]);
    // The provider expiry: the token's own exp (equal to expires_at here).
    expect(hold.accessTokenExpiresAt).toBe(expOf(accessTokenOf(answer)));
    expect(Object.isFrozen(hold)).toBe(true);
    expect(Object.keys(hold).sort()).toEqual(["accessTokenExpiresAt", "assertProviderUser", "discard", "release"]);
    // After the route's redemption and assertion, the held set is the
    // library's own encoding of the session it received: N alone, no removal,
    // no code verifier.
    expect(await hold.assertProviderUser(BOUND_ID)).toEqual({ outcome: "asserted" });
    const released = hold.release({ sessionOutcome: "created" });
    expect(released).toEqual({ outcome: "released", heldCookies: expectedHeld(LOOPBACK.authCookieName, answer) });
    if (released.outcome === "released") {
      expect(released.heldCookies).toHaveLength(1);
      expect(Object.isFrozen(released.heldCookies)).toBe(true);
      expect(released.heldCookies.every((cookie) => Object.isFrozen(cookie))).toBe(true);
    }
    // No refresh, no user read, no sign-out, no signal.
    expect(server.paths()).toEqual([PASSWORD_PATH]);
    expect(signal).not.toHaveBeenCalled();
  });

  it("LIB-002 a long session is held as N.0 to N.k, and S6-2's real writer accepts the released set under both policies, for `created` and `existing`; another cookie name is denied by the writer", async () => {
    for (const [policy, origin] of [
      [LOOPBACK, LOOPBACK_ORIGIN],
      [HOSTED, HOSTED_ORIGIN],
    ] as const) {
      for (const sessionOutcome of ["created", "existing"] as const) {
        const answer = sessionAnswer({ padding: 5000 });
        const server = fakeAuthServer({ password: () => jsonAnswer(200, answer) });
        const { bridge } = bridgeWith(server, { authCookieName: policy.authCookieName });
        const hold = await heldPasswordSignIn(bridge);
        expect(await hold.assertProviderUser(BOUND_ID)).toEqual({ outcome: "asserted" });
        const released = hold.release({ sessionOutcome });
        expect(released.outcome).toBe("released");
        if (released.outcome !== "released") {
          continue;
        }
        expect(released.heldCookies).toEqual(expectedHeld(policy.authCookieName, answer));
        expect(released.heldCookies.length).toBeGreaterThan(1);
        expect(released.heldCookies.map((cookie) => cookie.name)).toEqual(
          released.heldCookies.map((_cookie, index) => `${policy.authCookieName}.${index}`),
        );
        const written: Array<{ name: string; value: string }> = [];
        const response: SessionCookieResponse = {
          cookies: {
            set(name: string, value: string) {
              written.push({ name, value });
            },
          },
          headers: { set() {} },
        };
        expect(
          writeLoginSessionCookies({
            trustedOrigin: origin,
            heldCookies: released.heldCookies,
            requestCookies: [],
            sessionId: SESSION_ID,
            maxAgeSeconds: 3000,
            response,
          }),
        ).toEqual({ outcome: "written" });
        expect(written).toEqual([...released.heldCookies, { name: policy.bindingCookieName, value: SESSION_ID }]);
      }
    }
    // A hold built with another name hands over cookies the writer denies.
    const server = fakeAuthServer();
    const { bridge } = bridgeWith(server, { authCookieName: "other-auth" });
    const hold = await heldPasswordSignIn(bridge);
    await hold.assertProviderUser(BOUND_ID);
    const released = hold.release({ sessionOutcome: "created" });
    expect(released.outcome).toBe("released");
    if (released.outcome === "released") {
      const response: SessionCookieResponse = { cookies: { set() {} }, headers: { set() {} } };
      expect(
        writeLoginSessionCookies({
          trustedOrigin: LOOPBACK_ORIGIN,
          heldCookies: released.heldCookies,
          requestCookies: [],
          sessionId: SESSION_ID,
          maxAgeSeconds: 3000,
          response,
        }),
      ).toEqual({ outcome: "denied", reason: "held_cookies" });
    }
  });

  it("LIB-003 the Explorer exchange makes one link call and one verify request, and the hold comes back asserted; a real admin client satisfies the link seam", async () => {
    // A stand-in seam.
    const answer = sessionAnswer({ email: EXPLORER_EMAIL });
    const server = fakeAuthServer({ verify: () => jsonAnswer(200, answer) });
    const link = fakeLinkAdmin();
    const { bridge } = bridgeWith(server, { linkAdmin: link.admin });
    const result = await bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID });
    expect(result.outcome).toBe("held");
    expect(link.calls).toEqual([{ type: "magiclink", email: EXPLORER_EMAIL }]);
    expect(Object.isFrozen(link.calls[0])).toBe(true);
    expect(server.requests).toEqual([
      expect.objectContaining({
        method: "POST",
        path: VERIFY_PATH,
        apikey: ANON_KEY,
        body: { token_hash: LINK_TOKEN, type: "email", gotrue_meta_security: {} },
      }),
    ]);
    if (result.outcome === "held") {
      expect(result.hold.accessTokenExpiresAt).toBe(expOf(accessTokenOf(answer)));
      expect(result.hold.release({ sessionOutcome: "created" })).toEqual({
        outcome: "released",
        heldCookies: expectedHeld(LOOPBACK.authCookieName, answer),
      });
    }

    // The real supabase-js admin API, driven through the same fake Supabase
    // Auth: one POST to generate_link with the service key and exactly the
    // type and email, then the exchange.
    const realServer = fakeAuthServer();
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: realServer.send as unknown as typeof fetch },
    });
    const realBridge = bridgeWith(realServer, { linkAdmin: adminClient.auth.admin }).bridge;
    const realResult = await realBridge.exchangeExplorerLink({
      email: EXPLORER_EMAIL,
      boundProviderUserId: BOUND_ID,
    });
    expect(realResult.outcome).toBe("held");
    expect(realServer.requests).toEqual([
      expect.objectContaining({
        method: "POST",
        path: LINK_PATH,
        authorization: `Bearer ${SERVICE_KEY}`,
        body: { type: "magiclink", email: EXPLORER_EMAIL },
      }),
      expect.objectContaining({ method: "POST", path: VERIFY_PATH, apikey: ANON_KEY }),
    ]);
  });

  it("LIB-004 nothing is released unless the hold was asserted and the caller states `created` or `existing`; a refused first release while the hold is pending starts the cleanup, repeated release attempts return `refused` without another provider operation, and a hold releases at most once", async () => {
    const getter = vi.fn(() => "created");
    const refusedRequests: unknown[] = [
      { sessionOutcome: "denied" },
      { sessionOutcome: "failed" },
      { sessionOutcome: "" },
      { sessionOutcome: "Created" },
      { sessionOutcome: "created\n" },
      {},
      { sessionOutcome: "created", extra: true },
      Object.defineProperty({}, "sessionOutcome", { enumerable: true, get: getter }),
      Object.create({ sessionOutcome: "created" }),
      ["created"],
      null,
      undefined,
    ];
    for (const request of refusedRequests) {
      const answer = sessionAnswer();
      const server = fakeAuthServer({ password: () => jsonAnswer(200, answer) });
      const { bridge } = bridgeWith(server);
      const hold = await heldPasswordSignIn(bridge);
      await hold.assertProviderUser(BOUND_ID);
      expect(hold.release(request as never)).toEqual({ outcome: "refused" });
      expect(await hold.discard()).toEqual({ outcome: "discarded", cleanup: "cleaned" });
      expect(hold.release({ sessionOutcome: "created" })).toEqual({ outcome: "refused" });
      expect(server.requests.filter((recorded) => recorded.path === LOGOUT_PATH)).toEqual([
        logoutRequestFor(answer),
      ]);
    }
    expect(getter).not.toHaveBeenCalled();

    // Before the provider-id assertion, even `created` is refused.
    const answer = sessionAnswer();
    const server = fakeAuthServer({ password: () => jsonAnswer(200, answer) });
    const { bridge } = bridgeWith(server);
    const hold = await heldPasswordSignIn(bridge);
    expect(hold.release({ sessionOutcome: "created" })).toEqual({ outcome: "refused" });
    expect(await hold.assertProviderUser(BOUND_ID)).toEqual({ outcome: "denied" });
    await hold.discard();
    expect(server.paths()).toEqual([PASSWORD_PATH, LOGOUT_PATH]);

    // A second release is refused and changes nothing.
    const onceServer = fakeAuthServer();
    const once = await heldPasswordSignIn(bridgeWith(onceServer).bridge);
    await once.assertProviderUser(BOUND_ID);
    expect(once.release({ sessionOutcome: "existing" }).outcome).toBe("released");
    expect(once.release({ sessionOutcome: "existing" })).toEqual({ outcome: "refused" });
    expect(await once.assertProviderUser(BOUND_ID)).toEqual({ outcome: "denied" });
    expect(onceServer.paths()).toEqual([PASSWORD_PATH]);
  });

  it("LIB-005 every failure after the provider sign-in can attempt best-effort local revocation of the transient session: one logout with scope `local` and the session's own token, also after a release whose write failed; discard is idempotent", async () => {
    // The route's later failures (a failed redemption, a session-function
    // denial, a writer failure after the release) all end in `discard`.
    for (const stage of ["after sign-in", "after assertion", "after release"] as const) {
      const answer = sessionAnswer();
      const server = fakeAuthServer({ password: () => jsonAnswer(200, answer) });
      const { bridge, signal } = bridgeWith(server);
      const hold = await heldPasswordSignIn(bridge);
      if (stage !== "after sign-in") {
        await hold.assertProviderUser(BOUND_ID);
      }
      if (stage === "after release") {
        expect(hold.release({ sessionOutcome: "created" }).outcome).toBe("released");
      }
      const first = hold.discard();
      const second = hold.discard();
      expect(second).toBe(first);
      expect(await first).toEqual({ outcome: "discarded", cleanup: "cleaned" });
      expect(Object.isFrozen(await first)).toBe(true);
      expect(await hold.discard()).toBe(await first);
      expect(hold.release({ sessionOutcome: "created" })).toEqual({ outcome: "refused" });
      expect(server.requests).toEqual([expect.objectContaining({ path: PASSWORD_PATH }), logoutRequestFor(answer)]);
      expect(server.requests[1].apikey).toBe(ANON_KEY);
      expect(signal).not.toHaveBeenCalled();
    }

    // A malformed bound id denies and cleans up, like a different one.
    for (const bound of [BOUND_ID.toUpperCase(), `${BOUND_ID}\n`, `{${BOUND_ID}}`, "", 42, null]) {
      const answer = sessionAnswer();
      const server = fakeAuthServer({ password: () => jsonAnswer(200, answer) });
      const hold = await heldPasswordSignIn(bridgeWith(server).bridge);
      expect(await hold.assertProviderUser(bound as never)).toEqual({ outcome: "denied" });
      expect(hold.release({ sessionOutcome: "created" })).toEqual({ outcome: "refused" });
      expect(server.requests.filter((recorded) => recorded.path === LOGOUT_PATH)).toEqual([
        logoutRequestFor(answer),
      ]);
    }
  });

  it("LIB-006 an induced cleanup failure still denies: the hold cannot be released, the signal is raised once with no argument, and nothing is logged", async () => {
    const failingLogouts: ReadonlyArray<readonly [string, Responder]> = [
      ["a server error", () => new Response("", { status: 500 })],
      ["an unauthorized answer", () => jsonAnswer(401, { code: "bad_jwt", message: "invalid JWT" })],
      ["a forbidden answer", () => jsonAnswer(403, { code: "session_not_found", message: "no session" })],
      [
        "a network error",
        () => {
          throw new TypeError("fetch failed");
        },
      ],
      ["a hang past the deadline", hangingUntilAborted],
      ["a hang that ignores the abort", neverAnswering],
    ];
    for (const [label, logout] of failingLogouts) {
      const server = fakeAuthServer({ logout });
      const { bridge, signal } = bridgeWith(server);
      const hold = await heldPasswordSignIn(bridge);
      await hold.assertProviderUser(BOUND_ID);
      const startedAt = Date.now();
      expect(await hold.discard(), label).toEqual({ outcome: "discarded", cleanup: "failed" });
      expect(Date.now() - startedAt, label).toBeLessThan(TIMEOUT + 2000);
      expect(signal.mock.calls, label).toEqual([[]]);
      expect(hold.release({ sessionOutcome: "created" }), label).toEqual({ outcome: "refused" });
      expect(await hold.discard(), label).toEqual({ outcome: "discarded", cleanup: "failed" });
      expect(signal, label).toHaveBeenCalledTimes(1);
    }

    // A throwing signal changes nothing.
    const server = fakeAuthServer({ logout: () => new Response("", { status: 500 }) });
    const { bridge, signal } = bridgeWith(server, {
      signal: () => {
        throw new Error("the signal failed");
      },
    });
    const hold = await heldPasswordSignIn(bridge);
    expect(await hold.assertProviderUser(OTHER_ID)).toEqual({ outcome: "denied" });
    expect(signal).toHaveBeenCalledTimes(1);
    expect(await hold.discard()).toEqual({ outcome: "discarded", cleanup: "failed" });
    expect(hold.release({ sessionOutcome: "created" })).toEqual({ outcome: "refused" });
  });
});

describe("loginIdentityBridge - the provider-id assertion (the bridge's own deny test)", () => {
  it("LIB-007 Guide or Admin: a session for another user is denied at the assertion and cleaned up; a token whose subject is not the answer's user fails at sign-in and is cleaned up", async () => {
    const answer = sessionAnswer({ userId: OTHER_ID });
    const server = fakeAuthServer({ password: () => jsonAnswer(200, answer) });
    const { bridge, signal } = bridgeWith(server);
    const hold = await heldPasswordSignIn(bridge);
    expect(await hold.assertProviderUser(BOUND_ID)).toEqual({ outcome: "denied" });
    expect(hold.release({ sessionOutcome: "created" })).toEqual({ outcome: "refused" });
    expect(hold.release({ sessionOutcome: "existing" })).toEqual({ outcome: "refused" });
    expect(server.requests).toEqual([expect.objectContaining({ path: PASSWORD_PATH }), logoutRequestFor(answer)]);
    expect(signal).not.toHaveBeenCalled();

    const mixed = sessionAnswer({ subject: OTHER_ID });
    const mixedServer = fakeAuthServer({ password: () => jsonAnswer(200, mixed) });
    const mixedBridge = bridgeWith(mixedServer).bridge;
    expect(await mixedBridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })).toEqual({
      outcome: "failed",
    });
    expect(mixedServer.requests).toEqual([expect.objectContaining({ path: PASSWORD_PATH }), logoutRequestFor(mixed)]);
  });

  it("LIB-008 Explorer: a link made for another user is denied before any exchange; an exchanged session for another user is denied and cleaned up; a malformed link answer fails with no exchange", async () => {
    // The pre-exchange assertion: no session is minted.
    const otherLink = fakeLinkAdmin(() => linkSeamAnswer({ userId: OTHER_ID }));
    const quietServer = fakeAuthServer();
    const quiet = bridgeWith(quietServer, { linkAdmin: otherLink.admin });
    expect(
      await quiet.bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID }),
    ).toEqual({ outcome: "denied" });
    expect(otherLink.calls).toHaveLength(1);
    expect(quietServer.requests).toEqual([]);
    expect(quiet.signal).not.toHaveBeenCalled();

    // The exchanged session belongs to someone else.
    const answer = sessionAnswer({ userId: OTHER_ID, email: EXPLORER_EMAIL });
    const server = fakeAuthServer({ verify: () => jsonAnswer(200, answer) });
    const { bridge } = bridgeWith(server);
    expect(await bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID })).toEqual({
      outcome: "denied",
    });
    expect(server.requests).toEqual([expect.objectContaining({ path: VERIFY_PATH }), logoutRequestFor(answer)]);

    // Malformed link answers, and a seam that throws, rejects or hangs.
    const malformed: ReadonlyArray<readonly [string, () => unknown]> = [
      ["an error", () => ({ ...linkSeamAnswer(), error: { status: 422, code: "validation_failed" } })],
      ["another link type", () => linkSeamAnswer({ verificationType: "signup" })],
      ["no token hash", () => linkSeamAnswer({ hashedToken: undefined })],
      ["an empty token hash", () => linkSeamAnswer({ hashedToken: "" })],
      ["a token hash with a space", () => linkSeamAnswer({ hashedToken: "abc def" })],
      ["a token hash with a line break", () => linkSeamAnswer({ hashedToken: "abc\n" })],
      [
        "an oversized token hash",
        () => linkSeamAnswer({ hashedToken: "a".repeat(LOGIN_IDENTITY_BRIDGE_LIMITS.maximumLinkTokenLength + 1) }),
      ],
      [
        "no user",
        () => ({
          data: { properties: { hashed_token: LINK_TOKEN, verification_type: "magiclink" }, user: null },
          error: null,
        }),
      ],
      ["no data", () => ({ data: null, error: null })],
      ["not an object", () => "link"],
      [
        "a throwing seam",
        () => {
          throw new Error("generate failed");
        },
      ],
      ["a rejecting seam", () => Promise.reject(new Error("generate failed"))],
      ["a hanging seam", () => new Promise(() => undefined)],
    ];
    for (const [label, seamAnswer] of malformed) {
      const linkServer = fakeAuthServer();
      const link = fakeLinkAdmin(seamAnswer);
      const linkBridge = bridgeWith(linkServer, { linkAdmin: link.admin });
      expect(
        await linkBridge.bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID }),
        label,
      ).toEqual({ outcome: "failed" });
      expect(linkServer.requests, label).toEqual([]);
      expect(linkBridge.signal, label).not.toHaveBeenCalled();
    }
  });
});

describe("loginIdentityBridge - credentials, provider failures and the deadline", () => {
  it("LIB-009 refused credentials hold nothing and need no cleanup; every other provider failure is `failed` with nothing held, and an answer that carries an access token the library cannot accept is revoked with that token", async () => {
    const refused = fakeAuthServer({
      password: () => jsonAnswer(400, { code: "invalid_credentials", message: "Invalid login credentials" }),
    });
    const refusedBridge = bridgeWith(refused);
    expect(await refusedBridge.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })).toEqual({
      outcome: "credentials_refused",
    });
    expect(refused.paths()).toEqual([PASSWORD_PATH]);
    expect(refusedBridge.signal).not.toHaveBeenCalled();

    const failures: ReadonlyArray<readonly [string, Responder]> = [
      ["an unconfirmed email", () => jsonAnswer(400, { code: "email_not_confirmed", message: "Email not confirmed" })],
      ["a rate limit", () => jsonAnswer(429, { code: "over_request_rate_limit", message: "Too many requests" })],
      ["a server error", () => jsonAnswer(500, { code: "unexpected_failure", message: "Internal error" })],
      ["an unavailable service", () => new Response("", { status: 503 })],
      [
        "a network error",
        () => {
          throw new TypeError("fetch failed");
        },
      ],
      ["a body that is not JSON", () => new Response("not json", { status: 200 })],
      ["an answer with no session", () => jsonAnswer(200, {})],
    ];
    for (const [label, password] of failures) {
      const server = fakeAuthServer({ password });
      const { bridge, signal } = bridgeWith(server);
      expect(await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD }), label).toEqual({
        outcome: "failed",
      });
      expect(server.paths(), label).toEqual([PASSWORD_PATH]);
      expect(signal, label).not.toHaveBeenCalled();
    }

    // The exchange's own provider failures.
    for (const [label, verify] of failures) {
      const server = fakeAuthServer({ verify });
      const { bridge } = bridgeWith(server);
      expect(
        await bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID }),
        label,
      ).toEqual({ outcome: "failed" });
      expect(server.paths(), label).toEqual([VERIFY_PATH]);
    }

    // An answer that carries an access token but no session the library
    // accepts: the library's answer then has no token, and the bridge revokes
    // the one it read from the answer itself.
    const tokenBearing: ReadonlyArray<readonly [string, () => Record<string, unknown>]> = [
      ["an answer with no refresh token", () => ({ ...sessionAnswer(), refresh_token: undefined })],
      ["an answer with no expires_in", () => ({ ...sessionAnswer(), expires_in: undefined })],
    ];
    for (const [label, makeAnswer] of tokenBearing) {
      for (const route of ["password", "verify"] as const) {
        const answer = makeAnswer();
        const respond: Responder = () => jsonAnswer(200, answer);
        const server = fakeAuthServer(route === "password" ? { password: respond } : { verify: respond });
        const { bridge, signal } = bridgeWith(server);
        const result =
          route === "password"
            ? await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })
            : await bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID });
        expect(result, `${label} (${route})`).toEqual({ outcome: "failed" });
        expect(server.requests, `${label} (${route})`).toEqual([
          expect.objectContaining({ path: route === "password" ? PASSWORD_PATH : VERIFY_PATH }),
          logoutRequestFor(answer),
        ]);
        expect(signal, `${label} (${route})`).not.toHaveBeenCalled();
      }
    }
  });

  it("LIB-010 a sign-in or exchange that does not answer within the deadline fails, the abort reaches the fetch, and a session answer that cannot be accepted is cleaned up", async () => {
    for (const [label, hang] of [
      ["a hang that reacts to the abort", hangingUntilAborted],
      ["a hang that ignores the abort", neverAnswering],
    ] as const) {
      const server = fakeAuthServer({ password: hang, verify: hang });
      const { bridge } = bridgeWith(server);
      const startedAt = Date.now();
      expect(await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD }), label).toEqual({
        outcome: "failed",
      });
      expect(
        await bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID }),
        label,
      ).toEqual({ outcome: "failed" });
      const elapsed = Date.now() - startedAt;
      expect(elapsed, label).toBeGreaterThanOrEqual(2 * TIMEOUT - 20);
      expect(elapsed, label).toBeLessThan(2 * TIMEOUT + 3000);
      expect(server.paths(), label).toEqual([PASSWORD_PATH, VERIFY_PATH]);
      for (const request of server.requests) {
        expect(request.signal, label).toBeInstanceOf(AbortSignal);
        expect(request.signal?.aborted, label).toBe(true);
      }
    }

    // Session answers the bridge cannot accept immediately get best-effort
    // local revocation.
    const unacceptable: ReadonlyArray<readonly [string, () => Record<string, unknown>]> = [
      ["a token that is not a JWT", () => sessionAnswer({ accessToken: "not-a-jwt" })],
      [
        "a token with no exp",
        () =>
          sessionAnswer({
            accessToken: syntheticAccessToken({ sub: BOUND_ID, iat: nowSeconds() }),
          }),
      ],
      [
        "a token with a fractional exp",
        () =>
          sessionAnswer({
            accessToken: syntheticAccessToken({ sub: BOUND_ID, exp: nowSeconds() + 3600.5 }),
          }),
      ],
      ["a token with an unreadable payload", () => sessionAnswer({ accessToken: "eyJhbGciOiJIUzI1NiJ9.%%%.c2ln" })],
      ["a token whose subject is another user", () => sessionAnswer({ subject: OTHER_ID })],
    ];
    for (const [label, makeAnswer] of unacceptable) {
      const answer = makeAnswer();
      const server = fakeAuthServer({ password: () => jsonAnswer(200, answer) });
      const { bridge } = bridgeWith(server);
      expect(await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD }), label).toEqual({
        outcome: "failed",
      });
      expect(server.requests, label).toEqual([expect.objectContaining({ path: PASSWORD_PATH }), logoutRequestFor(answer)]);
    }
  });

  it("LIB-011 the provider expiry is the access token's own exp claim; an earlier or later stored expires_at, or one the library works out itself, does not redefine it", async () => {
    const cases: ReadonlyArray<readonly [string, AnswerOptions]> = [
      // Contract 25 Section 7 sizes the session from the access token's
      // remaining life: an earlier stored expires_at must not shorten it.
      ["expires_at earlier", { expiresAtOffset: -100 }],
      ["expires_at later", { expiresAtOffset: 100 }],
      ["exp earlier", { expOffset: -50 }],
      ["equal", {}],
      // With no expires_at the library adds expires_in to this server's
      // clock.
      ["expires_at worked out by the library", { omitExpiresAt: true }],
    ];
    for (const [label, options] of cases) {
      const answer = sessionAnswer(options);
      const server = fakeAuthServer({ password: () => jsonAnswer(200, answer) });
      const hold = await heldPasswordSignIn(bridgeWith(server).bridge);
      expect(hold.accessTokenExpiresAt, label).toBe(expOf(accessTokenOf(answer)));
      if (options.expiresAtOffset !== undefined) {
        expect(hold.accessTokenExpiresAt, label).not.toBe(answer.expires_at);
      }
      expect(Number.isSafeInteger(hold.accessTokenExpiresAt), label).toBe(true);
    }
  });

  it("LIB-012 a malformed request is refused before any provider call, and no getter on it runs", async () => {
    const getter = vi.fn(() => GUIDE_EMAIL);
    const signInRequests: unknown[] = [
      null,
      undefined,
      "guide",
      [GUIDE_EMAIL, PASSWORD],
      {},
      { email: GUIDE_EMAIL },
      { email: GUIDE_EMAIL, password: "" },
      { email: GUIDE_EMAIL, password: 42 },
      { email: GUIDE_EMAIL, password: PASSWORD, extra: true },
      { email: "guide.example", password: PASSWORD },
      { email: "guide @solmind.example", password: PASSWORD },
      { email: `${GUIDE_EMAIL}\n`, password: PASSWORD },
      { email: "guide\u0000@solmind.example", password: PASSWORD },
      { email: "guide@solmind@example", password: PASSWORD },
      { email: `${"g".repeat(250)}@x.example`, password: PASSWORD },
      Object.defineProperty({ password: PASSWORD }, "email", { enumerable: true, get: getter }),
      Object.create({ email: GUIDE_EMAIL, password: PASSWORD }),
      new (class {
        email = GUIDE_EMAIL;
        password = PASSWORD;
      })(),
    ];
    const exchangeRequests: unknown[] = [
      null,
      {},
      { email: EXPLORER_EMAIL },
      { email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID.toUpperCase() },
      { email: EXPLORER_EMAIL, boundProviderUserId: `{${BOUND_ID}}` },
      { email: EXPLORER_EMAIL, boundProviderUserId: `${BOUND_ID}\n` },
      { email: EXPLORER_EMAIL, boundProviderUserId: 42 },
      { email: "explorer", boundProviderUserId: BOUND_ID },
      { email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID, extra: true },
      Object.defineProperty({ boundProviderUserId: BOUND_ID }, "email", { enumerable: true, get: getter }),
    ];
    const server = fakeAuthServer();
    const link = fakeLinkAdmin();
    const { bridge } = bridgeWith(server, { linkAdmin: link.admin });
    for (const request of signInRequests) {
      expect(await bridge.signInWithPassword(request as never)).toEqual({ outcome: "invalid_request" });
    }
    for (const request of exchangeRequests) {
      expect(await bridge.exchangeExplorerLink(request as never)).toEqual({ outcome: "invalid_request" });
    }
    expect(server.requests).toEqual([]);
    expect(link.calls).toEqual([]);
    expect(getter).not.toHaveBeenCalled();
    // A null-prototype request is a plain request.
    const plain = Object.assign(Object.create(null) as object, { email: GUIDE_EMAIL, password: PASSWORD });
    expect((await bridge.signInWithPassword(plain as never)).outcome).toBe("held");
  });

  it("LIB-013 malformed configuration or dependencies throw one fixed, value-free error; the limits are fixed", () => {
    const configuration = {
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
      authCookieName: LOOPBACK.authCookieName,
      providerTimeoutMilliseconds: TIMEOUT,
    };
    const dependencies = {
      fetch: fakeAuthServer().send as unknown as typeof fetch,
      linkAdmin: fakeLinkAdmin().admin,
      signalCleanupFailure: () => undefined,
    };
    expect(() => createLoginIdentityBridge(configuration, dependencies)).not.toThrow();
    expect(() =>
      createLoginIdentityBridge({ ...configuration, authCookieName: HOSTED.authCookieName }, dependencies),
    ).not.toThrow();
    const getter = vi.fn(() => ANON_KEY);
    const badConfigurations: unknown[] = [
      null,
      { ...configuration, supabaseUrl: "ftp://127.0.0.1:54321" },
      { ...configuration, supabaseUrl: "not a url" },
      { ...configuration, supabaseUrl: "http://user:secret@127.0.0.1:54321" },
      { ...configuration, supabaseUrl: 54321 },
      { ...configuration, anonKey: "" },
      { ...configuration, anonKey: "with space" },
      { ...configuration, anonKey: "line\nbreak" },
      { ...configuration, authCookieName: "solmind.auth" },
      { ...configuration, authCookieName: "" },
      { ...configuration, authCookieName: "a".repeat(65) },
      { ...configuration, providerTimeoutMilliseconds: 9 },
      { ...configuration, providerTimeoutMilliseconds: 60_001 },
      { ...configuration, providerTimeoutMilliseconds: 200.5 },
      { ...configuration, providerTimeoutMilliseconds: Number.NaN },
      { ...configuration, providerTimeoutMilliseconds: "200" },
      { ...configuration, extra: true },
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, authCookieName: LOOPBACK.authCookieName },
      Object.defineProperty({ ...configuration, anonKey: undefined }, "anonKey", { enumerable: true, get: getter }),
    ];
    for (const bad of badConfigurations) {
      expect(() => createLoginIdentityBridge(bad as never, dependencies)).toThrow(LoginIdentityBridgeConfigurationError);
    }
    const badDependencies: unknown[] = [
      null,
      { ...dependencies, fetch: "fetch" },
      { ...dependencies, linkAdmin: null },
      { ...dependencies, linkAdmin: {} },
      { ...dependencies, linkAdmin: { generateLink: "link" } },
      { ...dependencies, signalCleanupFailure: null },
      { ...dependencies, extra: true },
      { fetch: dependencies.fetch, linkAdmin: dependencies.linkAdmin },
    ];
    for (const bad of badDependencies) {
      expect(() => createLoginIdentityBridge(configuration, bad as never)).toThrow(LoginIdentityBridgeConfigurationError);
    }
    expect(getter).not.toHaveBeenCalled();
    let thrown: unknown = null;
    try {
      createLoginIdentityBridge({ ...configuration, anonKey: "with space" }, dependencies);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LoginIdentityBridgeConfigurationError);
    expect((thrown as Error).message).toBe("SolMind login identity bridge: invalid configuration or dependencies.");
    for (const secret of [ANON_KEY, SUPABASE_URL, "with space"]) {
      expect(textOf(thrown)).not.toContain(secret);
    }
    expect(LOGIN_IDENTITY_BRIDGE_LIMITS).toEqual({
      minimumProviderTimeoutMilliseconds: 10,
      maximumProviderTimeoutMilliseconds: 60_000,
      maximumEmailLength: 254,
      maximumLinkTokenLength: 1024,
    });
    expect(Object.isFrozen(LOGIN_IDENTITY_BRIDGE_LIMITS)).toBe(true);
  });

  it("LIB-014 every result except a successful release is frozen and carries no token, cookie value, password, email, link token or provider id", async () => {
    const results: unknown[] = [];
    const secrets = new Set<string>([PASSWORD, GUIDE_EMAIL, EXPLORER_EMAIL, LINK_TOKEN, BOUND_ID, OTHER_ID, ANON_KEY]);
    const remember = (answer: Record<string, unknown>) => {
      secrets.add(accessTokenOf(answer));
      secrets.add(answer.refresh_token as string);
      secrets.add(storedValue(answer));
    };

    const good = sessionAnswer();
    remember(good);
    const goodServer = fakeAuthServer({ password: () => jsonAnswer(200, good), verify: () => jsonAnswer(200, good) });
    const { bridge } = bridgeWith(goodServer);
    const held = await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD });
    results.push(held);
    if (held.outcome === "held") {
      results.push(held.hold, await held.hold.assertProviderUser(BOUND_ID));
      results.push(held.hold.release({ sessionOutcome: "denied" } as never), await held.hold.discard());
    }
    const exchanged = await bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID });
    results.push(exchanged);
    if (exchanged.outcome === "held") {
      results.push(await exchanged.hold.assertProviderUser(OTHER_ID));
    }
    results.push(
      await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: "" }),
      await bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: "x" }),
    );
    const refused = fakeAuthServer({
      password: () => jsonAnswer(400, { code: "invalid_credentials", message: "Invalid login credentials" }),
    });
    results.push(await bridgeWith(refused).bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD }));
    const other = sessionAnswer({ userId: OTHER_ID });
    remember(other);
    const otherServer = fakeAuthServer({ verify: () => jsonAnswer(200, other) });
    results.push(
      await bridgeWith(otherServer).bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID }),
    );
    const failing = fakeAuthServer({ logout: () => new Response("", { status: 500 }) });
    const failingHold = await heldPasswordSignIn(bridgeWith(failing).bridge);
    for (const answer of failing.answers) {
      remember(answer);
    }
    results.push(await failingHold.discard());

    for (const result of results) {
      expect(Object.isFrozen(result)).toBe(true);
      const text = textOf(result);
      for (const secret of secrets) {
        expect(text).not.toContain(secret);
      }
    }
    // Refusals are shared constants.
    expect(await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: "" })).toBe(
      await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: "" }),
    );
  });
});

describe("loginIdentityBridge - abnormal hand-overs (a scripted stand-in for the SSR library)", () => {
  type ScriptedOptions = Readonly<{
    cookieOptions: { name: string };
    cookies: { getAll: (...hints: unknown[]) => unknown; setAll: (cookies: unknown, headers?: unknown) => unknown };
    global: { fetch: unknown };
  }>;
  type ScriptedCall = Readonly<{ url: string; key: string; options: ScriptedOptions }>;
  type HandOver = (options: ScriptedOptions, answer: Record<string, unknown>) => void;

  function heldEntries(name: string, answer: Record<string, unknown>) {
    return createChunks(name, storedValue(answer)).map((chunk) => ({
      name: chunk.name,
      value: chunk.value,
      options: { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 * 24 * 60 * 60 },
    }));
  }

  // Loads the bridge with `@supabase/ssr` replaced by a scripted stand-in
  // whose sign-in answers `answer()` after running `handOver`.
  async function scriptedBridge(
    handOver: HandOver,
    answer: (fresh: Record<string, unknown>) => unknown = (fresh) => ({
      data: { user: fresh.user, session: fresh },
      error: null,
    }),
  ) {
    const calls: ScriptedCall[] = [];
    const signOuts: Array<readonly [string, string]> = [];
    const answers: Record<string, unknown>[] = [];
    let lastOptions: ScriptedOptions | null = null;
    vi.resetModules();
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: (url: string, key: string, options: ScriptedOptions) => {
        calls.push({ url, key, options });
        lastOptions = options;
        return {
          auth: {
            signInWithPassword: async () => {
              const fresh = sessionAnswer({ padding: 4000 });
              answers.push(fresh);
              handOver(options, fresh);
              return answer(fresh);
            },
            verifyOtp: async () => {
              const fresh = sessionAnswer();
              answers.push(fresh);
              handOver(options, fresh);
              return answer(fresh);
            },
            admin: {
              signOut: async (jwt: string, scope: string) => {
                signOuts.push([jwt, scope]);
                return { data: null, error: null };
              },
            },
          },
        };
      },
    }));
    try {
      const loaded = await import("../loginIdentityBridge");
      const signal = vi.fn();
      const bridge = loaded.createLoginIdentityBridge(
        {
          supabaseUrl: SUPABASE_URL,
          anonKey: ANON_KEY,
          authCookieName: LOOPBACK.authCookieName,
          providerTimeoutMilliseconds: TIMEOUT,
        },
        {
          fetch: fakeAuthServer().send as unknown as typeof fetch,
          linkAdmin: fakeLinkAdmin().admin,
          signalCleanupFailure: signal,
        },
      );
      return { bridge, calls, signOuts, answers, signal, options: () => lastOptions };
    } finally {
      vi.doUnmock("@supabase/ssr");
      vi.resetModules();
    }
  }

  const N = LOOPBACK.authCookieName;

  it("LIB-015 the SSR client gets exactly the cookie name, a cookie reader that returns no cookies, a holding setter and the bounded transport; one client and one transport per sign-in", async () => {
    const injected = fakeAuthServer();
    vi.resetModules();
    const calls: ScriptedCall[] = [];
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: (url: string, key: string, options: ScriptedOptions) => {
        calls.push({ url, key, options });
        return {
          auth: {
            signInWithPassword: async () => {
              const fresh = sessionAnswer();
              options.cookies.setAll(heldEntries(N, fresh), {});
              return { data: { user: fresh.user, session: fresh }, error: null };
            },
            verifyOtp: async () => ({ data: { user: null, session: null }, error: null }),
            admin: { signOut: async () => ({ data: null, error: null }) },
          },
        };
      },
    }));
    const loaded: typeof bridgeModule = await (async () => {
      try {
        return await import("../loginIdentityBridge");
      } finally {
        vi.doUnmock("@supabase/ssr");
        vi.resetModules();
      }
    })();
    const bridge = loaded.createLoginIdentityBridge(
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, authCookieName: N, providerTimeoutMilliseconds: TIMEOUT },
      { fetch: injected.send as unknown as typeof fetch, linkAdmin: fakeLinkAdmin().admin, signalCleanupFailure: () => undefined },
    );
    expect(calls).toEqual([]);
    expect((await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })).outcome).toBe("held");
    expect((await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })).outcome).toBe("held");
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.url).toBe(SUPABASE_URL);
      expect(call.key).toBe(ANON_KEY);
      expect(Object.keys(call.options).sort()).toEqual(["cookieOptions", "cookies", "global"]);
      expect(call.options.cookieOptions).toEqual({ name: N });
      expect(Object.keys(call.options.cookies).sort()).toEqual(["getAll", "setAll"]);
      expect(call.options.cookies.getAll()).toEqual([]);
      expect(call.options.cookies.getAll([N, `${N}-code-verifier`])).toEqual([]);
      expect(Object.keys(call.options.global)).toEqual(["fetch"]);
      expect(typeof call.options.global.fetch).toBe("function");
      expect(call.options.global.fetch).not.toBe(injected.send);
      // The setter never throws, whatever it is given.
      expect(call.options.cookies.setAll(null)).toBeUndefined();
      expect(call.options.cookies.setAll([{ name: 1, value: {} }], {})).toBeUndefined();
    }
    expect(calls[0].options.cookies).not.toBe(calls[1].options.cookies);
    // Each attempt has its own transport, so their recovered tokens never mix.
    expect(calls[0].options.global.fetch).not.toBe(calls[1].options.global.fetch);
    // The transport is the bounded one: a hang becomes a 503 answer.
    const hanging = fakeAuthServer({ password: neverAnswering });
    const transportBridge = loaded.createLoginIdentityBridge(
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, authCookieName: N, providerTimeoutMilliseconds: TIMEOUT },
      { fetch: hanging.send as unknown as typeof fetch, linkAdmin: fakeLinkAdmin().admin, signalCleanupFailure: () => undefined },
    );
    await transportBridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD });
    const transport = calls[2].options.global.fetch as typeof fetch;
    const answer = await transport(`${SUPABASE_URL}${PASSWORD_PATH}`, { method: "POST" });
    expect(answer.status).toBe(503);
    expect(await answer.text()).toBe("");
  });

  it("LIB-016 the hold takes exactly one well-formed hand-over that carries the answered session; anything else fails and is cleaned up, and a hand-over after the sign-in is ignored", async () => {
    const getter = vi.fn(() => N);
    const cases: ReadonlyArray<readonly [string, HandOver]> = [
      ["no hand-over", () => undefined],
      [
        "two hand-overs",
        (options, answer) => {
          options.cookies.setAll(heldEntries(N, answer), {});
          options.cookies.setAll(heldEntries(N, answer), {});
        },
      ],
      ["not a list", (options) => options.cookies.setAll({ name: N, value: "x" }, {})],
      ["an empty list", (options) => options.cookies.setAll([], {})],
      [
        "an entry with an extra key",
        (options, answer) =>
          options.cookies.setAll(
            heldEntries(N, answer).map((entry) => ({ ...entry, extra: true })),
            {},
          ),
      ],
      ["a value that is not a string", (options) => options.cookies.setAll([{ name: N, value: 42 }], {})],
      ["an empty name", (options, answer) => options.cookies.setAll([{ name: "", value: storedValue(answer) }], {})],
      [
        "a getter entry",
        (options, answer) =>
          options.cookies.setAll(
            [Object.defineProperty({ value: storedValue(answer) }, "name", { enumerable: true, get: getter })],
            {},
          ),
      ],
      ["only removals", (options) => options.cookies.setAll([{ name: `${N}-code-verifier`, value: "" }], {})],
      [
        "chunks out of order",
        (options, answer) => options.cookies.setAll(heldEntries(N, answer).reverse(), {}),
      ],
      [
        "N with chunks",
        (options, answer) =>
          options.cookies.setAll([{ name: N, value: storedValue(answer) }, ...heldEntries(N, answer)], {}),
      ],
      [
        "another cookie name",
        (options, answer) => options.cookies.setAll(heldEntries("other-auth", answer), {}),
      ],
    ];
    for (const [label, handOver] of cases) {
      const scripted = await scriptedBridge(handOver);
      expect(await scripted.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD }), label).toEqual({
        outcome: "failed",
      });
      expect(scripted.signOuts, label).toEqual([[accessTokenOf(scripted.answers[0]), "local"]]);
      expect(scripted.signal, label).not.toHaveBeenCalled();
    }
    expect(getter).not.toHaveBeenCalled();

    // A well-formed hand-over of another session's cookies: both that
    // session's token and the answered one are revoked.
    const others: Record<string, unknown>[] = [];
    const otherSession = await scriptedBridge((options) => {
      const other = sessionAnswer({ padding: 4000 });
      others.push(other);
      options.cookies.setAll(heldEntries(N, other), {});
    });
    expect(await otherSession.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })).toEqual({
      outcome: "failed",
    });
    expect(others).toHaveLength(1);
    expect(otherSession.signOuts).toEqual([
      [accessTokenOf(otherSession.answers[0]), "local"],
      [accessTokenOf(others[0]), "local"],
    ]);
    expect(otherSession.signal).not.toHaveBeenCalled();

    // The answer's user and the session's user must be one id.
    const split = await scriptedBridge(
      (options, answer) => options.cookies.setAll(heldEntries(N, answer), {}),
      (fresh) => ({
        data: { user: { id: OTHER_ID }, session: fresh },
        error: null,
      }),
    );
    expect(await split.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })).toEqual({
      outcome: "failed",
    });
    expect(split.signOuts).toEqual([[accessTokenOf(split.answers[0]), "local"]]);

    // A hand-over after the sign-in finished never reaches a release.
    const late = await scriptedBridge((options, answer) => options.cookies.setAll(heldEntries(N, answer), {}));
    const result = await late.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD });
    expect(result.outcome).toBe("held");
    late.options()?.cookies.setAll(heldEntries(N, sessionAnswer({ padding: 4000 })), {});
    if (result.outcome === "held") {
      await result.hold.assertProviderUser(BOUND_ID);
      const released = result.hold.release({ sessionOutcome: "created" });
      expect(released).toEqual({
        outcome: "released",
        heldCookies: heldEntries(N, late.answers[0]).map(({ name, value }) => ({ name, value })),
      });
    }
  });

  it("LIB-017 a library call that throws or rejects before any hand-over fails with nothing to clean, and after a completed hand-over fails and revokes the handed-over token; an answer with both an error and a session fails and is cleaned up", async () => {
    for (const [label, behaviour] of [
      [
        "a throw",
        () => {
          throw new Error("library failure");
        },
      ],
      ["a rejection", () => Promise.reject(new Error("library failure"))],
    ] as const) {
      const scripted = await scriptedBridge(() => undefined, behaviour);
      expect(await scripted.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD }), label).toEqual({
        outcome: "failed",
      });
      expect(scripted.signOuts, label).toEqual([]);

      // The same failure after the library had already handed the session's
      // cookies over: that evidence is kept and its token revoked.
      const handedOver = await scriptedBridge(
        (options, answer) => options.cookies.setAll(heldEntries(N, answer), {}),
        behaviour,
      );
      expect(
        await handedOver.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD }),
        `${label} after a hand-over`,
      ).toEqual({ outcome: "failed" });
      expect(handedOver.signOuts, `${label} after a hand-over`).toEqual([
        [accessTokenOf(handedOver.answers[0]), "local"],
      ]);
      expect(handedOver.signal, `${label} after a hand-over`).not.toHaveBeenCalled();
    }
    const contradictory = await scriptedBridge(
      (options, answer) => options.cookies.setAll(heldEntries(N, answer), {}),
      (fresh) => ({ data: { user: fresh.user, session: fresh }, error: { status: 500, code: "unexpected_failure" } }),
    );
    expect(await contradictory.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })).toEqual({
      outcome: "failed",
    });
    expect(contradictory.signOuts).toEqual([[accessTokenOf(contradictory.answers[0]), "local"]]);
    // The same rules hold for the exchange.
    const exchange = await scriptedBridge(() => undefined);
    expect(await exchange.bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID })).toEqual(
      { outcome: "failed" },
    );
    expect(exchange.signOuts).toEqual([[accessTokenOf(exchange.answers[0]), "local"]]);
  });
});

describe("loginIdentityBridge - late answers, concurrent attempts and the link seam's fetch precondition", () => {
  const LATE = TIMEOUT + 100;

  it("LIB-018 a successful answer read only after the deadline, whole or through a delayed body, still fails with no hold and nothing released, and its own token immediately gets best-effort local revocation; a failed revocation raises the value-free signal once; a body the abort cancels leaves no token to revoke", async () => {
    type LateCase = readonly [string, "password" | "verify", (answer: Record<string, unknown>) => Response | Promise<Response>];
    const cases: ReadonlyArray<LateCase> = [
      ["a password answer after the deadline", "password", (answer) => lateAnswer(answer, LATE)],
      [
        "a password answer whose body completes after the deadline",
        "password",
        (answer) => delayedBodyAnswer(answer, LATE),
      ],
      ["a verify answer after the deadline", "verify", (answer) => lateAnswer(answer, LATE)],
      [
        "a verify answer whose body completes after the deadline",
        "verify",
        (answer) => delayedBodyAnswer(answer, LATE),
      ],
    ];
    for (const [label, route, respondLate] of cases) {
      const answer = sessionAnswer();
      const respond: Responder = () => respondLate(answer);
      const server = fakeAuthServer(route === "password" ? { password: respond } : { verify: respond });
      const { bridge, signal } = bridgeWith(server);
      const requestPath = route === "password" ? PASSWORD_PATH : VERIFY_PATH;
      const result =
        route === "password"
          ? await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })
          : await bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID });
      // The bridge answered at the deadline, before the late answer was read:
      // no hold exists, so nothing can ever be released from this attempt.
      expect(result, label).toEqual({ outcome: "failed" });
      expect(Object.isFrozen(result), label).toBe(true);
      expect(server.paths(), label).toEqual([requestPath]);
      // Then the late answer is read, and its own session is revoked.
      await eventually(() => server.paths().includes(LOGOUT_PATH), label);
      await delay(50);
      expect(server.requests, label).toEqual([expect.objectContaining({ path: requestPath }), logoutRequestFor(answer)]);
      expect(server.requests[1].apikey, label).toBe(ANON_KEY);
      expect(signal, label).not.toHaveBeenCalled();
    }

    // An answer that a stalled event loop delivers after the deadline: it is
    // late however the race ends, and its own session is revoked.
    const stalled = sessionAnswer();
    const stallServer = fakeAuthServer({
      password: () => {
        const until = performance.now() + LATE;
        while (performance.now() < until) {
          // A blocked event loop.
        }
        return jsonAnswer(200, stalled);
      },
    });
    const stall = bridgeWith(stallServer);
    expect(await stall.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })).toEqual({
      outcome: "failed",
    });
    await eventually(() => stallServer.paths().includes(LOGOUT_PATH), "a stalled event loop");
    await delay(50);
    expect(stallServer.requests).toEqual([expect.objectContaining({ path: PASSWORD_PATH }), logoutRequestFor(stalled)]);
    expect(stall.signal).not.toHaveBeenCalled();

    // A late session whose revocation fails: the signal is raised once, with
    // no argument, and the result stays value-free.
    const failingLogouts: ReadonlyArray<readonly [string, Responder]> = [
      ["a server error", () => new Response("", { status: 500 })],
      [
        "a network error",
        () => {
          throw new TypeError("fetch failed");
        },
      ],
    ];
    for (const [label, logout] of failingLogouts) {
      const answer = sessionAnswer();
      const server = fakeAuthServer({ password: () => lateAnswer(answer, LATE), logout });
      const { bridge, signal } = bridgeWith(server);
      const result = await bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD });
      expect(result, label).toEqual({ outcome: "failed" });
      await eventually(() => signal.mock.calls.length > 0, label);
      await delay(50);
      expect(signal.mock.calls, label).toEqual([[]]);
      expect(server.requests.filter((recorded) => recorded.path === LOGOUT_PATH), label).toEqual([
        logoutRequestFor(answer),
      ]);
      expect(textOf(result), label).not.toContain(accessTokenOf(answer));
    }

    // A transport that cancels the body on abort: no access token is ever
    // recovered, so no revocation can be attempted.
    const cancelled = sessionAnswer();
    const cancelServer = fakeAuthServer({ password: (request) => delayedBodyAnswer(cancelled, LATE, request) });
    const cancel = bridgeWith(cancelServer);
    expect(await cancel.bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD })).toEqual({
      outcome: "failed",
    });
    await delay(LATE + 100);
    expect(cancelServer.paths()).toEqual([PASSWORD_PATH]);
    expect(cancelServer.requests[0].signal?.aborted).toBe(true);
    expect(cancel.signal).not.toHaveBeenCalled();
  }, 15_000);

  it("LIB-019 concurrent attempts keep their tokens apart: a late answer to one is revoked with its own token only, while the other's hold still asserts, releases its own cookies and discards with its own token", async () => {
    const LATE_EMAIL = "admin.s67@solmind.example";
    const onTime = sessionAnswer();
    const late = sessionAnswer();
    const server = fakeAuthServer({
      password: (request) =>
        (request.body as { email?: unknown }).email === LATE_EMAIL ? lateAnswer(late, LATE) : jsonAnswer(200, onTime),
    });
    const { bridge, signal } = bridgeWith(server);
    const [held, failed] = await Promise.all([
      bridge.signInWithPassword({ email: GUIDE_EMAIL, password: PASSWORD }),
      bridge.signInWithPassword({ email: LATE_EMAIL, password: PASSWORD }),
    ]);
    expect(failed).toEqual({ outcome: "failed" });
    expect(held.outcome).toBe("held");
    await eventually(() => server.paths().includes(LOGOUT_PATH), "the late revocation");
    await delay(50);
    const logouts = () => server.requests.filter((recorded) => recorded.path === LOGOUT_PATH);
    expect(logouts()).toEqual([logoutRequestFor(late)]);
    if (held.outcome === "held") {
      expect(await held.hold.assertProviderUser(BOUND_ID)).toEqual({ outcome: "asserted" });
      expect(held.hold.release({ sessionOutcome: "created" })).toEqual({
        outcome: "released",
        heldCookies: expectedHeld(LOOPBACK.authCookieName, onTime),
      });
      expect(await held.hold.discard()).toEqual({ outcome: "discarded", cleanup: "cleaned" });
    }
    expect(logouts()).toEqual([logoutRequestFor(late), logoutRequestFor(onTime)]);
    expect(signal).not.toHaveBeenCalled();
  }, 15_000);

  it("LIB-020 the link seam's fetch precondition: over the real admin API, a fetch that rejects with a sentinel-bearing error, in time or after the deadline, leaves the exchange failed, value-free and with no session, but the library itself logs the error, in time or after the deadline, which the bridge cannot prevent; behind a non-logging, non-rejecting fetch boundary, the required composition precondition, nothing is logged", async () => {
    const SENTINEL = "sentinel-s67-link-transport-detail";
    let lastRejection: Promise<unknown> = Promise.resolve();
    const rejecting = (when: "in time" | "after the deadline") =>
      vi.fn((): Promise<Response> => {
        const rejection = new Promise<Response>((_resolve, reject) => {
          const fail = () => reject(new TypeError(`fetch failed: ${SENTINEL}`));
          if (when === "in time") {
            fail();
          } else {
            setTimeout(fail, LATE);
          }
        });
        lastRejection = rejection.catch(() => undefined);
        return rejection;
      });
    // The precondition's shape: every failure becomes one fixed answer, and
    // nothing is logged.
    const boundary =
      (underlying: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) =>
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        try {
          return await underlying(input, init);
        } catch {
          return new Response(null, { status: 503 });
        }
      };
    const exchangeThrough = async (adminFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) => {
      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: adminFetch as unknown as typeof fetch },
      });
      const server = fakeAuthServer();
      const { bridge, signal } = bridgeWith(server, { linkAdmin: adminClient.auth.admin });
      const result = await bridge.exchangeExplorerLink({ email: EXPLORER_EMAIL, boundProviderUserId: BOUND_ID });
      return { result, server, signal };
    };

    const logged = vi.mocked(console.error);
    logged.mockImplementation(() => undefined);
    for (const when of ["in time", "after the deadline"] as const) {
      // Without the boundary. The bridge prevents a session, a value in its
      // result and a signal; it cannot prevent the library's own logging of
      // the rejected fetch's error, which happens before it sees anything
      // (or, after the deadline, after it has answered).
      const bareFetch = rejecting(when);
      const bare = await exchangeThrough(bareFetch);
      expect(bare.result, when).toEqual({ outcome: "failed" });
      expect(textOf(bare.result), when).not.toContain(SENTINEL);
      expect(bare.server.requests, when).toEqual([]);
      expect(bare.signal, when).not.toHaveBeenCalled();
      expect(bareFetch, when).toHaveBeenCalledTimes(1);
      await lastRejection;
      await eventually(() => logged.mock.calls.length > 0, `the library's own logging, ${when}`);
      expect(logged.mock.calls, when).toHaveLength(1);
      expect(textOf(logged.mock.calls[0][0]), when).toContain(SENTINEL);
      logged.mockClear();

      // With the boundary, which is what makes the seam safe: the same
      // rejection, and nothing is logged, in time or late.
      const guardedFetch = rejecting(when);
      const guarded = await exchangeThrough(boundary(guardedFetch));
      expect(guarded.result, when).toEqual({ outcome: "failed" });
      expect(guarded.server.requests, when).toEqual([]);
      expect(guarded.signal, when).not.toHaveBeenCalled();
      expect(guardedFetch, when).toHaveBeenCalledTimes(1);
      await lastRejection;
      await delay(50);
      expect(logged, when).not.toHaveBeenCalled();
    }
  }, 15_000);
});

describe("loginIdentityBridge - module boundary (dormant, server-only, off every barrel)", () => {
  type ModuleReference = Readonly<{ form: string; specifier: string | null }>;

  const BRIDGE_PATH = "../loginIdentityBridge.ts";

  function moduleText(relativePath: string): string {
    return fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
  }

  // Every module reference in a file, found with TypeScript's own parser, as
  // the login step 5 and S6-2 boundary tests do.
  function moduleReferences(fileName: string, text: string): ModuleReference[] {
    const kind = /\.[jt]sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
    const references: ModuleReference[] = [];
    const literal = (node: ts.Node | undefined): string | null =>
      node !== undefined && ts.isStringLiteralLike(node) ? node.text : null;
    function visit(node: ts.Node): void {
      if (ts.isImportDeclaration(node)) {
        references.push({ form: "import", specifier: literal(node.moduleSpecifier) });
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
        references.push({ form: "export-from", specifier: literal(node.moduleSpecifier) });
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        references.push({ form: "import-equals", specifier: literal(node.moduleReference.expression) });
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        references.push({
          form: "dynamic-import",
          specifier: node.arguments.length === 1 ? literal(node.arguments[0]) : null,
        });
      } else if (ts.isImportTypeNode(node)) {
        const argument = node.argument;
        references.push({
          form: "import-type",
          specifier:
            ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)
              ? argument.literal.text
              : null,
        });
      } else if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require"
      ) {
        references.push({
          form: "require",
          specifier: node.arguments.length === 1 ? literal(node.arguments[0]) : null,
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return references;
  }

  // The app's source root, or, when this file runs from a proposal folder
  // that holds only new files, the live app's.
  function sourceRoot(): string {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(testDirectory, "..", "..", "..", "..");
    const proposalRoot = path.resolve(root, "..", "..");
    if (
      !fs.existsSync(path.join(root, "lib", "solmind", "auth", "index.ts")) &&
      path.basename(proposalRoot).includes("_proposed_")
    ) {
      return path.resolve(proposalRoot, "..", "solmind-app", "src");
    }
    return root;
  }

  function sourceFiles(directory: string): string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        found.push(...sourceFiles(entryPath));
      } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
        found.push(entryPath);
      }
    }
    return found;
  }

  // A relative or `@/` specifier as a lowercased path without its extension;
  // a package specifier gives null.
  function resolveReference(fromFile: string, specifier: string, root: string): string | null {
    let target: string;
    if (specifier.startsWith("@/")) {
      target = path.join(root, specifier.slice(2));
    } else if (specifier.startsWith(".")) {
      target = path.resolve(path.dirname(fromFile), specifier);
    } else {
      return null;
    }
    return target.replace(/\.(?:[cm]?[jt]sx?)$/, "").toLowerCase();
  }

  it("LBB-001 starts with the server-only import, imports only @supabase/ssr besides it, and refuses to load where a browser window exists", async () => {
    const text = moduleText(BRIDGE_PATH);
    expect(text.startsWith('import "server-only";')).toBe(true);
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(
      moduleReferences("loginIdentityBridge.ts", text).map((reference) => `${reference.form} ${reference.specifier}`),
    ).toEqual(["import server-only", "import @supabase/ssr"]);

    vi.resetModules();
    vi.stubGlobal("window", {});
    try {
      await expect(import("../loginIdentityBridge")).rejects.toThrow(
        "SolMind server configuration error: the login identity bridge must not be imported in browser code.",
      );
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it("LBB-002 its own code reads no environment, logs nothing and makes no direct session read, refresh or set call, has one sign-out call with scope `local`, names no other dormant module, and exports only its three runtime names", () => {
    const text = moduleText(BRIDGE_PATH);
    expect(text).not.toMatch(
      /process\.env|console\.|\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|cookies\s*\(|["']use server["']|Math\.random|randomUUID|import\.meta|next\/|NEXT_PUBLIC_|service_role|SERVICE_ROLE|\.rpc\s*\(/,
    );
    expect(text).not.toMatch(
      /getUser|getSession|refreshSession|setSession|exchangeCodeForSession|signInWithOtp|signUp|updateUser|resetPasswordForEmail|reauthenticate/,
    );
    // The only sign-out is one transient session's, with scope `local`.
    expect(text.match(/\.signOut\s*\(/g)).toEqual([".signOut("]);
    expect(text).toContain('client.auth.admin.signOut(accessToken, "local")');
    expect(text).not.toMatch(/["'](?:global|others)["']/);
    // The link is asked for only as `magiclink`, and exchanged only as `email`.
    expect(text.match(/"magiclink"/g)?.length).toBeGreaterThan(0);
    expect(text).toContain('verifyOtp({ token_hash: link.tokenHash, type: "email" })');
    // No other dormant module is named, so no slice's dormancy test trips.
    for (const name of [
      "verificationCode",
      "verificationChallengeCallersCore",
      "verificationChallengeCallers",
      "verificationChallengeComposition",
      "verificationCodeDelivery",
      "localSmtpVerificationCodeDelivery",
      "verificationCodeEmailWording",
      "sessionCookiePolicy",
      "loginCookieWriter",
    ]) {
      expect(new RegExp(`\\b${name}\\b`).test(text), name).toBe(false);
    }
    expect(Object.keys(bridgeModule).sort()).toEqual(
      ["LOGIN_IDENTITY_BRIDGE_LIMITS", "LoginIdentityBridgeConfigurationError", "createLoginIdentityBridge"].sort(),
    );
  });

  it("LBB-003 is not exported from any barrel", () => {
    for (const exportedName of Object.keys(bridgeModule)) {
      expect(exportedName in authBarrel, exportedName).toBe(false);
      expect(exportedName in supabaseBarrel, exportedName).toBe(false);
      expect(exportedName in contextBarrel, exportedName).toBe(false);
    }
    const root = sourceRoot();
    const barrels = sourceFiles(root).filter((file) => /^index\.(?:[cm]?[jt]sx?)$/.test(path.basename(file)));
    expect(barrels).toContain(path.join(root, "lib", "solmind", "supabase", "index.ts"));
    for (const barrel of barrels) {
      expect(fs.readFileSync(barrel, "utf8"), barrel).not.toContain("loginIdentityBridge");
    }
  });

  it("LBB-004 is dormant: no other application file references or names the bridge", () => {
    // Computed references and `import.meta` in any non-test file are already
    // refused by the login step 5 boundary test (VCB-004), so the literal
    // references found here are all the references there are. The first route
    // slice that imports the bridge (S6-8) must amend this test in its own
    // slice.
    const root = sourceRoot();
    const bridgePath = path.join(root, "lib", "solmind", "supabase", "loginIdentityBridge").toLowerCase();
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      if (/\.test\.[cm]?[jt]sx?$/.test(file)) {
        continue;
      }
      if (file.replace(/\.(?:[cm]?[jt]sx?)$/, "").toLowerCase() === bridgePath) {
        continue;
      }
      const text = fs.readFileSync(file, "utf8");
      for (const reference of moduleReferences(file, text)) {
        if (reference.specifier === null) {
          continue;
        }
        if (resolveReference(file, reference.specifier, root) === bridgePath) {
          offenders.push(`${path.relative(root, file)}: ${reference.form} ${reference.specifier}`);
        }
      }
      if (/\bloginIdentityBridge\b/.test(text)) {
        offenders.push(`${path.relative(root, file)}: mentions loginIdentityBridge`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
