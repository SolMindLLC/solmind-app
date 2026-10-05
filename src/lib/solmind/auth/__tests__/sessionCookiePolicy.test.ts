// Login step 6, sub-slice S6-2: the session-cookie policy and the shared
// format check (contract 25 Sections 4, 5.2, 6 and 14; Section 15 items 1, 4
// and 11). The installed Supabase SSR library's own chunker, joiner and
// base64url decoder are used here as test oracles only, so the names and the
// join match the real library.

import { inspect } from "node:util";

import {
  combineChunks,
  createChunks,
  isChunkLike,
  stringFromBase64URL,
  stringToBase64URL,
} from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_AUTH_COOKIE_VALUE_PREFIX,
  SESSION_COOKIE_MAX_AGE_LIMITS,
  SESSION_COOKIE_NO_STORE_HEADERS,
  isSessionAuthCookieName,
  isSessionCodeVerifierCookieName,
  isSessionCookieMaxAge,
  isSessionCookiePolicy,
  readSessionAuthCookies,
  readSessionCookieEntries,
  resolveSessionCookiePolicy,
  sessionCookieRemovalAttributes,
  sessionCookieWriteAttributes,
  type SessionCookieEntry,
  type SessionCookiePolicy,
} from "../sessionCookiePolicy";
import { loadTrustedApplicationOrigin } from "../trustedApplicationOrigin";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function policyFor(origin: string): SessionCookiePolicy {
  const resolved = resolveSessionCookiePolicy(origin);
  if (resolved === null) {
    throw new Error("test setup: the policy did not resolve");
  }
  return resolved;
}

const HOSTED = policyFor("https://uat.solmind.example");
const LOOPBACK = policyFor("http://127.0.0.1:3000");

// A synthetic session in the library's own encoding (`base64-` plus the
// base64url form of the stored JSON).
function encodedSession(marker: string, size: number): string {
  return `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${stringToBase64URL(
    JSON.stringify({ access_token: `${marker}-${"a".repeat(size)}`, refresh_token: `${marker}-r` }),
  )}`;
}

const SHORT_VALUE = encodedSession("synthetic-short", 10);

// Every character outside Section 14's set: the rest of ASCII, and a few
// others, among them line and paragraph separators, a BOM and surrogates.
const REFUSED_CHARACTERS: ReadonlyArray<string> = (() => {
  const refused: string[] = [];
  for (let code = 0; code < 128; code += 1) {
    const character = String.fromCharCode(code);
    if (!BASE64URL_ALPHABET.includes(character)) {
      refused.push(character);
    }
  }
  refused.push("\u00e9", "\u2028", "\u2029", "\ufeff", "\ud800", "\ud83d\ude00");
  return Object.freeze(refused);
})();

// The library's join, as its server storage reads a request: the first
// cookie of a name counts, and an empty value counts as missing.
async function libraryJoin(
  baseName: string,
  cookies: ReadonlyArray<SessionCookieEntry>,
): Promise<string | null> {
  return combineChunks(baseName, (name) => {
    const match = cookies.find((cookie) => cookie.name === name);
    return match === undefined ? null : match.value;
  });
}

function textOf(value: unknown): string {
  return `${String(value)} ${JSON.stringify(value)} ${inspect(value, { showHidden: true, depth: 5 })}`;
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

describe("sessionCookiePolicy - the attribute set from the trusted origin (contract 25 Section 4)", () => {
  it("SCP-001 an https trusted origin selects the hosted policy: Secure and the __Host- names", () => {
    for (const origin of [
      "https://uat.solmind.example",
      "https://solmind.example",
      "https://solmind.example:8443",
      "https://127.0.0.1:8443",
      "https://localhost",
    ]) {
      expect(resolveSessionCookiePolicy(origin), origin).toBe(HOSTED);
    }
    expect(HOSTED).toEqual({
      environment: "hosted",
      secure: true,
      authCookieName: "__Host-solmind-auth",
      bindingCookieName: "__Host-solmind-session",
      codeVerifierCookieName: "__Host-solmind-auth-code-verifier",
    });
    expect(Object.isFrozen(HOSTED)).toBe(true);
    expect(isSessionCookiePolicy(HOSTED)).toBe(true);
  });

  it("SCP-002 plain http on a loopback host selects the loopback policy: no Secure and no prefix", () => {
    for (const origin of [
      "http://127.0.0.1:3000",
      "http://127.0.0.1",
      "http://[::1]:3000",
      "http://localhost:3000",
      "http://localhost",
    ]) {
      expect(resolveSessionCookiePolicy(origin), origin).toBe(LOOPBACK);
    }
    expect(LOOPBACK).toEqual({
      environment: "loopback",
      secure: false,
      authCookieName: "solmind-auth",
      bindingCookieName: "solmind-session",
      codeVerifierCookieName: "solmind-auth-code-verifier",
    });
    expect(Object.isFrozen(LOOPBACK)).toBe(true);
    expect(isSessionCookiePolicy(LOOPBACK)).toBe(true);
  });

  it("SCP-003 every other http origin, and any value not in canonical origin form, is a configuration failure", () => {
    for (const value of [
      "http://192.168.1.10:3000",
      "http://10.0.0.5:3000",
      "http://0.0.0.0:3000",
      "http://127.0.0.2:3000",
      "http://solmind.example",
      "http://uat.solmind.app",
      "http://localhost.:3000",
      // Not in canonical form; the banked loader would return the canonical one.
      "http://127.1:3000",
      "http://LOCALHOST:3000",
      "http://[0:0:0:0:0:0:0:1]:3000",
      "http://127.0.0.1:3000/",
      "https://solmind.example/",
      "https://solmind.example:443",
      "https://user:secret@solmind.example",
      " http://127.0.0.1:3000",
      "http://127.0.0.1:3000\n",
      "ftp://solmind.example",
      "file:///tmp",
      "null",
      "",
      undefined,
      null,
      3000,
      {},
    ]) {
      expect(resolveSessionCookiePolicy(value), String(value)).toBeNull();
    }
  });

  it("SCP-004 composes with the banked trusted-origin loader, and adds the loopback-only rule it does not have", () => {
    expect(
      resolveSessionCookiePolicy(
        loadTrustedApplicationOrigin({ SOLMIND_TRUSTED_APP_ORIGIN: "http://127.0.0.1:3000/" }),
      ),
    ).toBe(LOOPBACK);
    expect(
      resolveSessionCookiePolicy(
        loadTrustedApplicationOrigin({ SOLMIND_TRUSTED_APP_ORIGIN: "https://UAT.Solmind.example:443/" }),
      ),
    ).toBe(HOSTED);
    // The loader accepts any http origin; the policy refuses one off loopback.
    const lanOrigin = loadTrustedApplicationOrigin({
      SOLMIND_TRUSTED_APP_ORIGIN: "http://192.168.1.10:3000",
    });
    expect(lanOrigin).toBe("http://192.168.1.10:3000");
    expect(resolveSessionCookiePolicy(lanOrigin)).toBeNull();
  });
});

describe("sessionCookiePolicy - attributes and headers (contract 25 Sections 5.2, 6 and 7; item 1)", () => {
  it("SCP-005 a session write gets HttpOnly, SameSite=Lax, Path=/, no Domain, Secure only when hosted, and the session's remaining life as Max-Age", () => {
    const cases = [
      [HOSTED, true],
      [LOOPBACK, false],
    ] as const;
    for (const [policy, secure] of cases) {
      for (const maxAge of [1, 59, 3540, 3600]) {
        const attributes = sessionCookieWriteAttributes(policy, maxAge);
        expect(attributes).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure, maxAge });
        expect(Object.keys(attributes ?? {}).sort()).toEqual([
          "httpOnly",
          "maxAge",
          "path",
          "sameSite",
          "secure",
        ]);
        expect(Object.isFrozen(attributes)).toBe(true);
      }
      // Never zero, negative, fractional, over the 3600-second session cap,
      // or the library's 400 days.
      for (const maxAge of [
        0,
        -1,
        3601,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        400 * 24 * 60 * 60,
      ]) {
        expect(sessionCookieWriteAttributes(policy, maxAge), String(maxAge)).toBeNull();
      }
      expect(sessionCookieWriteAttributes(policy, "3540" as unknown as number)).toBeNull();
    }
    expect(SESSION_COOKIE_MAX_AGE_LIMITS).toEqual({ minimum: 1, maximum: 3600 });
    expect(isSessionCookieMaxAge(1)).toBe(true);
    expect(isSessionCookieMaxAge(3600)).toBe(true);
    expect(isSessionCookieMaxAge(3601)).toBe(false);
    expect(isSessionCookieMaxAge(0)).toBe(false);
  });

  it("SCP-006 a removal gets an empty-value lifetime of Max-Age 0 with the same attributes, Secure included when hosted", () => {
    expect(sessionCookieRemovalAttributes(HOSTED)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 0,
    });
    expect(sessionCookieRemovalAttributes(LOOPBACK)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 0,
    });
    expect(Object.isFrozen(sessionCookieRemovalAttributes(HOSTED))).toBe(true);
    expect(sessionCookieRemovalAttributes(HOSTED)).toBe(sessionCookieRemovalAttributes(HOSTED));
  });

  it("SCP-007 a look-alike policy object is refused everywhere, so it cannot choose names or drop Secure", () => {
    const lookAlike = { ...HOSTED, secure: false } as SessionCookiePolicy;
    const copy = { ...LOOPBACK } as SessionCookiePolicy;
    for (const candidate of [lookAlike, copy]) {
      expect(isSessionCookiePolicy(candidate)).toBe(false);
      expect(sessionCookieWriteAttributes(candidate, 60)).toBeNull();
      expect(sessionCookieRemovalAttributes(candidate)).toBeNull();
      expect(isSessionAuthCookieName(candidate, candidate.authCookieName)).toBe(false);
      expect(isSessionCodeVerifierCookieName(candidate, candidate.codeVerifierCookieName)).toBe(false);
      expect(
        readSessionAuthCookies(candidate, [{ name: candidate.authCookieName, value: SHORT_VALUE }]),
      ).toEqual({ status: "malformed", cookies: [] });
    }
  });

  it("SCP-008 the no-store headers are exactly the library's three (contract 25 F9c)", () => {
    expect(SESSION_COOKIE_NO_STORE_HEADERS).toEqual([
      { name: "Cache-Control", value: "private, no-cache, no-store, must-revalidate, max-age=0" },
      { name: "Expires", value: "0" },
      { name: "Pragma", value: "no-cache" },
    ]);
    expect(Object.isFrozen(SESSION_COOKIE_NO_STORE_HEADERS)).toBe(true);
    for (const header of SESSION_COOKIE_NO_STORE_HEADERS) {
      expect(Object.isFrozen(header)).toBe(true);
    }
  });
});

describe("sessionCookiePolicy - names, chunks and the installed library (contract 25 Sections 5.2 and 6)", () => {
  it("SCP-009 recognizes N and its chunks, and the code verifier and its chunks, exactly as the library's chunk matcher does", () => {
    const candidates = (base: string): string[] => [
      base,
      `${base}.0`,
      `${base}.1`,
      `${base}.9`,
      `${base}.10`,
      `${base}.123`,
      `${base}.00`,
      `${base}.01`,
      `${base}.-1`,
      `${base}.`,
      `${base}.1.2`,
      `${base}.a`,
      `${base}.1a`,
      `${base}. 1`,
      `${base}.1\n`,
      `${base}0`,
      `${base}x`,
      `x${base}`,
      `${base}-code-verifier`,
      `${base}-code-verifier.0`,
      `${base}-user`,
      "",
    ];
    for (const policy of [HOSTED, LOOPBACK]) {
      for (const name of candidates(policy.authCookieName)) {
        expect(isSessionAuthCookieName(policy, name), JSON.stringify(name)).toBe(
          isChunkLike(name, policy.authCookieName),
        );
      }
      for (const name of candidates(policy.codeVerifierCookieName)) {
        expect(isSessionCodeVerifierCookieName(policy, name), JSON.stringify(name)).toBe(
          isChunkLike(name, policy.codeVerifierCookieName),
        );
      }
      expect(isSessionAuthCookieName(policy, policy.codeVerifierCookieName)).toBe(false);
      expect(isSessionAuthCookieName(policy, policy.bindingCookieName)).toBe(false);
      expect(isSessionCodeVerifierCookieName(policy, policy.authCookieName)).toBe(false);
      expect(isSessionAuthCookieName(policy, "sb-127-auth-token")).toBe(false);
      expect(isSessionAuthCookieName(policy, 1)).toBe(false);
    }
    // Each environment's names are foreign to the other.
    expect(isSessionAuthCookieName(HOSTED, LOOPBACK.authCookieName)).toBe(false);
    expect(isSessionAuthCookieName(LOOPBACK, HOSTED.authCookieName)).toBe(false);
  });

  it("SCP-010 the library's own chunker output is recognized, and read back whole, for a short, a long and a many-chunk value", async () => {
    const longValue = encodedSession("synthetic-long", 4000);
    const cases: ReadonlyArray<readonly [string, number | undefined, number]> = [
      [SHORT_VALUE, undefined, 1],
      [longValue, undefined, 2],
      [encodedSession("synthetic-many", 200), 25, 14],
    ];
    for (const policy of [HOSTED, LOOPBACK]) {
      for (const [value, chunkSize, expectedCount] of cases) {
        const chunks = createChunks(policy.authCookieName, value, chunkSize);
        expect(chunks.length).toBeGreaterThanOrEqual(expectedCount);
        if (chunks.length === 1) {
          expect(chunks[0].name).toBe(policy.authCookieName);
        } else {
          expect(chunks.map((chunk) => chunk.name)).toEqual(
            chunks.map((_, index) => `${policy.authCookieName}.${index}`),
          );
        }
        for (const chunk of chunks) {
          expect(isSessionAuthCookieName(policy, chunk.name)).toBe(true);
        }
        const requestCookies = chunks.map((chunk) => ({ name: chunk.name, value: chunk.value }));
        const read = readSessionAuthCookies(policy, requestCookies);
        expect(read.status).toBe("present");
        expect(read.cookies.map((cookie) => cookie.value).join("")).toBe(value);
        expect(await libraryJoin(policy.authCookieName, requestCookies)).toBe(value);
      }
    }
  });
});

describe("sessionCookiePolicy - the one shared format check (contract 25 Section 14; items 4 and 11)", () => {
  const N = LOOPBACK.authCookieName;

  it("SCP-011 absent when the library would find no auth value; present returns frozen copies of the auth cookie and chunks only", () => {
    expect(readSessionAuthCookies(LOOPBACK, [])).toEqual({ status: "absent", cookies: [] });
    expect(
      readSessionAuthCookies(LOOPBACK, [
        { name: "theme", value: "dark" },
        { name: "sb-127-auth-token", value: SHORT_VALUE },
        { name: LOOPBACK.bindingCookieName, value: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60" },
      ]),
    ).toEqual({ status: "absent", cookies: [] });
    expect(readSessionAuthCookies(LOOPBACK, [{ name: N, value: "" }])).toEqual({
      status: "absent",
      cookies: [],
    });

    const input = [
      { name: "theme", value: "dark=1; x" },
      { name: N, value: SHORT_VALUE },
      { name: LOOPBACK.codeVerifierCookieName, value: "base64-verifier" },
      { name: LOOPBACK.bindingCookieName, value: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60" },
    ];
    const read = readSessionAuthCookies(LOOPBACK, input);
    expect(read).toEqual({ status: "present", cookies: [{ name: N, value: SHORT_VALUE }] });
    expect(Object.isFrozen(read)).toBe(true);
    expect(Object.isFrozen(read.cookies)).toBe(true);
    expect(Object.isFrozen(read.cookies[0])).toBe(true);
    // Copies: changing the caller's objects afterwards changes nothing.
    input[1].value = "changed";
    expect(read.cookies[0].value).toBe(SHORT_VALUE);
  });

  it("SCP-012 refuses every character outside A-Z, a-z, 0-9, - and _ in any auth chunk, including one the library would not read", () => {
    expect(REFUSED_CHARACTERS).toHaveLength(128 - 64 + 6);
    const half = SHORT_VALUE.length >> 1;
    for (const character of REFUSED_CHARACTERS) {
      const label = JSON.stringify(character);
      expect(
        readSessionAuthCookies(LOOPBACK, [{ name: N, value: `${SHORT_VALUE}${character}` }]),
        label,
      ).toEqual({ status: "malformed", cookies: [] });
      expect(
        readSessionAuthCookies(LOOPBACK, [
          { name: `${N}.0`, value: SHORT_VALUE.slice(0, half) },
          { name: `${N}.1`, value: `${SHORT_VALUE.slice(half)}${character}` },
        ]).status,
        label,
      ).toBe("malformed");
      // Past a gap, where the library stops reading: still refused.
      expect(
        readSessionAuthCookies(LOOPBACK, [
          { name: N, value: SHORT_VALUE },
          { name: `${N}.5`, value: character },
        ]).status,
        label,
      ).toBe("malformed");
      // A refused character in a cookie that is not an auth chunk is not this
      // check's concern.
      expect(
        readSessionAuthCookies(LOOPBACK, [
          { name: N, value: SHORT_VALUE },
          { name: "theme", value: character },
        ]).status,
        label,
      ).toBe("present");
    }
    // Every allowed character passes.
    expect(
      readSessionAuthCookies(LOOPBACK, [
        { name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${BASE64URL_ALPHABET}` },
      ]).status,
    ).toBe("present");
  });

  it("SCP-013 requires the joined value to start with base64-, and joins exactly as the library does", async () => {
    const cases: ReadonlyArray<ReadonlyArray<SessionCookieEntry>> = [
      [{ name: N, value: "eyJhbGciOiJIUzI1NiJ9" }],
      [{ name: N, value: "base64" }],
      [
        { name: `${N}.0`, value: "abc" },
        { name: `${N}.1`, value: "base64-def" },
      ],
      // N, when non-empty, wins over chunks.
      [
        { name: N, value: "base64-abc" },
        { name: `${N}.0`, value: "zzz" },
      ],
      [
        { name: N, value: "zzz" },
        { name: `${N}.0`, value: "base64-abc" },
      ],
      // An empty N falls back to the chunks.
      [
        { name: N, value: "" },
        { name: `${N}.0`, value: "base64-ab" },
        { name: `${N}.1`, value: "cd" },
      ],
      // The join stops at the first missing or empty chunk.
      [
        { name: `${N}.0`, value: "base64-ab" },
        { name: `${N}.1`, value: "" },
        { name: `${N}.2`, value: "zz" },
      ],
      [{ name: `${N}.1`, value: "base64-ab" }],
      // For a repeated name the first one counts.
      [
        { name: `${N}.0`, value: "zzz" },
        { name: `${N}.0`, value: "base64-ab" },
      ],
      [
        { name: `${N}.0`, value: "base64-ab" },
        { name: `${N}.0`, value: "zzz" },
      ],
    ];
    for (const cookies of cases) {
      const joined = await libraryJoin(N, cookies);
      const expected =
        joined === null ? "absent" : joined.startsWith(SESSION_AUTH_COOKIE_VALUE_PREFIX) ? "present" : "malformed";
      expect(readSessionAuthCookies(LOOPBACK, cookies).status, JSON.stringify(cookies)).toBe(expected);
    }
  });

  it("SCP-014 no value that passes the check can reach the library decoder's error that names a character", () => {
    // The decoder names any character outside its alphabet; it skips space,
    // tab, LF, CR and `=`. The check refuses all of them first.
    for (const character of REFUSED_CHARACTERS.filter((value) => value.length === 1)) {
      let message = "";
      try {
        stringFromBase64URL(`ab${character}`);
      } catch (error) {
        message = (error as Error).message;
      }
      if (" \t\n\r=".includes(character)) {
        expect(message, JSON.stringify(character)).toBe("");
      } else {
        expect(message, JSON.stringify(character)).toContain(character);
      }
    }
    // A deterministic sweep of accepted values: whatever the decoder does
    // with them, it never names a character.
    let seed = 20261005;
    const nextRandom = (): number => {
      seed = (seed * 48271) % 2147483647;
      return seed;
    };
    for (let trial = 0; trial < 2000; trial += 1) {
      const length = nextRandom() % 48;
      let payload = "";
      for (let index = 0; index < length; index += 1) {
        payload += BASE64URL_ALPHABET[nextRandom() % 64];
      }
      const value = `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${payload}`;
      expect(readSessionAuthCookies(LOOPBACK, [{ name: N, value }]).status).toBe("present");
      try {
        stringFromBase64URL(payload);
      } catch (error) {
        expect((error as Error).message).not.toMatch(/Invalid Base64-URL character/);
      }
    }
  });

  it.todo(
    "SCP-015 open point for Paul: a value that passes the Section 14 check can still decode to a code point above U+10FFFF, and the library's RangeError then names that code point in its warning; contract 25 Section 14 needs a correction before a reader (S6-4, S6-12) relies on this check",
  );

  it("SCP-016 anything that is not a plain list of plain name-and-value cookies is malformed, and no getter runs", () => {
    const N_VALUE = SHORT_VALUE;
    class CookieLike {
      name = N;
      value = N_VALUE;
    }
    for (const bad of [
      null,
      undefined,
      `${N}=${N_VALUE}`,
      {},
      { 0: { name: N, value: N_VALUE }, length: 1 },
      [{ name: N }],
      [{ name: N, value: 1 }],
      [{ name: 1, value: N_VALUE }],
      [{ name: N, value: N_VALUE, extra: true }],
      [{ name: N, value: N_VALUE, options: {} }],
      [Object.create({ name: N, value: N_VALUE })],
      [new CookieLike()],
      [[N, N_VALUE]],
      ["x"],
      new Array(1),
    ]) {
      expect(readSessionAuthCookies(LOOPBACK, bad), textOf(bad)).toEqual({
        status: "malformed",
        cookies: [],
      });
    }
    const getter = vi.fn(() => N_VALUE);
    const withGetter = [Object.defineProperty({ name: N }, "value", { get: getter, enumerable: true })];
    expect(readSessionAuthCookies(LOOPBACK, withGetter)).toEqual({ status: "malformed", cookies: [] });
    expect(getter).not.toHaveBeenCalled();

    // The held-cookie form may carry the library's `options`, which is never read.
    const optionsGetter = vi.fn(() => ({ maxAge: 0 }));
    const held = [
      Object.defineProperty({ name: N, value: "" }, "options", { get: optionsGetter, enumerable: true }),
    ];
    expect(readSessionCookieEntries(held, true)).toEqual([{ name: N, value: "" }]);
    expect(optionsGetter).not.toHaveBeenCalled();
    expect(readSessionCookieEntries([{ name: N, value: "", options: { maxAge: 0 } }], true)).toEqual([
      { name: N, value: "" },
    ]);
    expect(readSessionCookieEntries([{ name: N, value: "", options: {} }], false)).toBeNull();
    expect(readSessionCookieEntries([], false)).toEqual([]);
  });

  it("SCP-017 malformed results carry no part of the request's auth cookie values, and nothing is logged", () => {
    const secret = "base64-c2VjcmV0LXN5bnRoZXRpYy10b2tlbg";
    for (const value of [`${secret}=`, `${secret}\n`, "eyJzZWNyZXQ", secret]) {
      const read = readSessionAuthCookies(LOOPBACK, [{ name: `${N}.0`, value }, { name: `${N}.1`, value: "%" }]);
      expect(read).toEqual({ status: "malformed", cookies: [] });
      expect(textOf(read)).not.toContain("c2VjcmV0");
      expect(textOf(read)).not.toContain("eyJzZWNyZXQ");
    }
    // The console spies in afterEach prove nothing was logged.
  });
});
