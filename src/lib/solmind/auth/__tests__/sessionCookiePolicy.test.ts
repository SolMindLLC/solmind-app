// Login step 6, sub-slice S6-2: the session-cookie policy and the shared
// format check (contract 25 Sections 4, 5.2, 6 and 14; Section 15 items 1, 4
// and 11), with the strict UTF-8 step that Paul's 2026-10-05 correction of
// Section 14 added. The installed Supabase SSR library's own chunker, joiner
// and base64url decoder are used here as test oracles only, so the names and
// the join match the real library. For the strict UTF-8 step, Node's own
// base64url decoder and a fatal UTF-8 decoder are an independent oracle.

import { Buffer } from "node:buffer";
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
  type SessionAuthCookieRead,
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

// A fatal UTF-8 decoder that keeps a byte-order mark, as the library does.
function strictUtf8Text(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}

// The independent oracle for the strict UTF-8 step: Node's own base64url
// decoder, then a fatal UTF-8 decoder.
function isStrictUtf8Payload(payload: string): boolean {
  try {
    strictUtf8Text(Buffer.from(payload, "base64url"));
    return true;
  } catch {
    return false;
  }
}

// The error the library's decoder throws for a payload (the part after
// `base64-`), or null when it decodes. The error is never printed.
function libraryDecoderError(payload: string): Error | null {
  try {
    stringFromBase64URL(payload);
    return null;
  } catch (error) {
    return error as Error;
  }
}

// The canonical base64url form of these bytes, without padding.
function payloadOf(bytes: ReadonlyArray<number>): string {
  return Buffer.from(bytes).toString("base64url");
}

const MALFORMED_READ = { status: "malformed", cookies: [] } as const;

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
    // Every allowed character passes. Each one ends a group of four after
    // `AAA`, so it gives the low 6 bits of a byte from 0x00 to 0x3F and the
    // value also passes the strict UTF-8 step.
    const everyAllowedCharacter = [...BASE64URL_ALPHABET].map((character) => `AAA${character}`).join("");
    expect(
      readSessionAuthCookies(LOOPBACK, [
        { name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${everyAllowedCharacter}` },
      ]).status,
    ).toBe("present");
  });

  it("SCP-013 requires the joined value to start with base64-, and joins exactly as the library does", async () => {
    // `QUJD` is the base64url form of "ABC". `zz` and `zzz` decode to bytes
    // that are not UTF-8, so a wrong join would be refused.
    const cases: ReadonlyArray<ReadonlyArray<SessionCookieEntry>> = [
      [{ name: N, value: "eyJhbGciOiJIUzI1NiJ9" }],
      [{ name: N, value: "base64" }],
      [
        { name: `${N}.0`, value: "abc" },
        { name: `${N}.1`, value: "base64-def" },
      ],
      // N, when non-empty, wins over chunks.
      [
        { name: N, value: "base64-QUJD" },
        { name: `${N}.0`, value: "zzz" },
      ],
      [
        { name: N, value: "zzz" },
        { name: `${N}.0`, value: "base64-QUJD" },
      ],
      // An empty N falls back to the chunks.
      [
        { name: N, value: "" },
        { name: `${N}.0`, value: "base64-QU" },
        { name: `${N}.1`, value: "JD" },
      ],
      // The join stops at the first missing or empty chunk.
      [
        { name: `${N}.0`, value: "base64-QUJD" },
        { name: `${N}.1`, value: "" },
        { name: `${N}.2`, value: "zz" },
      ],
      [{ name: `${N}.1`, value: "base64-QUJD" }],
      // For a repeated name the first one counts.
      [
        { name: `${N}.0`, value: "zzz" },
        { name: `${N}.0`, value: "base64-QUJD" },
      ],
      [
        { name: `${N}.0`, value: "base64-QUJD" },
        { name: `${N}.0`, value: "zzz" },
      ],
      // The strict UTF-8 step judges the joined value: `w6k` is "\u{e9}", whose
      // two bytes are split across the chunks, and `QUJDzz` ends in a
      // truncated sequence although each chunk alone would pass.
      [
        { name: `${N}.0`, value: "base64-w6" },
        { name: `${N}.1`, value: "k" },
      ],
      [
        { name: `${N}.0`, value: "base64-QU" },
        { name: `${N}.1`, value: "JDzz" },
      ],
    ];
    const seen = new Set<string>();
    for (const cookies of cases) {
      const joined = await libraryJoin(N, cookies);
      const expected =
        joined === null
          ? "absent"
          : joined.startsWith(SESSION_AUTH_COOKIE_VALUE_PREFIX) &&
              isStrictUtf8Payload(joined.slice(SESSION_AUTH_COOKIE_VALUE_PREFIX.length))
            ? "present"
            : "malformed";
      expect(readSessionAuthCookies(LOOPBACK, cookies).status, JSON.stringify(cookies)).toBe(expected);
      seen.add(expected);
    }
    expect([...seen].sort()).toEqual(["absent", "malformed", "present"]);
    expect(stringFromBase64URL("w6k")).toBe("\u{e9}");
  });

  it("SCP-014 no value that passes the check reaches any error of the library's decoder, and a deterministic sweep agrees with an independent strict UTF-8 oracle", () => {
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
    // A deterministic sweep of three kinds of value: random characters of
    // the alphabet, Node's UTF-8 and base64url encoding of random text, and
    // that encoding with one byte changed. The check agrees with the
    // independent oracle on every value; whenever the library's decoder
    // throws, the value is refused; and every value that passes decodes in
    // the library exactly as the oracle decodes it.
    let seed = 20261005;
    const nextRandom = (): number => {
      seed = (seed * 48271) % 2147483647;
      return seed;
    };
    const CODE_POINT_RANGES: ReadonlyArray<readonly [number, number]> = [
      [0x20, 0x7e],
      [0x80, 0x7ff],
      [0x800, 0xd7ff],
      [0xe000, 0xffff],
      [0x10000, 0x10ffff],
    ];
    const randomText = (): string => {
      let text = "";
      const length = nextRandom() % 12;
      for (let index = 0; index < length; index += 1) {
        const [low, high] = CODE_POINT_RANGES[nextRandom() % CODE_POINT_RANGES.length];
        text += String.fromCodePoint(low + (nextRandom() % (high - low + 1)));
      }
      return text;
    };
    const counts = { present: 0, malformed: 0, libraryThrew: 0 };
    for (let trial = 0; trial < 3000; trial += 1) {
      let payload = "";
      if (trial % 3 === 0) {
        const length = nextRandom() % 48;
        for (let index = 0; index < length; index += 1) {
          payload += BASE64URL_ALPHABET[nextRandom() % 64];
        }
      } else {
        const bytes = Buffer.from(randomText(), "utf8");
        if (trial % 3 === 2 && bytes.length > 0) {
          bytes[nextRandom() % bytes.length] = nextRandom() % 256;
        }
        payload = bytes.toString("base64url");
      }
      const label = JSON.stringify(payload);
      const read = readSessionAuthCookies(LOOPBACK, [
        { name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${payload}` },
      ]);
      expect(read.status, label).toBe(isStrictUtf8Payload(payload) ? "present" : "malformed");
      const error = libraryDecoderError(payload);
      if (error !== null) {
        counts.libraryThrew += 1;
        expect(read, label).toEqual(MALFORMED_READ);
        expect(error.message, label).not.toMatch(/Invalid Base64-URL character/);
      }
      if (read.status === "present") {
        counts.present += 1;
        expect(stringFromBase64URL(payload), label).toBe(strictUtf8Text(Buffer.from(payload, "base64url")));
      } else {
        counts.malformed += 1;
      }
    }
    expect(counts.present).toBeGreaterThan(1000);
    expect(counts.malformed).toBeGreaterThan(1000);
    expect(counts.libraryThrew).toBeGreaterThan(500);
  });

  it("SCP-015 a value that would make the library's decoder throw is refused before the library sees it: review #149a's counterexample (a code point above U+10FFFF) and each of the decoder's other throws", async () => {
    // `9YCAgA` is the bytes F5 80 80 80: it passes the character and
    // `base64-` checks, and the library's decoder adds them up to 0x140000
    // and throws a RangeError that names a number derived from the value.
    const payload = "9YCAgA";
    expect([...Buffer.from(payload, "base64url")]).toEqual([0xf5, 0x80, 0x80, 0x80]);
    const error = libraryDecoderError(payload);
    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toContain(String(0x140000));
    const value = `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${payload}`;
    for (const policy of [HOSTED, LOOPBACK]) {
      expect(readSessionAuthCookies(policy, [{ name: policy.authCookieName, value }])).toEqual(MALFORMED_READ);
      // The same value in two chunks, which the library would join back.
      const chunks = [
        { name: `${policy.authCookieName}.0`, value: value.slice(0, 9) },
        { name: `${policy.authCookieName}.1`, value: value.slice(9) },
      ];
      expect(await libraryJoin(policy.authCookieName, chunks)).toBe(value);
      expect(readSessionAuthCookies(policy, chunks)).toEqual(MALFORMED_READ);
    }
    // The decoder's other throws: "Invalid UTF-8 sequence" for a byte 0x80
    // to 0xBF or 0xF8 to 0xFF where a sequence starts, or a byte below 0x80
    // inside one; and a RangeError for any four-byte sequence above
    // U+10FFFF, which the decoder builds even from lead bytes in the
    // continuation places.
    const throwing: ReadonlyArray<readonly [ReadonlyArray<number>, "Error" | "RangeError"]> = [
      [[0x80], "Error"],
      [[0xbf], "Error"],
      [[0x41, 0x80], "Error"],
      [[0xc3, 0xa9, 0xbf], "Error"],
      [[0xf8], "Error"],
      [[0xfb], "Error"],
      [[0xfc], "Error"],
      [[0xff], "Error"],
      [[0xc2, 0x41], "Error"],
      [[0xe2, 0x82, 0x41], "Error"],
      [[0xf0, 0x9f, 0x98, 0x7f], "Error"],
      [[0xf4, 0x90, 0x80, 0x80], "RangeError"],
      [[0xf4, 0xbf, 0xbf, 0xbf], "RangeError"],
      [[0xf7, 0xbf, 0xbf, 0xbf], "RangeError"],
      [[0xf5, 0xc0, 0xc0, 0xc0], "RangeError"],
      [[0xf4, 0xff, 0xff, 0xff], "RangeError"],
    ];
    for (const [bytes, kind] of throwing) {
      const bad = payloadOf(bytes);
      const label = JSON.stringify(bytes);
      const thrown = libraryDecoderError(bad);
      expect(thrown?.constructor.name, label).toBe(kind);
      if (kind === "Error") {
        expect(thrown?.message, label).toBe("Invalid UTF-8 sequence");
      }
      expect(
        readSessionAuthCookies(LOOPBACK, [{ name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${bad}` }]),
        label,
      ).toEqual(MALFORMED_READ);
    }
  });

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

  // Byte sequences that are not well-formed UTF-8, with whether the installed
  // library's decoder throws on each one alone.
  const MALFORMED_UTF8: ReadonlyArray<readonly [string, ReadonlyArray<number>, boolean]> = [
    ["overlong two-byte NUL", [0xc0, 0x80], false],
    ["overlong two-byte solidus", [0xc0, 0xaf], false],
    ["overlong two-byte U+007F", [0xc1, 0xbf], false],
    ["overlong three-byte NUL", [0xe0, 0x80, 0x80], false],
    ["overlong three-byte U+07FF", [0xe0, 0x9f, 0xbf], false],
    ["overlong four-byte NUL", [0xf0, 0x80, 0x80, 0x80], false],
    ["overlong four-byte U+FFFF", [0xf0, 0x8f, 0xbf, 0xbf], false],
    ["surrogate U+D800", [0xed, 0xa0, 0x80], false],
    ["surrogate U+DBFF", [0xed, 0xaf, 0xbf], false],
    ["surrogate U+DC00", [0xed, 0xb0, 0x80], false],
    ["surrogate U+DFFF", [0xed, 0xbf, 0xbf], false],
    ["surrogate pair as two three-byte forms", [0xed, 0xa0, 0xbd, 0xed, 0xb8, 0x80], false],
    ["above U+10FFFF: U+110000", [0xf4, 0x90, 0x80, 0x80], true],
    ["above U+10FFFF: lead byte F5", [0xf5, 0x80, 0x80, 0x80], true],
    ["above U+10FFFF: lead byte F7", [0xf7, 0xbf, 0xbf, 0xbf], true],
    ["truncated two-byte sequence", [0xc3], false],
    ["truncated three-byte sequence", [0xe2, 0x82], false],
    ["truncated four-byte sequence", [0xf0, 0x9f, 0x98], false],
    ["truncated sequence before ASCII", [0xe2, 0x82, 0x41], true],
    ["lone continuation byte 0x80", [0x80], true],
    ["lone continuation byte 0xBF", [0xbf], true],
    ["continuation byte after a complete sequence", [0xc3, 0xa9, 0x80], true],
    ["byte that starts no sequence: 0xF8", [0xf8, 0x80, 0x80, 0x80, 0x80], true],
    ["byte that starts no sequence: 0xFE", [0xfe], true],
    ["byte that starts no sequence: 0xFF", [0xff], true],
  ];

  it("SCP-018 refuses each class of malformed UTF-8 wherever it sits: overlong forms, surrogate code points, code points above U+10FFFF, truncated sequences, lone continuation bytes and bytes that start no sequence", () => {
    for (const [name, bytes, libraryThrows] of MALFORMED_UTF8) {
      // The oracle agrees that the bytes are malformed, and the library's
      // decoder throws on exactly the cases its source says it does.
      expect(isStrictUtf8Payload(payloadOf(bytes)), name).toBe(false);
      expect(libraryDecoderError(payloadOf(bytes)) !== null, name).toBe(libraryThrows);
      // At the start, after one or two ASCII bytes (so the sequence falls on
      // each alignment of the base64url groups), and with ASCII after it.
      for (const before of [[], [0x41], [0x41, 0x42]]) {
        for (const after of [[], [0x43]]) {
          const value = `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${payloadOf([...before, ...bytes, ...after])}`;
          const label = `${name} ${JSON.stringify([before, after])}`;
          expect(readSessionAuthCookies(LOOPBACK, [{ name: N, value }]), label).toEqual(MALFORMED_READ);
          // Split into two chunks: still refused, as the joined value.
          const half = SESSION_AUTH_COOKIE_VALUE_PREFIX.length + 1;
          expect(
            readSessionAuthCookies(HOSTED, [
              { name: `${HOSTED.authCookieName}.0`, value: value.slice(0, half) },
              { name: `${HOSTED.authCookieName}.1`, value: value.slice(half) },
            ]),
            label,
          ).toEqual(MALFORMED_READ);
        }
      }
    }
  });

  it("SCP-019 accepts valid multi-byte UTF-8: every boundary code point, and the library's own encoding of a session holding 2-, 3- and 4-byte characters, whole and in chunks", async () => {
    const boundaries: ReadonlyArray<readonly [number, ReadonlyArray<number>]> = [
      [0x00, [0x00]],
      [0x7f, [0x7f]],
      [0x80, [0xc2, 0x80]],
      [0x7ff, [0xdf, 0xbf]],
      [0x800, [0xe0, 0xa0, 0x80]],
      [0xd7ff, [0xed, 0x9f, 0xbf]],
      [0xe000, [0xee, 0x80, 0x80]],
      [0xfeff, [0xef, 0xbb, 0xbf]],
      [0xfffd, [0xef, 0xbf, 0xbd]],
      [0xffff, [0xef, 0xbf, 0xbf]],
      [0x10000, [0xf0, 0x90, 0x80, 0x80]],
      [0x10ffff, [0xf4, 0x8f, 0xbf, 0xbf]],
    ];
    for (const [codePoint, bytes] of boundaries) {
      const payload = payloadOf(bytes);
      const label = codePoint.toString(16);
      expect([...Buffer.from(String.fromCodePoint(codePoint), "utf8")], label).toEqual(bytes);
      expect(
        readSessionAuthCookies(LOOPBACK, [{ name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${payload}` }])
          .status,
        label,
      ).toBe("present");
      expect(stringFromBase64URL(payload), label).toBe(String.fromCodePoint(codePoint));
    }

    // A synthetic session as the library writes it. JSON.stringify escapes
    // the lone surrogate, so what the library encodes is always valid UTF-8.
    // (The 4-byte characters stay below U+20000, which the library's encoder
    // keeps intact.)
    const text = "caf\u{e9} \u{df} \u{20ac} \u{800} \u{feff} \u{1d11e} \u{1f600} \u{80} \u{7ff} \u{ffff}";
    const json = JSON.stringify({
      access_token: `synthetic-${text}`,
      refresh_token: "synthetic-r",
      note: "\ud800",
    });
    expect(json).toContain("\\ud800");
    const value = `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${stringToBase64URL(json)}`;
    const read = readSessionAuthCookies(LOOPBACK, [{ name: N, value }]);
    expect(read).toEqual({ status: "present", cookies: [{ name: N, value }] });
    expect(stringFromBase64URL(value.slice(SESSION_AUTH_COOKIE_VALUE_PREFIX.length))).toBe(json);
    // In chunks of 25 characters, cut wherever they fall, as the library's
    // chunker cuts them.
    const chunks = createChunks(HOSTED.authCookieName, value, 25).map((chunk) => ({
      name: chunk.name,
      value: chunk.value,
    }));
    expect(chunks.length).toBeGreaterThan(4);
    const chunkedRead = readSessionAuthCookies(HOSTED, chunks);
    expect(chunkedRead.status).toBe("present");
    expect(chunkedRead.cookies.map((cookie) => cookie.value).join("")).toBe(value);
    expect(await libraryJoin(HOSTED.authCookieName, chunks)).toBe(value);
  });

  it("SCP-020 decodes the bytes as the library does: a bad last byte is refused at every payload length, and the bits left over at the end are dropped, not judged", () => {
    // One, two and three bytes give payloads of 2, 3 and 4 characters.
    for (const before of [[], [0x41], [0x41, 0x42]]) {
      for (const last of [0x80, 0xc3, 0xff]) {
        const payload = payloadOf([...before, last]);
        const label = JSON.stringify([...before, last]);
        expect(payload.length % 4, label).toBe([2, 3, 0][before.length]);
        expect(
          readSessionAuthCookies(LOOPBACK, [{ name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${payload}` }]),
          label,
        ).toEqual(MALFORMED_READ);
      }
    }
    // A dangling character (a payload length of 1 more than a multiple of
    // 4) gives 6 bits and no byte, so the library ignores it and so does the
    // check, whatever the character is.
    for (const character of BASE64URL_ALPHABET) {
      expect(stringFromBase64URL(`QUJD${character}`), character).toBe("ABC");
      expect(
        readSessionAuthCookies(LOOPBACK, [{ name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}QUJD${character}` }])
          .status,
        character,
      ).toBe("present");
    }
    // `QUI` and `QUJ` both decode to "AB": their last 2 bits (00 and 01) make
    // no byte.
    for (const payload of ["QUI", "QUJ"]) {
      expect(stringFromBase64URL(payload)).toBe("AB");
      expect(
        readSessionAuthCookies(LOOPBACK, [{ name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${payload}` }])
          .status,
      ).toBe("present");
    }
  });

  it("SCP-021 a refusal by the strict UTF-8 step is the same fixed, frozen, value-free result as any other refusal, and nothing is logged", () => {
    const marker = "synthetic-secret-marker";
    const refusals = [
      payloadOf([...Buffer.from(marker, "utf8"), 0xff]),
      payloadOf([...Buffer.from(marker, "utf8"), 0xf5, 0x80, 0x80, 0x80]),
      payloadOf([0xed, 0xa0, 0x80, ...Buffer.from(marker, "utf8")]),
    ];
    const other = readSessionAuthCookies(LOOPBACK, [{ name: N, value: "not-base64" }]);
    for (const payload of refusals) {
      const read = readSessionAuthCookies(LOOPBACK, [{ name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${payload}` }]);
      expect(read).toBe(other);
      expect(read).toEqual(MALFORMED_READ);
      expect(Object.isFrozen(read)).toBe(true);
      expect(Object.isFrozen(read.cookies)).toBe(true);
      const text = textOf(read);
      expect(text).not.toContain(marker);
      expect(text).not.toContain(payload.slice(0, 8));
      expect(text).not.toContain(payload.slice(-8));
    }
    // The console spies in afterEach prove nothing was logged.
  });

  it("SCP-022 claims only the decoder: an empty payload, or text that is not JSON, passes this check and is left to the library's own value-free JSON step", () => {
    for (const payload of ["", stringToBase64URL("synthetic text, not JSON")]) {
      expect(libraryDecoderError(payload)).toBeNull();
      expect(() => JSON.parse(stringFromBase64URL(payload))).toThrow();
      expect(
        readSessionAuthCookies(LOOPBACK, [{ name: N, value: `${SESSION_AUTH_COOKIE_VALUE_PREFIX}${payload}` }])
          .status,
      ).toBe("present");
    }
  });

  // The strict UTF-8 step's decoder is the global `TextDecoder`, which the
  // module creates and uses inside the step's `try`. `SCP-023` to `SCP-025`
  // remove it or make it fail for one call. The global is replaced only while
  // that one call runs and is put back in a `finally`; every assertion, and
  // this file's own oracles, which use the real decoder, run afterwards.
  const REAL_TEXT_DECODER = globalThis.TextDecoder;
  const DECODED_VALUE: ReadonlyArray<SessionCookieEntry> = [{ name: N, value: SHORT_VALUE }];

  type DecoderFailureOutcome = Readonly<{
    read: SessionAuthCookieRead | undefined;
    thrown: unknown;
    ownGlobalDuring: boolean;
    globalDuring: unknown;
  }>;

  // Reads DECODED_VALUE with the global `TextDecoder` replaced by
  // `replacement`, or removed when `replacement` is undefined, and records
  // the result or whatever was thrown.
  function readWithTextDecoder(replacement: unknown): DecoderFailureOutcome {
    const original = Object.getOwnPropertyDescriptor(globalThis, "TextDecoder");
    if (original === undefined) {
      throw new Error("test setup: there is no global TextDecoder");
    }
    let read: SessionAuthCookieRead | undefined = undefined;
    let thrown: unknown = undefined;
    let ownGlobalDuring = true;
    let globalDuring: unknown = undefined;
    try {
      if (replacement === undefined) {
        if (!Reflect.deleteProperty(globalThis, "TextDecoder")) {
          throw new Error("test setup: the global TextDecoder could not be removed");
        }
      } else {
        Object.defineProperty(globalThis, "TextDecoder", { configurable: true, writable: true, value: replacement });
      }
      ownGlobalDuring = Object.prototype.hasOwnProperty.call(globalThis, "TextDecoder");
      globalDuring = Reflect.get(globalThis, "TextDecoder");
      try {
        read = readSessionAuthCookies(LOOPBACK, DECODED_VALUE);
      } catch (error) {
        thrown = error;
      }
    } finally {
      Object.defineProperty(globalThis, "TextDecoder", original);
    }
    return { read, thrown, ownGlobalDuring, globalDuring };
  }

  // The same shared, frozen malformed result as any other refusal; no
  // exception escaped; nothing was logged; and, with the global back, the
  // same value is accepted again.
  function expectRefusedQuietly(outcome: DecoderFailureOutcome, label: string): void {
    const other = readSessionAuthCookies(LOOPBACK, [{ name: N, value: "not-base64" }]);
    expect(outcome.thrown, label).toBe(undefined);
    expect(outcome.read, label).toBe(other);
    expect(outcome.read, label).toEqual(MALFORMED_READ);
    expect(Object.isFrozen(outcome.read), label).toBe(true);
    expect(Object.isFrozen(outcome.read?.cookies), label).toBe(true);
    for (const method of CONSOLE_METHODS) {
      expect(console[method], `${label}: console.${method}`).not.toHaveBeenCalled();
    }
    expect(globalThis.TextDecoder, label).toBe(REAL_TEXT_DECODER);
    expect(readSessionAuthCookies(LOOPBACK, DECODED_VALUE).status, label).toBe("present");
  }

  it("SCP-023 with no global TextDecoder, the strict UTF-8 step refuses a value it would accept: the same frozen malformed result, no exception escapes, nothing is logged, and the global is put back", () => {
    expect(readSessionAuthCookies(LOOPBACK, DECODED_VALUE).status).toBe("present");
    const outcome = readWithTextDecoder(undefined);
    expect(outcome.ownGlobalDuring).toBe(false);
    expect(outcome.globalDuring).toBe(undefined);
    expectRefusedQuietly(outcome, "no TextDecoder");
  });

  it("SCP-024 with a TextDecoder constructor that throws, the strict UTF-8 step refuses a value it would accept: the same frozen malformed result, no exception escapes, nothing is logged, and the global is put back", () => {
    let constructed = 0;
    class ThrowingTextDecoder {
      constructor() {
        constructed += 1;
        throw new Error("synthetic TextDecoder constructor failure");
      }
    }
    expect(readSessionAuthCookies(LOOPBACK, DECODED_VALUE).status).toBe("present");
    const outcome = readWithTextDecoder(ThrowingTextDecoder);
    expect(outcome.globalDuring).toBe(ThrowingTextDecoder);
    expect(constructed).toBe(1);
    expectRefusedQuietly(outcome, "a TextDecoder constructor that throws");
  });

  it("SCP-025 with a TextDecoder whose decode throws, the strict UTF-8 step refuses a value it would accept: the same frozen malformed result, no exception escapes, nothing is logged, and the global is put back", () => {
    let decodes = 0;
    class FailingDecodeTextDecoder {
      decode(): string {
        decodes += 1;
        throw new TypeError("synthetic TextDecoder decode failure");
      }
    }
    expect(readSessionAuthCookies(LOOPBACK, DECODED_VALUE).status).toBe("present");
    const outcome = readWithTextDecoder(FailingDecodeTextDecoder);
    expect(outcome.globalDuring).toBe(FailingDecodeTextDecoder);
    expect(decodes).toBe(1);
    expectRefusedQuietly(outcome, "a TextDecoder whose decode throws");
  });
});
