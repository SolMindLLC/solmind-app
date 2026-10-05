// Login step 6, sub-slice S6-6: the login session's duration rule (contract 25
// Section 7; Section 15 item 6, in the parts this module owns). The module
// boundary of this module and the session-creation caller is tested beside
// the caller, in `../../supabase/__tests__/userSessionCreationCaller.test.ts`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOGIN_SESSION_DURATION_LIMITS,
  loginSessionCookieMaxAgeSeconds,
  parseLoginSessionExpiresAt,
  providerTokenRemainingLifeSeconds,
  requestedLoginSessionDurationSeconds,
} from "../loginSessionDuration";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

// 2026-10-05 17:00:00 UTC, a whole second, in epoch milliseconds.
const NOW = Date.UTC(2026, 9, 5, 17, 0, 0);
const NOW_SECONDS = NOW / 1000;

// Every final line terminator JavaScript knows, built from code points so
// this file stays ASCII.
const LINE_TERMINATORS: ReadonlyArray<readonly [string, string]> = [
  ["LF", "\n"],
  ["CR", "\r"],
  ["CRLF", "\r\n"],
  ["U+2028", String.fromCharCode(0x2028)],
  ["U+2029", String.fromCharCode(0x2029)],
];

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

describe("loginSessionDuration - the requested duration (contract 25 Section 7; item 6)", () => {
  it("LSD-001 fixes the margin at 120 seconds and the duration at 1 to 3600 seconds", () => {
    expect(LOGIN_SESSION_DURATION_LIMITS).toEqual({
      expiryMarginSeconds: 120,
      minimumSeconds: 1,
      maximumSeconds: 3600,
    });
    expect(Object.isFrozen(LOGIN_SESSION_DURATION_LIMITS)).toBe(true);
  });

  it("LSD-002 item 6's boundaries: a remaining life minus 120 of 0 is denied, 1 is 1, 3600 is 3600, and 3601 is capped at 3600", () => {
    const margin = LOGIN_SESSION_DURATION_LIMITS.expiryMarginSeconds;
    const cases: ReadonlyArray<readonly [number, number | null]> = [
      // The four boundaries of item 6, as the remaining life minus 120.
      [margin + 0, null],
      [margin + 1, 1],
      [margin + 3600, 3600],
      [margin + 3601, 3600],
      // Around them.
      [margin - 1, null],
      [0, null],
      [-1, null],
      [-0, null],
      [margin + 2, 2],
      [margin + 3599, 3599],
      [100_000, 3600],
      [Number.MAX_SAFE_INTEGER, 3600],
      [Number.MIN_SAFE_INTEGER, null],
    ];
    for (const [remainingLife, expected] of cases) {
      expect(requestedLoginSessionDurationSeconds(remainingLife), String(remainingLife)).toBe(expected);
    }
  });

  it("LSD-003 refuses a remaining life that is not a whole number", () => {
    for (const value of [121.5, 3720.000001, Number.NaN, Infinity, -Infinity, 2 ** 53, "3720", null, undefined, {}, [3720]]) {
      expect(requestedLoginSessionDurationSeconds(value as number), String(value)).toBeNull();
    }
    // An object that would coerce to a number is not one.
    expect(requestedLoginSessionDurationSeconds({ valueOf: () => 3720 } as unknown as number)).toBeNull();
  });

  it("LSD-004 works out the token's remaining life in whole seconds, rounding down, from its expiry and the current time", () => {
    const expiresAt = NOW_SECONDS + 3720;
    expect(providerTokenRemainingLifeSeconds(expiresAt, NOW)).toBe(3720);
    expect(providerTokenRemainingLifeSeconds(expiresAt, NOW - 1)).toBe(3720);
    expect(providerTokenRemainingLifeSeconds(expiresAt, NOW + 1)).toBe(3719);
    expect(providerTokenRemainingLifeSeconds(expiresAt, NOW + 999)).toBe(3719);
    expect(providerTokenRemainingLifeSeconds(expiresAt, NOW + 1000)).toBe(3719);
    expect(providerTokenRemainingLifeSeconds(NOW_SECONDS, NOW)).toBe(0);
    expect(providerTokenRemainingLifeSeconds(NOW_SECONDS, NOW + 1)).toBe(-1);
    expect(providerTokenRemainingLifeSeconds(NOW_SECONDS - 60, NOW)).toBe(-60);

    // Rounding down never overstates: 120.999 seconds left is 120, which is
    // denied, and 121 seconds left is a 1-second session.
    expect(requestedLoginSessionDurationSeconds(providerTokenRemainingLifeSeconds(NOW_SECONDS + 121, NOW + 1) as number)).toBeNull();
    expect(requestedLoginSessionDurationSeconds(providerTokenRemainingLifeSeconds(NOW_SECONDS + 121, NOW) as number)).toBe(1);

    // The local `jwt_expiry` of 3600 seconds, at sign-in: a session of 3480
    // seconds, the contract's "about 58 minutes".
    expect(requestedLoginSessionDurationSeconds(providerTokenRemainingLifeSeconds(NOW_SECONDS + 3600, NOW) as number)).toBe(3480);

    // Malformed inputs.
    for (const [tokenExpiresAt, now] of [
      [0, NOW],
      [-1, NOW],
      [NOW_SECONDS + 0.5, NOW],
      [8_640_000_000_001, NOW],
      [Number.NaN, NOW],
      ["1791219600", NOW],
      [null, NOW],
      [NOW_SECONDS, -1],
      [NOW_SECONDS, NOW + 0.5],
      [NOW_SECONDS, 8_640_000_000_000_001],
      [NOW_SECONDS, Number.NaN],
      [NOW_SECONDS, `${NOW}`],
      [NOW_SECONDS, undefined],
    ] as ReadonlyArray<readonly [unknown, unknown]>) {
      expect(
        providerTokenRemainingLifeSeconds(tokenExpiresAt as number, now as number),
        `${String(tokenExpiresAt)} ${String(now)}`,
      ).toBeNull();
    }
  });
});

describe("loginSessionDuration - the session function's expires_at", () => {
  it("LSD-005 reads exactly the form PostgreSQL prints, with the exact instant, dropping digits past the millisecond", () => {
    const cases: ReadonlyArray<readonly [string, number]> = [
      ["2026-10-05T17:00:00+00:00", NOW],
      ["2026-10-05T17:00:00.5+00:00", NOW + 500],
      ["2026-10-05T17:00:00.05+00:00", NOW + 50],
      ["2026-10-05T17:00:00.123+00:00", NOW + 123],
      ["2026-10-05T17:00:00.123456+00:00", NOW + 123],
      ["2026-10-05T17:00:00.999999+00:00", NOW + 999],
      ["2026-10-05T17:00:00Z", NOW],
      ["2026-10-05T12:00:00-05:00", NOW],
      ["2026-10-05T22:30:00+05:30", NOW],
      ["2026-10-05T17:00:00-00:00", NOW],
      ["2024-02-29T00:00:00+00:00", Date.UTC(2024, 1, 29)],
      ["1970-01-01T00:00:00+00:00", 0],
      ["9999-12-31T23:59:59.999+00:00", Date.UTC(9999, 11, 31, 23, 59, 59, 999)],
    ];
    for (const [text, expected] of cases) {
      expect(parseLoginSessionExpiresAt(text), text).toBe(expected);
    }
    // Where both read it, the platform's own parser agrees.
    for (const text of ["2026-10-05T17:00:00.123+00:00", "2026-10-05T22:30:00+05:30", "2026-10-05T17:00:00Z"]) {
      expect(parseLoginSessionExpiresAt(text)).toBe(Date.parse(text));
    }
  });

  it("LSD-006 refuses everything else, including dates the platform's parser would roll over and a final line terminator", () => {
    const arabicIndicTwo = String.fromCharCode(0x0662);
    const refused: ReadonlyArray<unknown> = [
      NOW,
      null,
      undefined,
      new Date(NOW),
      {},
      ["2026-10-05T17:00:00+00:00"],
      "",
      "2026-10-05 17:00:00+00:00",
      "2026-10-05T17:00:00",
      "2026-10-05T17:00:00+00",
      "2026-10-05T17:00:00+0000",
      "2026-10-05T17:00:00.+00:00",
      "2026-10-05T17:00:00.1234567+00:00",
      "2026-10-05T17:00+00:00",
      "2026-10-5T17:00:00+00:00",
      // Calendar and clock values that do not exist; Date.parse rolls the
      // first two over to 1 and 2 March and the next day.
      "2026-02-29T00:00:00+00:00",
      "2026-02-30T00:00:00+00:00",
      "2026-10-05T24:00:00+00:00",
      "2026-13-01T00:00:00+00:00",
      "2026-00-10T00:00:00+00:00",
      "2026-10-00T00:00:00+00:00",
      "2026-10-32T00:00:00+00:00",
      "2026-10-05T23:60:00+00:00",
      "2026-10-05T23:59:60+00:00",
      "2026-10-05T17:00:00+24:00",
      "2026-10-05T17:00:00+00:60",
      // Before the epoch, a short year, and an expanded year.
      "1969-12-31T23:59:59+00:00",
      "0026-10-05T17:00:00+00:00",
      "+002026-10-05T17:00:00+00:00",
      // Letter case, spacing and other digits.
      "2026-10-05t17:00:00z",
      " 2026-10-05T17:00:00+00:00",
      "2026-10-05T17:00:00+00:00 ",
      `2026-10-05T17:00:00+00:0${arabicIndicTwo}`,
      `2026-10-05T17:00:00+00:00${String.fromCharCode(0)}`,
    ];
    for (const value of refused) {
      expect(parseLoginSessionExpiresAt(value), JSON.stringify(value) ?? String(value)).toBeNull();
    }
    for (const [name, terminator] of LINE_TERMINATORS) {
      expect(parseLoginSessionExpiresAt(`2026-10-05T17:00:00+00:00${terminator}`), name).toBeNull();
      // The same text without it is read.
      expect(parseLoginSessionExpiresAt("2026-10-05T17:00:00+00:00"), name).toBe(NOW);
    }
  });
});

describe("loginSessionDuration - the cookies' Max-Age (contract 25 Section 7; item 6)", () => {
  it("LSD-007 the Max-Age matches the returned expiry: the session's remaining life in whole seconds, rounding down, with no cap, and none under 1 or over 3600", () => {
    expect(loginSessionCookieMaxAgeSeconds(NOW + 3_480_000, NOW)).toBe(3480);
    expect(loginSessionCookieMaxAgeSeconds(NOW + 3_479_999, NOW)).toBe(3479);
    expect(loginSessionCookieMaxAgeSeconds(NOW + 2_000_500, NOW)).toBe(2000);
    // The Max-Age boundaries 0 and 1.
    expect(loginSessionCookieMaxAgeSeconds(NOW + 1_000, NOW)).toBe(1);
    expect(loginSessionCookieMaxAgeSeconds(NOW + 999, NOW)).toBeNull();
    expect(loginSessionCookieMaxAgeSeconds(NOW, NOW)).toBeNull();
    expect(loginSessionCookieMaxAgeSeconds(NOW - 1_000, NOW)).toBeNull();
    // The Max-Age boundaries 3600 and 3601: a remaining life of exactly 3600
    // seconds is 3600, and more than 3600 is refused, never capped.
    expect(loginSessionCookieMaxAgeSeconds(NOW + 3_600_000, NOW)).toBe(3600);
    expect(loginSessionCookieMaxAgeSeconds(NOW + 3_600_999, NOW)).toBe(3600);
    expect(loginSessionCookieMaxAgeSeconds(NOW + 3_601_000, NOW)).toBeNull();
    expect(loginSessionCookieMaxAgeSeconds(NOW + 86_400_000, NOW)).toBeNull();
  });

  it("LSD-008 does not cap the Max-Age at the requested duration: with this server's clock behind the database's it is the longer remaining life the expiry shows, and over 3600 it is refused; malformed inputs are refused", () => {
    // The database's clock ahead of this server's: its expiry is later than
    // this server would compute, and the Max-Age is the remaining life it
    // shows. 5 seconds ahead on a 3480-second session gives 3485, and 8
    // seconds ahead on a 1-second session gives 9.
    expect(loginSessionCookieMaxAgeSeconds(NOW + 3_485_000, NOW)).toBe(3485);
    expect(loginSessionCookieMaxAgeSeconds(NOW + 9_000, NOW)).toBe(9);
    // Behind instead: the shorter remaining life stands.
    expect(loginSessionCookieMaxAgeSeconds(NOW + 3_475_000, NOW)).toBe(3475);
    // 121 seconds ahead on a 3480-second session shows 3601 seconds, which no
    // session lasts: an abnormal state, refused.
    expect(loginSessionCookieMaxAgeSeconds(NOW + 3_601_000, NOW)).toBeNull();

    for (const [expiresAt, now] of [
      [NOW + 3_480_000.5, NOW],
      [-1, NOW],
      [8_640_000_000_000_001, NOW],
      [Number.NaN, NOW],
      [NOW + 3_480_000, -1],
      [NOW + 3_480_000, NOW + 0.5],
      [NOW + 3_480_000, Number.NaN],
      [NOW + 3_480_000, null],
      [`${NOW + 3_480_000}`, NOW],
    ] as ReadonlyArray<readonly [unknown, unknown]>) {
      expect(
        loginSessionCookieMaxAgeSeconds(expiresAt as number, now as number),
        `${String(expiresAt)} ${String(now)}`,
      ).toBeNull();
    }
  });

  it("LSD-009 reads no clock: every time is passed in", () => {
    const dateNow = vi.spyOn(Date, "now");
    const performanceNow = vi.spyOn(performance, "now");
    const results = [
      providerTokenRemainingLifeSeconds(NOW_SECONDS + 3600, NOW),
      requestedLoginSessionDurationSeconds(3600),
      parseLoginSessionExpiresAt("2026-10-05T17:58:00.123456+00:00"),
      loginSessionCookieMaxAgeSeconds(NOW + 3_480_123, NOW),
    ];
    const dateNowCalls = dateNow.mock.calls.length;
    const performanceNowCalls = performanceNow.mock.calls.length;
    expect(dateNowCalls).toBe(0);
    expect(performanceNowCalls).toBe(0);
    expect(results).toEqual([3600, 3480, NOW + 3_480_123, 3480]);
  });
});
