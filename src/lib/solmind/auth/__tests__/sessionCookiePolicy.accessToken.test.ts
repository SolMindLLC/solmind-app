// Login step 6, sub-slice S6-4, the token-only verification (contract 25
// Sections 7 and 8): the session-cookie policy's second pure reader, which
// gives a caller the sign-in token of an auth cookie that the shared format
// check accepts, and nothing else of that cookie. The per-request adapter
// hands that one token to Supabase Auth and gives the Supabase library no
// cookie at all.
//
// The helper judges the cookies it is given with the shared format check
// itself, so everything that check refuses gives null here. These tests show
// that, that the token returned is the session's own `access_token` as
// JSON.parse reads it, and that nothing else of the value comes back.
//
// Odd characters are built with String.fromCharCode, so that this file holds
// only plain ASCII. Every value is synthetic.

import { Buffer } from "node:buffer";
import { inspect } from "node:util";

import { createChunks } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readSessionAuthCookieAccessToken,
  readSessionAuthCookies,
  resolveSessionCookiePolicy,
  type SessionCookieEntry,
  type SessionCookiePolicy,
} from "../sessionCookiePolicy";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

function policyFor(origin: string): SessionCookiePolicy {
  const resolved = resolveSessionCookiePolicy(origin);
  if (resolved === null) {
    throw new Error("test setup: the policy did not resolve");
  }
  return resolved;
}

const HOSTED = policyFor("https://uat.solmind.example");
const LOOPBACK = policyFor("http://127.0.0.1:3000");
const N = LOOPBACK.authCookieName;
const EXPIRES_AT = 1791234567;
const TOKEN = "synthetic.access-token.signature";
const RENEWAL_MARKER = "RENEWALdoNotHandOver7q";
const BS = String.fromCharCode(92);
const LF = String.fromCharCode(10);
const NUL = String.fromCharCode(0);
const BOM = String.fromCharCode(0xfeff);
const KELVIN = String.fromCharCode(0x212a);
const U0100 = String.fromCharCode(0x100);

function sessionJson(more: Record<string, unknown> = {}): string {
  return JSON.stringify({
    access_token: TOKEN,
    refresh_token: "synthetic-refresh-token",
    expires_at: EXPIRES_AT,
    ...more,
  });
}

function valueOfText(text: string): string {
  return `base64-${Buffer.from(text, "utf8").toString("base64url")}`;
}

function cookiesOfText(text: string, policy: SessionCookiePolicy = LOOPBACK): SessionCookieEntry[] {
  return [{ name: policy.authCookieName, value: valueOfText(text) }];
}

// A token in the form Supabase Auth issues: three base64url parts. Nothing
// here is signed.
function tokenShaped(claims: Record<string, unknown>, signatureLength: number): string {
  const part = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${part({ alg: "ES256", kid: "synthetic-key-id", typ: "JWT" })}.${part(claims)}.${"sIGNATURE-synthetic_".repeat(20).slice(0, signatureLength)}`;
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

describe("sessionCookiePolicy - the accepted auth cookie's sign-in token, for the token-only verification (contract 25 Sections 7 and 8)", () => {
  it("TKP-001 gives the session's own access_token for a cookie the format check accepts: whole and in chunks, under both policies, from the request's cookies and from the list a present read returned", () => {
    const tokens = [
      TOKEN,
      "a.b.c",
      "A-Z_a-z.0-9_-.-_",
      tokenShaped({ sub: "22222222-2222-4222-8222-222222222222", exp: EXPIRES_AT }, 86),
      tokenShaped({ sub: "22222222-2222-4222-8222-222222222222", note: "x".repeat(900) }, 342),
    ];
    for (const policy of [HOSTED, LOOPBACK]) {
      for (const token of tokens) {
        const whole = cookiesOfText(sessionJson({ access_token: token }), policy);
        expect(readSessionAuthCookieAccessToken(policy, whole)).toBe(token);
        const chunks = createChunks(policy.authCookieName, whole[0].value, 25).map((chunk) => ({
          name: chunk.name,
          value: chunk.value,
        }));
        expect(chunks.length).toBeGreaterThan(1);
        expect(readSessionAuthCookieAccessToken(policy, chunks)).toBe(token);
        // The request's own cookie list, as the adapter hands it over: other
        // cookies beside the auth cookie's chunks are not read.
        const request = [
          { name: "unrelated", value: "x" },
          ...chunks,
          { name: `${policy.authCookieName}-code-verifier`, value: "base64-not-the-auth-cookie" },
          { name: policy.bindingCookieName, value: "5e5510a0-0000-4000-8000-0000000000d1" },
        ];
        expect(readSessionAuthCookieAccessToken(policy, request)).toBe(token);
        // The list a `present` read returned gives the same token.
        const read = readSessionAuthCookies(policy, request);
        expect(read.status).toBe("present");
        expect(readSessionAuthCookieAccessToken(policy, read.cookies)).toBe(token);
      }
    }
  });

  it("TKP-002 gives null for everything the format check does not accept, and nothing is logged or thrown", () => {
    const marker = "MARKERdoNotLeak9x";
    const refused: ReadonlyArray<readonly [string, unknown]> = [
      ["no cookies", []],
      ["no auth cookie", [{ name: "theme", value: "dark" }]],
      ["an empty auth cookie", [{ name: N, value: "" }]],
      ["a value without the base64- start", [{ name: N, value: "not-base64" }]],
      ["a character outside the set", [{ name: N, value: `${valueOfText(sessionJson())}!` }]],
      ["bytes that are not UTF-8", [{ name: N, value: "base64-9YCAgA" }]],
      ["text that is not JSON", cookiesOfText(`${marker} is not JSON`)],
      ["JSON that is not an object", cookiesOfText(`[${sessionJson()}]`)],
      ["JSON null", cookiesOfText("null")],
      ["a bare token as JSON text", cookiesOfText(JSON.stringify(TOKEN))],
      ["a byte-order mark before a good session", cookiesOfText(`${BOM}${sessionJson()}`)],
      ["a token holding a line feed", cookiesOfText(sessionJson({ access_token: `synthetic.${marker}${LF}forged.signature` }))],
      ["a token holding a NUL", cookiesOfText(sessionJson({ access_token: `synthetic.${marker}${NUL}.signature` }))],
      ["a token holding a character above U+00FF", cookiesOfText(sessionJson({ access_token: `synthetic.${marker}${U0100}.signature` }))],
      ["a token holding the Kelvin sign", cookiesOfText(sessionJson({ access_token: `synthetic.${marker}${KELVIN}.signature` }))],
      ["a good token followed by one line feed", cookiesOfText(sessionJson({ access_token: `${TOKEN}${LF}` }))],
      ["a token of two parts", cookiesOfText(sessionJson({ access_token: "synthetic.signature" }))],
      ["a token of four parts", cookiesOfText(sessionJson({ access_token: "a.b.c.d" }))],
      ["a token with an empty part", cookiesOfText(sessionJson({ access_token: "a..c" }))],
      ["an empty token", cookiesOfText(sessionJson({ access_token: "" }))],
      ["the token as an array", cookiesOfText(sessionJson({ access_token: [TOKEN] }))],
      ["the token as an object", cookiesOfText(sessionJson({ access_token: { toString: 1 } }))],
      ["the token as a number", cookiesOfText(sessionJson({ access_token: 7 }))],
      ["no token", cookiesOfText(JSON.stringify({ refresh_token: "r", expires_at: EXPIRES_AT }))],
      ["no refresh token", cookiesOfText(JSON.stringify({ access_token: TOKEN, expires_at: EXPIRES_AT }))],
      ["an empty refresh token", cookiesOfText(sessionJson({ refresh_token: "" }))],
      ["a user given as text", cookiesOfText(sessionJson({ user: marker }))],
      ["a user given as an array", cookiesOfText(sessionJson({ user: [] }))],
      ["expires_at as text", cookiesOfText(sessionJson({ expires_at: String(EXPIRES_AT) }))],
      ["expires_at 0", cookiesOfText(sessionJson({ expires_at: 0 }))],
      ["expires_at -5", cookiesOfText(sessionJson({ expires_at: -5 }))],
      ["expires_at 0.5", cookiesOfText(sessionJson({ expires_at: 0.5 }))],
      ["expires_at written 1e400", cookiesOfText(sessionJson().replace(String(EXPIRES_AT), "1e400"))],
      ["no expires_at", cookiesOfText(JSON.stringify({ access_token: TOKEN, refresh_token: "r" }))],
      ["a malformed chunk beside a good cookie", [...cookiesOfText(sessionJson()), { name: `${N}.3`, value: "%" }]],
      ["not a list", `${N}=${valueOfText(sessionJson())}`],
      ["null", null],
      ["an entry with an extra key", [{ name: N, value: valueOfText(sessionJson()), extra: true }]],
      ["the other policy's cookie name", cookiesOfText(sessionJson(), HOSTED)],
      ["the library's default cookie name", [{ name: "sb-127-auth-token", value: valueOfText(sessionJson()) }]],
    ];
    for (const [label, cookies] of refused) {
      let result: string | null | undefined = undefined;
      let thrown: unknown = undefined;
      try {
        result = readSessionAuthCookieAccessToken(LOOPBACK, cookies);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, label).toBe(undefined);
      expect(result, label).toBeNull();
      // The shared check's own verdict on the same input is not `present`.
      expect(readSessionAuthCookies(LOOPBACK, cookies).status, label).not.toBe("present");
    }
    // A look-alike policy object is refused, as everywhere in the module.
    const lookAlike = { ...LOOPBACK } as SessionCookiePolicy;
    expect(readSessionAuthCookieAccessToken(lookAlike, cookiesOfText(sessionJson()))).toBeNull();
    // The console spies in afterEach prove nothing was logged.
  });

  it("TKP-003 the token is the one JSON.parse reads: the last of a key written twice, never one that is only inherited", () => {
    const earlier = sessionJson({ access_token: "earlier.token.value" });
    const lastWins = `${earlier.slice(0, -1)},"access_token":${JSON.stringify(TOKEN)}}`;
    expect((JSON.parse(lastWins) as { access_token: unknown }).access_token).toBe(TOKEN);
    expect(readSessionAuthCookieAccessToken(LOOPBACK, cookiesOfText(lastWins))).toBe(TOKEN);
    const firstLoses = `{"access_token":${JSON.stringify(TOKEN)},${earlier.slice(1)}`;
    expect(readSessionAuthCookieAccessToken(LOOPBACK, cookiesOfText(firstLoses))).toBe("earlier.token.value");
    // A good token first and a hostile one last: the hostile one is the
    // session's token, so the cookie is refused and no token comes back.
    const hostileLast = `${sessionJson().slice(0, -1)},"access_token":${JSON.stringify(`synthetic.x${LF}y.signature`)}}`;
    expect(readSessionAuthCookieAccessToken(LOOPBACK, cookiesOfText(hostileLast))).toBeNull();
    // A `__proto__` key that carries another token changes nothing.
    const beside = `{"__proto__":{"access_token":"proto.token.value"},${sessionJson().slice(1)}`;
    expect(readSessionAuthCookieAccessToken(LOOPBACK, cookiesOfText(beside))).toBe(TOKEN);
    // A token that exists only on Object.prototype is not the cookie's. The
    // prototype is changed only while the one read runs.
    const prototype = Object.prototype as unknown as Record<string, unknown>;
    const withoutToken = cookiesOfText(JSON.stringify({ refresh_token: "r", expires_at: EXPIRES_AT }));
    let inherited: string | null | undefined = undefined;
    try {
      Object.defineProperty(prototype, "access_token", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: "inherited.token.value",
      });
      inherited = readSessionAuthCookieAccessToken(LOOPBACK, withoutToken);
    } finally {
      Reflect.deleteProperty(prototype, "access_token");
    }
    expect(({} as Record<string, unknown>).access_token).toBe(undefined);
    expect(inherited).toBeNull();
  });

  it("TKP-004 returns the token and nothing else of the value, and reads the cookies through own data properties only", () => {
    const marker = "MARKERdoNotLeak9x";
    const text = sessionJson({
      refresh_token: `${RENEWAL_MARKER}${BS}n`,
      token_type: marker,
      provider_token: marker,
      user: { id: marker, email: `${marker}@example.invalid` },
    });
    const result = readSessionAuthCookieAccessToken(LOOPBACK, cookiesOfText(text));
    expect(result).toBe(TOKEN);
    expect(typeof result).toBe("string");
    const shown = `${String(result)} ${inspect(result)}`;
    for (const kept of [marker, RENEWAL_MARKER, String(EXPIRES_AT), "refresh", "base64-"]) {
      expect(shown).not.toContain(kept);
    }
    // Two reads of one cookie give equal strings and keep no state between them.
    expect(readSessionAuthCookieAccessToken(LOOPBACK, cookiesOfText(text))).toBe(result);
    // A cookie entry whose value sits behind a getter is not read at all.
    const getter = vi.fn(() => valueOfText(text));
    const withGetter = [Object.defineProperty({ name: N }, "value", { get: getter, enumerable: true })];
    expect(readSessionAuthCookieAccessToken(LOOPBACK, withGetter)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it("TKP-005 over every combination of good and refused parts, a token comes back exactly when the shared check says present, and it is always the session's own well-formed token", () => {
    const tokens: ReadonlyArray<readonly [unknown, boolean]> = [
      [TOKEN, true],
      ["a.b.c", true],
      [`synthetic.x${LF}y.signature`, false],
      [`${TOKEN}${LF}`, false],
      [`synthetic.x${KELVIN}.signature`, false],
      ["two.parts", false],
      [[TOKEN], false],
      [null, false],
    ];
    const renewals: ReadonlyArray<readonly [unknown, boolean]> = [
      ["synthetic-refresh-token", true],
      [`${RENEWAL_MARKER}${LF}X-Injected: 1${NUL}`, true],
      ["", false],
      [7, false],
    ];
    const expiries: ReadonlyArray<readonly [unknown, boolean]> = [
      [EXPIRES_AT, true],
      [1, true],
      [0, false],
      ["1", false],
      [0.5, false],
    ];
    const users: ReadonlyArray<readonly [unknown, boolean]> = [
      [undefined, true],
      [null, true],
      [{ id: "u" }, true],
      ["text", false],
      [[], false],
    ];
    const pattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    let accepted = 0;
    let refused = 0;
    for (const [token, tokenGood] of tokens) {
      for (const [renewal, renewalGood] of renewals) {
        for (const [expiry, expiryGood] of expiries) {
          for (const [user, userGood] of users) {
            const session: Record<string, unknown> = {
              access_token: token,
              refresh_token: renewal,
              expires_at: expiry,
            };
            if (user !== undefined) {
              session.user = user;
            }
            const cookies = cookiesOfText(JSON.stringify(session));
            const expected = tokenGood && renewalGood && expiryGood && userGood ? token : null;
            const result = readSessionAuthCookieAccessToken(LOOPBACK, cookies);
            const label = JSON.stringify(session);
            expect(result, label).toBe(expected);
            expect(result !== null, label).toBe(readSessionAuthCookies(LOOPBACK, cookies).status === "present");
            if (result !== null) {
              expect(pattern.test(result), label).toBe(true);
              accepted += 1;
            } else {
              refused += 1;
            }
          }
        }
      }
    }
    // 2 good tokens x 2 good renewal tokens x 2 good expiries x 3 good users.
    expect(accepted).toBe(24);
    expect(accepted + refused).toBe(tokens.length * renewals.length * expiries.length * users.length);
  });

  it("TKP-006 the token comes from the very cookie the shared check judged: the first of a repeated name, and chunks joined by their index whatever order the request lists them in", () => {
    // Same length as TOKEN, so both values make the same number of chunks.
    const other = "different.access-token.signature";
    const good = valueOfText(sessionJson());
    const second = valueOfText(sessionJson({ access_token: other }));
    const hostile = valueOfText(sessionJson({ access_token: `synthetic.x${LF}y.signature` }));
    const read = (cookies: SessionCookieEntry[]): string | null => readSessionAuthCookieAccessToken(LOOPBACK, cookies);
    // A repeated name: the first one counts, as in the library, for the check
    // and for the token alike.
    expect(read([{ name: N, value: good }, { name: N, value: second }])).toBe(TOKEN);
    expect(read([{ name: N, value: second }, { name: N, value: good }])).toBe(other);
    expect(read([{ name: N, value: good }, { name: N, value: hostile }])).toBe(TOKEN);
    // A hostile one first is the one judged: refused, and the good one behind
    // it is not used.
    expect(read([{ name: N, value: hostile }, { name: N, value: good }])).toBeNull();
    // A repeated chunk name: the first of each index counts.
    const chunks = createChunks(N, good, 25).map((chunk) => ({ name: chunk.name, value: chunk.value }));
    const otherChunks = createChunks(N, second, 25).map((chunk) => ({ name: chunk.name, value: chunk.value }));
    expect(chunks.length).toBeGreaterThan(2);
    expect(otherChunks.length).toBe(chunks.length);
    expect(read([...chunks, ...otherChunks])).toBe(TOKEN);
    expect(read([...otherChunks, ...chunks])).toBe(other);
    // Chunks listed out of order are joined by their index.
    expect(read([...chunks].reverse())).toBe(TOKEN);
    // A non-empty N counts before any chunk, and an empty N gives way to them.
    expect(read([...otherChunks, { name: N, value: good }])).toBe(TOKEN);
    expect(read([{ name: N, value: "" }, ...otherChunks])).toBe(other);
    // A gap ends the value at the gap, as in the library; what is left is not
    // a session, so nothing comes back.
    expect(read([chunks[0], ...chunks.slice(2)])).toBeNull();
  });
});
