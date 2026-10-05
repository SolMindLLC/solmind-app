// Login step 6, sub-slice S6-2: the login-step cookie writer (contract 25
// Section 6; Section 15 items 1, 3, 4, 5 and 11), and the module boundary of
// the writer and the session-cookie policy. The installed Supabase SSR
// library's chunker is used only to build realistic held cookies, and a real
// Next.js response shows the Set-Cookie headers the writer produces.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import { createChunks, stringToBase64URL } from "@supabase/ssr";
import { NextResponse } from "next/server";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authBarrel from "../../auth/index";
import * as policyModule from "../../auth/sessionCookiePolicy";
import {
  SESSION_COOKIE_NO_STORE_HEADERS,
  resolveSessionCookiePolicy,
  type SessionCookieAttributes,
  type SessionCookiePolicy,
} from "../../auth/sessionCookiePolicy";
import * as contextBarrel from "../../context/index";
import * as supabaseBarrel from "../index";
import * as writerModule from "../loginCookieWriter";
import {
  writeLoginSessionCookies,
  writeLogoutSessionCookieClears,
  type HeldSessionCookie,
  type LoginSessionCookieWrite,
  type LogoutSessionCookieClear,
  type SessionCookieResponse,
} from "../loginCookieWriter";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const HOSTED_ORIGIN = "https://uat.solmind.example";
const LOOPBACK_ORIGIN = "http://127.0.0.1:3000";
const SESSION_ID = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
const OLD_SESSION_ID = "0b9d8c7e-6f5a-4b3c-8d2e-1f0a9b8c7d6e";
const MAX_AGE = 3540;
const LIBRARY_MAX_AGE = 400 * 24 * 60 * 60;

function policyFor(origin: string): SessionCookiePolicy {
  const resolved = resolveSessionCookiePolicy(origin);
  if (resolved === null) {
    throw new Error("test setup: the policy did not resolve");
  }
  return resolved;
}

const HOSTED = policyFor(HOSTED_ORIGIN);
const LOOPBACK = policyFor(LOOPBACK_ORIGIN);

// A synthetic session in the library's own encoding.
function encodedSession(marker: string, size: number): string {
  return `base64-${stringToBase64URL(
    JSON.stringify({ access_token: `${marker}-${"a".repeat(size)}`, refresh_token: `${marker}-r` }),
  )}`;
}

const SESSION_VALUE = encodedSession("synthetic-new", 40);
const LONG_SESSION_VALUE = encodedSession("synthetic-new-long", 4000);
const OLD_SESSION_VALUE = encodedSession("synthetic-old", 40);

// The held cookies as the library hands them to its cookie setter, with its
// own options (which the writer must ignore).
function heldChunks(name: string, value: string, chunkSize?: number): HeldSessionCookie[] {
  return createChunks(name, value, chunkSize).map((chunk) => ({
    name: chunk.name,
    value: chunk.value,
    options: { path: "/", sameSite: "lax", httpOnly: false, maxAge: LIBRARY_MAX_AGE },
  }));
}

type RecordedCall =
  | Readonly<{ kind: "header"; name: string; value: string }>
  | Readonly<{ kind: "cookie"; name: string; value: string; attributes: SessionCookieAttributes }>;

function recordingResponse(options: { throwOnCookie?: number; throwOnHeader?: boolean } = {}) {
  const calls: RecordedCall[] = [];
  let cookieCount = 0;
  const response: SessionCookieResponse = {
    cookies: {
      set(name: string, value: string, attributes: SessionCookieAttributes) {
        cookieCount += 1;
        if (options.throwOnCookie === cookieCount) {
          throw new Error(`refused ${name}=${value}`);
        }
        calls.push({ kind: "cookie", name, value, attributes });
      },
    },
    headers: {
      set(name: string, value: string) {
        if (options.throwOnHeader === true) {
          throw new Error(`refused header ${name}`);
        }
        calls.push({ kind: "header", name, value });
      },
    },
  };
  return { response, calls };
}

function loginInput(
  overrides: Record<string, unknown> = {},
  response: SessionCookieResponse = recordingResponse().response,
): LoginSessionCookieWrite {
  return {
    trustedOrigin: HOSTED_ORIGIN,
    heldCookies: heldChunks(HOSTED.authCookieName, SESSION_VALUE),
    requestCookies: [],
    sessionId: SESSION_ID,
    maxAgeSeconds: MAX_AGE,
    response,
    ...overrides,
  } as LoginSessionCookieWrite;
}

function logoutInput(
  overrides: Record<string, unknown> = {},
  response: SessionCookieResponse = recordingResponse().response,
): LogoutSessionCookieClear {
  return {
    trustedOrigin: HOSTED_ORIGIN,
    heldCookies: [],
    requestCookies: [],
    response,
    ...overrides,
  } as LogoutSessionCookieClear;
}

function writeAttributes(policy: SessionCookiePolicy, maxAge: number = MAX_AGE) {
  return { httpOnly: true, sameSite: "lax", path: "/", secure: policy.secure, maxAge };
}

function removalAttributes(policy: SessionCookiePolicy) {
  return { httpOnly: true, sameSite: "lax", path: "/", secure: policy.secure, maxAge: 0 };
}

const NO_STORE_CALLS = SESSION_COOKIE_NO_STORE_HEADERS.map((header) => ({
  kind: "header",
  name: header.name,
  value: header.value,
}));

function cookieCall(name: string, value: string, attributes: object) {
  return { kind: "cookie", name, value, attributes };
}

function textOf(value: unknown): string {
  return [
    String(value),
    JSON.stringify(value),
    inspect(value, { showHidden: true, depth: 5 }),
    value instanceof Error ? `${value.name} ${value.message} ${value.stack ?? ""}` : "",
  ].join(" ");
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

describe("loginCookieWriter - a successful login (contract 25 Sections 4, 5.2 and 6; items 1 and 3)", () => {
  it("LCW-001 hosted: the no-store headers, then the auth cookie and the binding cookie with Secure, HttpOnly, SameSite=Lax, Path=/, the __Host- names and the session's Max-Age", () => {
    const { response, calls } = recordingResponse();
    expect(writeLoginSessionCookies(loginInput({}, response))).toEqual({ outcome: "written" });
    expect(calls).toEqual([
      ...NO_STORE_CALLS,
      cookieCall("__Host-solmind-auth", SESSION_VALUE, writeAttributes(HOSTED)),
      cookieCall("__Host-solmind-session", SESSION_ID, writeAttributes(HOSTED)),
    ]);
    // No Domain, no Expires, and never the library's 400 days.
    for (const call of calls) {
      if (call.kind === "cookie") {
        expect(Object.keys(call.attributes).sort()).toEqual([
          "httpOnly",
          "maxAge",
          "path",
          "sameSite",
          "secure",
        ]);
        expect(call.attributes.maxAge).not.toBe(LIBRARY_MAX_AGE);
      }
    }
  });

  it("LCW-002 loopback http: the same cookies with no Secure and no prefix, for each loopback host", () => {
    for (const origin of [LOOPBACK_ORIGIN, "http://[::1]:3000", "http://localhost:3000"]) {
      const { response, calls } = recordingResponse();
      const result = writeLoginSessionCookies(
        loginInput(
          { trustedOrigin: origin, heldCookies: heldChunks(LOOPBACK.authCookieName, SESSION_VALUE) },
          response,
        ),
      );
      expect(result, origin).toEqual({ outcome: "written" });
      expect(calls, origin).toEqual([
        ...NO_STORE_CALLS,
        cookieCall("solmind-auth", SESSION_VALUE, writeAttributes(LOOPBACK)),
        cookieCall("solmind-session", SESSION_ID, writeAttributes(LOOPBACK)),
      ]);
    }
  });

  it("LCW-003 any other http origin, or a trusted origin not in canonical form, writes nothing and denies", () => {
    for (const origin of [
      "http://192.168.1.10:3000",
      "http://solmind.example",
      "http://127.0.0.2:3000",
      "http://127.0.0.1:3000/",
      "https://uat.solmind.example/",
      "",
      "null",
      42,
      null,
    ]) {
      const { response, calls } = recordingResponse();
      expect(writeLoginSessionCookies(loginInput({ trustedOrigin: origin }, response)), String(origin)).toEqual({
        outcome: "denied",
        reason: "configuration",
      });
      expect(calls, String(origin)).toEqual([]);
    }
  });

  it("LCW-004 a chunked session is written as N.0 to N.k in order, each with the session's Max-Age, whatever order the library handed them in", () => {
    const chunks = heldChunks(HOSTED.authCookieName, LONG_SESSION_VALUE);
    expect(chunks.map((chunk) => chunk.name)).toEqual(["__Host-solmind-auth.0", "__Host-solmind-auth.1"]);
    for (const held of [chunks, chunks.slice().reverse()]) {
      const { response, calls } = recordingResponse();
      expect(writeLoginSessionCookies(loginInput({ heldCookies: held }, response))).toEqual({
        outcome: "written",
      });
      expect(calls).toEqual([
        ...NO_STORE_CALLS,
        cookieCall("__Host-solmind-auth.0", chunks[0].value, writeAttributes(HOSTED)),
        cookieCall("__Host-solmind-auth.1", chunks[1].value, writeAttributes(HOSTED)),
        cookieCall("__Host-solmind-session", SESSION_ID, writeAttributes(HOSTED)),
      ]);
    }
    // Many chunks, past N.9.
    const many = heldChunks(HOSTED.authCookieName, LONG_SESSION_VALUE, 100);
    expect(many.length).toBeGreaterThan(10);
    const { response, calls } = recordingResponse();
    expect(writeLoginSessionCookies(loginInput({ heldCookies: many }, response))).toEqual({
      outcome: "written",
    });
    const written = calls.filter((call) => call.kind === "cookie").map((call) => call.name);
    expect(written).toEqual([
      ...many.map((_, index) => `__Host-solmind-auth.${index}`),
      "__Host-solmind-session",
    ]);
  });

  it("LCW-005 Max-Age is the given remaining life: 1 and 3600 are written as given; 0, 3601 and the rest deny", () => {
    for (const maxAge of [1, 3600]) {
      const { response, calls } = recordingResponse();
      expect(writeLoginSessionCookies(loginInput({ maxAgeSeconds: maxAge }, response))).toEqual({
        outcome: "written",
      });
      for (const call of calls) {
        if (call.kind === "cookie") {
          expect(call.attributes.maxAge).toBe(maxAge);
        }
      }
    }
    for (const maxAge of [0, -1, 3601, 1.5, Number.NaN, Number.POSITIVE_INFINITY, LIBRARY_MAX_AGE, "3540"]) {
      const { response, calls } = recordingResponse();
      expect(
        writeLoginSessionCookies(loginInput({ maxAgeSeconds: maxAge }, response)),
        String(maxAge),
      ).toEqual({ outcome: "denied", reason: "request" });
      expect(calls).toEqual([]);
    }
  });
});

describe("loginCookieWriter - the writer's rules (contract 25 Section 6; item 4)", () => {
  const N = HOSTED.authCookieName;

  it("LCW-006 a name outside the allow-list fails the login, and nothing is written, not even the headers", () => {
    for (const foreign of [
      { name: `${N}-user`, value: "" },
      { name: "sb-127-auth-token", value: SESSION_VALUE },
      { name: LOOPBACK.authCookieName, value: SESSION_VALUE },
      { name: HOSTED.bindingCookieName, value: SESSION_ID },
      { name: HOSTED.bindingCookieName, value: "" },
      { name: `${N}.01`, value: "abc" },
      { name: `${N}.0x`, value: "" },
      { name: "theme", value: "" },
      { name: "__Host-solmind-remember-guide", value: "" },
    ]) {
      const { response, calls } = recordingResponse();
      const result = writeLoginSessionCookies(
        loginInput({ heldCookies: [...heldChunks(N, SESSION_VALUE), foreign] }, response),
      );
      expect(result, foreign.name).toEqual({ outcome: "denied", reason: "held_cookies" });
      expect(calls, foreign.name).toEqual([]);
    }
  });

  it("LCW-007 an empty value is a removal: Max-Age 0, Path=/, HttpOnly, SameSite=Lax and, when hosted, Secure; never the session's lifetime", () => {
    for (const policy of [HOSTED, LOOPBACK]) {
      const name = policy.authCookieName;
      const origin = policy === HOSTED ? HOSTED_ORIGIN : LOOPBACK_ORIGIN;
      const chunks = heldChunks(name, LONG_SESSION_VALUE);
      const held: HeldSessionCookie[] = [
        { name, value: "", options: { maxAge: 0 } },
        { name: `${name}.3`, value: "" },
        { name: policy.codeVerifierCookieName, value: "" },
        { name: `${policy.codeVerifierCookieName}.0`, value: "" },
        ...chunks,
      ];
      const { response, calls } = recordingResponse();
      expect(
        writeLoginSessionCookies(loginInput({ trustedOrigin: origin, heldCookies: held }, response)),
      ).toEqual({ outcome: "written" });
      expect(calls).toEqual([
        ...NO_STORE_CALLS,
        cookieCall(name, "", removalAttributes(policy)),
        cookieCall(`${name}.3`, "", removalAttributes(policy)),
        cookieCall(policy.codeVerifierCookieName, "", removalAttributes(policy)),
        cookieCall(`${policy.codeVerifierCookieName}.0`, "", removalAttributes(policy)),
        cookieCall(`${name}.0`, chunks[0].value, writeAttributes(policy)),
        cookieCall(`${name}.1`, chunks[1].value, writeAttributes(policy)),
        cookieCall(policy.bindingCookieName, SESSION_ID, writeAttributes(policy)),
      ]);
      for (const call of calls) {
        if (call.kind === "cookie") {
          expect(call.attributes.maxAge === 0, call.name).toBe(call.value === "");
          expect(call.attributes.secure, call.name).toBe(policy === HOSTED);
        }
      }
    }
  });

  it("LCW-008 a non-empty code verifier is never written: it fails the login", () => {
    for (const verifier of [
      { name: HOSTED.codeVerifierCookieName, value: "synthetic-verifier" },
      { name: `${HOSTED.codeVerifierCookieName}.0`, value: "synthetic-verifier" },
    ]) {
      const { response, calls } = recordingResponse();
      expect(
        writeLoginSessionCookies(
          loginInput({ heldCookies: [...heldChunks(N, SESSION_VALUE), verifier] }, response),
        ),
      ).toEqual({ outcome: "denied", reason: "held_cookies" });
      expect(calls).toEqual([]);
    }
  });

  it("LCW-009 the held writes must be one complete session value: a gap, N with chunks, a missing N.0, a repeated name or no write denies", () => {
    const chunk = (index: number, value = "base64-part") => ({ name: `${N}.${index}`, value });
    const cases: ReadonlyArray<readonly [string, ReadonlyArray<HeldSessionCookie>]> = [
      ["a gap", [chunk(0), chunk(2)]],
      ["a gap after N.1", [chunk(0), chunk(1), chunk(3)]],
      ["N with chunks", [{ name: N, value: SESSION_VALUE }, chunk(0)]],
      ["no N.0", [chunk(1)]],
      ["N twice", [{ name: N, value: SESSION_VALUE }, { name: N, value: SESSION_VALUE }]],
      ["a chunk twice", [chunk(0), chunk(0, "base64-other")]],
      ["a removal and a write of one name", [{ name: `${N}.0`, value: "" }, chunk(0)]],
      ["no write at all", []],
      ["removals only", [{ name: `${N}.3`, value: "" }]],
    ];
    for (const [label, held] of cases) {
      const { response, calls } = recordingResponse();
      expect(writeLoginSessionCookies(loginInput({ heldCookies: held }, response)), label).toEqual({
        outcome: "denied",
        reason: "held_cookies",
      });
      expect(calls, label).toEqual([]);
    }
  });

  it("LCW-010 malformed calls deny with nothing written, and no getter runs", () => {
    const requestCases: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ["an uppercase session id", { sessionId: SESSION_ID.toUpperCase() }],
      ["a session id with a final LF", { sessionId: `${SESSION_ID}\n` }],
      ["a session id that is not a UUID", { sessionId: "not-a-session" }],
      ["a session id without dashes", { sessionId: SESSION_ID.replace(/-/g, "") }],
      ["an empty session id", { sessionId: "" }],
      ["a number as the session id", { sessionId: 42 }],
      ["request cookies that are not a list", { requestCookies: `${N}=x` }],
      ["a request cookie without a value", { requestCookies: [{ name: N }] }],
      ["a request cookie with options", { requestCookies: [{ name: N, value: "x", options: {} }] }],
      ["no response", { response: null }],
      ["a response without a cookie store", { response: { headers: { set: () => undefined } } }],
      ["a response without headers", { response: { cookies: { set: () => undefined } } }],
      ["a cookie store without set", { response: { cookies: {}, headers: { set: () => undefined } } }],
      ["an extra key", { extra: true }],
    ];
    for (const [label, overrides] of requestCases) {
      const { response, calls } = recordingResponse();
      expect(writeLoginSessionCookies(loginInput({ response, ...overrides })), label).toEqual({
        outcome: "denied",
        reason: "request",
      });
      expect(calls, label).toEqual([]);
    }

    // A missing key, a non-plain input, and a getter on the input.
    const { response, calls } = recordingResponse();
    const missing = { ...loginInput({}, response) } as Record<string, unknown>;
    delete missing.maxAgeSeconds;
    const getter = vi.fn(() => SESSION_ID);
    const withGetter = Object.defineProperty(
      { ...loginInput({}, response) } as Record<string, unknown>,
      "sessionId",
      { get: getter, enumerable: true },
    );
    // Labels are by position: printing these inputs could run the getters.
    const inputs: ReadonlyArray<unknown> = [missing, null, [], new Map(), withGetter];
    inputs.forEach((input, position) => {
      expect(
        writeLoginSessionCookies(input as LoginSessionCookieWrite),
        `input ${position}`,
      ).toEqual({ outcome: "denied", reason: "request" });
    });
    expect(getter).not.toHaveBeenCalled();
    expect(calls).toEqual([]);

    // Held cookies that cannot be read deny as held cookies.
    const valueGetter = vi.fn(() => SESSION_VALUE);
    const heldInputs: ReadonlyArray<unknown> = [
      null,
      "x",
      [{ name: N }],
      [{ name: N, value: SESSION_VALUE, extra: 1 }],
      [Object.defineProperty({ name: N }, "value", { get: valueGetter, enumerable: true })],
    ];
    heldInputs.forEach((held, position) => {
      const recorded = recordingResponse();
      expect(
        writeLoginSessionCookies(loginInput({ heldCookies: held }, recorded.response)),
        `held ${position}`,
      ).toEqual({ outcome: "denied", reason: "held_cookies" });
      expect(recorded.calls).toEqual([]);
    });
    expect(valueGetter).not.toHaveBeenCalled();
  });
});

describe("loginCookieWriter - fixation (contract 25 Section 6; item 5)", () => {
  const N = HOSTED.authCookieName;
  const V = HOSTED.codeVerifierCookieName;

  it("LCW-011 every old auth chunk and code verifier in the request is cleared, the new value replaces them, and the binding cookie gets only the database's UUID", () => {
    const requestCookies = [
      { name: N, value: OLD_SESSION_VALUE },
      { name: `${N}.0`, value: "base64-old0" },
      { name: `${N}.1`, value: "old1" },
      { name: `${N}.2`, value: "old2" },
      { name: `${N}.3`, value: "old3" },
      { name: V, value: "old-verifier" },
      { name: `${V}.0`, value: "old-verifier-0" },
      { name: HOSTED.bindingCookieName, value: OLD_SESSION_ID },
      { name: "theme", value: "dark" },
      { name: LOOPBACK.authCookieName, value: OLD_SESSION_VALUE },
      { name: `${N}-user`, value: "old-user" },
    ];
    const held = heldChunks(N, LONG_SESSION_VALUE);
    const { response, calls } = recordingResponse();
    expect(writeLoginSessionCookies(loginInput({ heldCookies: held, requestCookies }, response))).toEqual({
      outcome: "written",
    });
    expect(calls).toEqual([
      ...NO_STORE_CALLS,
      cookieCall(N, "", removalAttributes(HOSTED)),
      cookieCall(`${N}.2`, "", removalAttributes(HOSTED)),
      cookieCall(`${N}.3`, "", removalAttributes(HOSTED)),
      cookieCall(V, "", removalAttributes(HOSTED)),
      cookieCall(`${V}.0`, "", removalAttributes(HOSTED)),
      cookieCall(`${N}.0`, held[0].value, writeAttributes(HOSTED)),
      cookieCall(`${N}.1`, held[1].value, writeAttributes(HOSTED)),
      cookieCall(HOSTED.bindingCookieName, SESSION_ID, writeAttributes(HOSTED)),
    ]);
    // Every written value comes from the held cookies or the database's UUID;
    // no request value is ever written.
    const allowed = new Set(["", SESSION_ID, ...held.map((cookie) => cookie.value)]);
    for (const call of calls) {
      if (call.kind === "cookie") {
        expect(allowed.has(call.value), call.name).toBe(true);
      }
    }
    expect(textOf(calls)).not.toContain(OLD_SESSION_ID);
    expect(textOf(calls)).not.toContain(OLD_SESSION_VALUE);
  });

  it("LCW-012 incoming auth and binding cookies never sign anyone in: with no held session, nothing is written", () => {
    const { response, calls } = recordingResponse();
    expect(
      writeLoginSessionCookies(
        loginInput(
          {
            heldCookies: [],
            requestCookies: [
              { name: N, value: OLD_SESSION_VALUE },
              { name: HOSTED.bindingCookieName, value: OLD_SESSION_ID },
            ],
          },
          response,
        ),
      ),
    ).toEqual({ outcome: "denied", reason: "held_cookies" });
    expect(calls).toEqual([]);
  });
});

describe("loginCookieWriter - logout clears (contract 25 Sections 6 and 9)", () => {
  const N = HOSTED.authCookieName;
  const V = HOSTED.codeVerifierCookieName;

  it("LCW-013 clears N, the code verifier and the binding cookie always, and every auth chunk and code verifier in the request or handed over, with the attributes repeated", () => {
    const { response, calls } = recordingResponse();
    const result = writeLogoutSessionCookieClears(
      logoutInput(
        {
          heldCookies: [
            { name: N, value: "", options: { maxAge: 0 } },
            { name: `${N}.0`, value: "" },
            { name: `${N}-user`, value: "" },
            { name: V, value: "" },
          ],
          requestCookies: [
            { name: N, value: OLD_SESSION_VALUE },
            { name: `${N}.0`, value: "x" },
            { name: `${N}.2`, value: "y" },
            { name: `${V}.0`, value: "z" },
            { name: HOSTED.bindingCookieName, value: OLD_SESSION_ID },
            { name: "theme", value: "dark" },
            { name: `${N}-user`, value: "u" },
          ],
        },
        response,
      ),
    );
    // The library's `-user` removal is outside the allow-list, so it is not written.
    expect(result).toEqual({ outcome: "cleared", ignoredInput: true });
    expect(calls).toEqual([
      ...NO_STORE_CALLS,
      cookieCall(N, "", removalAttributes(HOSTED)),
      cookieCall(V, "", removalAttributes(HOSTED)),
      cookieCall(HOSTED.bindingCookieName, "", removalAttributes(HOSTED)),
      cookieCall(`${N}.0`, "", removalAttributes(HOSTED)),
      cookieCall(`${N}.2`, "", removalAttributes(HOSTED)),
      cookieCall(`${V}.0`, "", removalAttributes(HOSTED)),
    ]);
  });

  it("LCW-014 a non-empty value at logout is never written; the clears still run", () => {
    const { response, calls } = recordingResponse();
    expect(
      writeLogoutSessionCookieClears(
        logoutInput(
          {
            heldCookies: [
              { name: N, value: SESSION_VALUE },
              { name: V, value: "synthetic-verifier" },
            ],
          },
          response,
        ),
      ),
    ).toEqual({ outcome: "cleared", ignoredInput: true });
    expect(calls).toEqual([
      ...NO_STORE_CALLS,
      cookieCall(N, "", removalAttributes(HOSTED)),
      cookieCall(V, "", removalAttributes(HOSTED)),
      cookieCall(HOSTED.bindingCookieName, "", removalAttributes(HOSTED)),
    ]);
    expect(textOf(calls)).not.toContain(SESSION_VALUE);
  });

  it("LCW-015 with no auth cookie, or unreadable lists, the fixed clears still run; loopback clears carry no Secure", () => {
    const fixed = (policy: SessionCookiePolicy) => [
      ...NO_STORE_CALLS,
      cookieCall(policy.authCookieName, "", removalAttributes(policy)),
      cookieCall(policy.codeVerifierCookieName, "", removalAttributes(policy)),
      cookieCall(policy.bindingCookieName, "", removalAttributes(policy)),
    ];
    const cases: ReadonlyArray<readonly [Record<string, unknown>, boolean]> = [
      [{}, false],
      [{ requestCookies: null }, true],
      [{ heldCookies: "x" }, true],
      [{ requestCookies: [{ name: N }] }, true],
    ];
    for (const [overrides, ignoredInput] of cases) {
      const { response, calls } = recordingResponse();
      expect(writeLogoutSessionCookieClears(logoutInput(overrides, response)), textOf(overrides)).toEqual({
        outcome: "cleared",
        ignoredInput,
      });
      expect(calls, textOf(overrides)).toEqual(fixed(HOSTED));
    }
    const { response, calls } = recordingResponse();
    expect(
      writeLogoutSessionCookieClears(
        logoutInput(
          {
            trustedOrigin: LOOPBACK_ORIGIN,
            requestCookies: [{ name: `${LOOPBACK.authCookieName}.1`, value: "x" }],
          },
          response,
        ),
      ),
    ).toEqual({ outcome: "cleared", ignoredInput: false });
    expect(calls).toEqual([
      ...fixed(LOOPBACK),
      cookieCall(`${LOOPBACK.authCookieName}.1`, "", removalAttributes(LOOPBACK)),
    ]);
  });

  it("LCW-016 only a configuration failure or a malformed call stops the clears", () => {
    for (const origin of ["http://192.168.1.10:3000", "", null]) {
      const { response, calls } = recordingResponse();
      expect(
        writeLogoutSessionCookieClears(logoutInput({ trustedOrigin: origin }, response)),
      ).toEqual({ outcome: "denied", reason: "configuration" });
      expect(calls).toEqual([]);
    }
    for (const input of [
      null,
      logoutInput({ response: null }),
      logoutInput({ extra: true }),
      logoutInput({ sessionId: SESSION_ID }),
    ]) {
      expect(writeLogoutSessionCookieClears(input as LogoutSessionCookieClear), textOf(input)).toEqual({
        outcome: "denied",
        reason: "request",
      });
    }
  });
});

describe("loginCookieWriter - the response and value-free results (item 11)", () => {
  it("LCW-017 a response that throws gives `failed`, carries no value, and logs nothing", () => {
    const secretChunks = heldChunks(HOSTED.authCookieName, LONG_SESSION_VALUE);
    for (const options of [{ throwOnCookie: 1 }, { throwOnCookie: 2 }, { throwOnHeader: true }]) {
      const login = recordingResponse(options);
      const loginResult = writeLoginSessionCookies(
        loginInput({ heldCookies: secretChunks }, login.response),
      );
      expect(loginResult).toEqual({ outcome: "failed" });
      const logout = recordingResponse(options);
      const logoutResult = writeLogoutSessionCookieClears(
        logoutInput({ requestCookies: [{ name: HOSTED.authCookieName, value: OLD_SESSION_VALUE }] }, logout.response),
      );
      expect(logoutResult).toEqual({ outcome: "failed" });
      for (const result of [loginResult, logoutResult]) {
        const text = textOf(result);
        for (const secret of [SESSION_ID, OLD_SESSION_VALUE, ...secretChunks.map((chunk) => chunk.value)]) {
          expect(text).not.toContain(secret);
        }
      }
    }
  });

  it("LCW-018 every result is frozen, shared, closed and value-free", () => {
    const results = [
      writeLoginSessionCookies(loginInput()),
      writeLoginSessionCookies(loginInput()),
      writeLoginSessionCookies(loginInput({ trustedOrigin: "http://solmind.example" })),
      writeLoginSessionCookies(loginInput({ heldCookies: [] })),
      writeLoginSessionCookies(loginInput({ sessionId: "x" })),
      writeLogoutSessionCookieClears(logoutInput()),
      writeLogoutSessionCookieClears(logoutInput({ heldCookies: null })),
    ];
    expect(results[0]).toBe(results[1]);
    for (const result of results) {
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.keys(result).every((key) => ["outcome", "reason", "ignoredInput"].includes(key))).toBe(true);
      const text = textOf(result);
      expect(text).not.toContain(SESSION_ID);
      expect(text).not.toContain(SESSION_VALUE);
    }
  });

  it("LCW-019 through a real Next.js response: the Set-Cookie headers carry exactly the contract's attributes, removals included, and the no-store headers", () => {
    const N = HOSTED.authCookieName;
    const hosted = new NextResponse(null, { status: 204 });
    // The response itself is passed, as a route's composition root would:
    // its `cookies` and `headers` are getters.
    expect(
      writeLoginSessionCookies(
        loginInput(
          {
            requestCookies: [
              { name: `${N}.1`, value: "old1" },
              { name: HOSTED.codeVerifierCookieName, value: "old-verifier" },
            ],
          },
          hosted as unknown as SessionCookieResponse,
        ),
      ),
    ).toEqual({ outcome: "written" });
    const hostedCookies = hosted.headers.getSetCookie();
    expect(hostedCookies).toHaveLength(4);
    expect(hostedCookies[0]).toBe(`${N}.1=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax`);
    expect(hostedCookies[1]).toBe(
      `${HOSTED.codeVerifierCookieName}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax`,
    );
    expect(hostedCookies[2]).toMatch(
      new RegExp(`^${N}=${SESSION_VALUE}; Path=/; Expires=[^;]+; Max-Age=${MAX_AGE}; Secure; HttpOnly; SameSite=lax$`),
    );
    expect(hostedCookies[3]).toMatch(
      new RegExp(
        `^${HOSTED.bindingCookieName}=${SESSION_ID}; Path=/; Expires=[^;]+; Max-Age=${MAX_AGE}; Secure; HttpOnly; SameSite=lax$`,
      ),
    );
    for (const header of hostedCookies) {
      expect(header).not.toMatch(/Domain=/i);
    }
    expect(hosted.headers.get("cache-control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
    expect(hosted.headers.get("expires")).toBe("0");
    expect(hosted.headers.get("pragma")).toBe("no-cache");

    // Loopback, through an adapter: no Secure, no prefix.
    const loopback = new NextResponse(null, { status: 204 });
    const adapter: SessionCookieResponse = {
      cookies: { set: (name, value, attributes) => loopback.cookies.set(name, value, attributes) },
      headers: loopback.headers,
    };
    expect(
      writeLoginSessionCookies(
        loginInput(
          {
            trustedOrigin: LOOPBACK_ORIGIN,
            heldCookies: heldChunks(LOOPBACK.authCookieName, SESSION_VALUE),
          },
          adapter,
        ),
      ),
    ).toEqual({ outcome: "written" });
    const loopbackCookies = loopback.headers.getSetCookie();
    expect(loopbackCookies).toHaveLength(2);
    expect(loopbackCookies[0]).toMatch(
      new RegExp(`^solmind-auth=${SESSION_VALUE}; Path=/; Expires=[^;]+; Max-Age=${MAX_AGE}; HttpOnly; SameSite=lax$`),
    );
    expect(loopbackCookies[1]).toMatch(
      new RegExp(`^solmind-session=${SESSION_ID}; Path=/; Expires=[^;]+; Max-Age=${MAX_AGE}; HttpOnly; SameSite=lax$`),
    );

    // Logout through a real response: every clear keeps Secure when hosted.
    const logout = new NextResponse(null, { status: 204 });
    expect(
      writeLogoutSessionCookieClears(logoutInput({}, logout as unknown as SessionCookieResponse)),
    ).toEqual({ outcome: "cleared", ignoredInput: false });
    expect(logout.headers.getSetCookie()).toEqual([
      `${N}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax`,
      `${HOSTED.codeVerifierCookieName}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax`,
      `${HOSTED.bindingCookieName}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax`,
    ]);
    expect(logout.headers.get("cache-control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
  });
});

describe("sessionCookiePolicy and loginCookieWriter - module boundary (dormant, off every barrel)", () => {
  type ModuleReference = Readonly<{ form: string; specifier: string | null }>;

  function moduleText(relativePath: string): string {
    return fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
  }

  const POLICY_PATH = "../../auth/sessionCookiePolicy.ts";
  const WRITER_PATH = "../loginCookieWriter.ts";

  // Every module reference in a file, found with TypeScript's own parser, as
  // the login step 5 boundary test does.
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

  it("LCB-001 the policy is pure with no import; the writer starts with the server-only import and imports only the policy", () => {
    const policyText = moduleText(POLICY_PATH);
    const writerText = moduleText(WRITER_PATH);
    expect(moduleReferences("sessionCookiePolicy.ts", policyText)).toEqual([]);
    expect(policyText).not.toContain("server-only");
    expect(
      moduleReferences("loginCookieWriter.ts", writerText).map(
        (reference) => `${reference.form} ${reference.specifier}`,
      ),
    ).toEqual(["import server-only", "import ../auth/sessionCookiePolicy"]);
    expect(writerText.startsWith('import "server-only";')).toBe(true);
    for (const text of [policyText, writerText]) {
      expect(text.charCodeAt(0)).not.toBe(0xfeff);
    }
  });

  it("LCB-002 neither module reads the environment, logs, fetches, uses browser storage, deletes a cookie or seeds a value", () => {
    for (const modulePath of [POLICY_PATH, WRITER_PATH]) {
      expect(moduleText(modulePath), modulePath).not.toMatch(
        /process\.env|console\.|\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|\.delete\s*\(|cookies\s*\(|["']use server["']|Math\.random|randomUUID|import\.meta/,
      );
    }
    // Only these runtime exports.
    expect(Object.keys(writerModule).sort()).toEqual(
      ["writeLoginSessionCookies", "writeLogoutSessionCookieClears"].sort(),
    );
    expect(Object.keys(policyModule).sort()).toEqual(
      [
        "SESSION_AUTH_COOKIE_BASE_NAME",
        "SESSION_AUTH_COOKIE_VALUE_PREFIX",
        "SESSION_BINDING_COOKIE_BASE_NAME",
        "SESSION_CODE_VERIFIER_NAME_SUFFIX",
        "SESSION_COOKIE_MAX_AGE_LIMITS",
        "SESSION_COOKIE_NO_STORE_HEADERS",
        "SESSION_HOSTED_COOKIE_NAME_PREFIX",
        "isSessionAuthCookieName",
        "isSessionCodeVerifierCookieName",
        "isSessionCookieMaxAge",
        "isSessionCookiePolicy",
        "readSessionAuthCookies",
        "readSessionCookieEntries",
        "resolveSessionCookiePolicy",
        "sessionCookieRemovalAttributes",
        "sessionCookieWriteAttributes",
      ].sort(),
    );
  });

  it("LCB-003 is not exported from any barrel", () => {
    for (const exportedName of [...Object.keys(writerModule), ...Object.keys(policyModule)]) {
      expect(exportedName in authBarrel, exportedName).toBe(false);
      expect(exportedName in supabaseBarrel, exportedName).toBe(false);
      expect(exportedName in contextBarrel, exportedName).toBe(false);
    }
    const root = sourceRoot();
    const barrels = sourceFiles(root).filter((file) => /^index\.(?:[cm]?[jt]sx?)$/.test(path.basename(file)));
    expect(barrels).toContain(path.join(root, "lib", "solmind", "auth", "index.ts"));
    for (const barrel of barrels) {
      const text = fs.readFileSync(barrel, "utf8");
      expect(text, barrel).not.toContain("sessionCookiePolicy");
      expect(text, barrel).not.toContain("loginCookieWriter");
    }
  });

  it("LCB-004 is dormant: no other application file references or names either module", () => {
    // Computed references and `import.meta` in any non-test file are already
    // refused by the login step 5 boundary test (VCB-004), so the literal
    // references found here are all the references there are. The first
    // reader (S6-4 or S6-12) or route (S6-8) must amend this test in its own
    // slice.
    const root = sourceRoot();
    const policyPath = path.join(root, "lib", "solmind", "auth", "sessionCookiePolicy").toLowerCase();
    const writerPath = path.join(root, "lib", "solmind", "supabase", "loginCookieWriter").toLowerCase();
    const guarded = new Set([policyPath, writerPath]);
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      if (/\.test\.[cm]?[jt]sx?$/.test(file)) {
        continue;
      }
      const withoutExtension = file.replace(/\.(?:[cm]?[jt]sx?)$/, "").toLowerCase();
      if (guarded.has(withoutExtension)) {
        continue;
      }
      const text = fs.readFileSync(file, "utf8");
      for (const reference of moduleReferences(file, text)) {
        if (reference.specifier === null) {
          continue;
        }
        const resolved = resolveReference(file, reference.specifier, root);
        if (resolved !== null && guarded.has(resolved)) {
          offenders.push(`${path.relative(root, file)}: ${reference.form} ${reference.specifier}`);
        }
      }
      for (const name of ["sessionCookiePolicy", "loginCookieWriter"]) {
        if (new RegExp(`\\b${name}\\b`).test(text)) {
          offenders.push(`${path.relative(root, file)}: mentions ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
