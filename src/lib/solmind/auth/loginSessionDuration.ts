// Login step 6, sub-slice S6-6: the login session's duration rule.
//
// Source of truth: solmind-docs
// `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
// (contract 25), accepted by Paul on 2026-10-04 (AUTH-RLS-DEC-043), Section 7
// (the expiry margin) and Section 15 item 6:
//   - "The requested duration is the provider access token's remaining life in
//     whole seconds, minus 120, capped at 3600. If that is under 1, the login
//     is denied." The 120 seconds are the auth library's 90-second refresh
//     window plus 30 for clock difference and request time, so a demo session
//     lasts about 58 minutes;
//   - "The auth and binding cookies get a Max-Age equal to the SolMind
//     session's remaining life, worked out from the `expires_at` the function
//     returns."
// AUTH-RLS-DEC-039 bounds the requested duration to 1..3600 seconds and has
// the database compute `expires_at` from its own clock; the caller must
// request no more than the provider token's actual lifetime.
//
// Pure and dependency-free: no import, no IO, no clock, no environment read
// and no logging. Every time is passed in, so the server caller decides when
// "now" is. Every function returns null instead of throwing, and null always
// means that no session may be requested or no cookie written.
//
// Whole seconds round down everywhere, so neither the remaining life nor the
// Max-Age is ever overstated.
//
// The Max-Age is the session's remaining life worked out from the returned
// `expires_at`, as contract 25 Sections 6 and 7 say, with no cap. A session
// cookie may be given only 1 to 3600 seconds (the session bound of
// AUTH-RLS-DEC-039, which login step 6's cookie writer of sub-slice S6-2 also
// accepts), so a remaining life outside that range gives null: under 1
// second no cookie may be written, and over 3600 seconds, which only this
// server's clock running behind the database's can show, is an abnormal state.
//
// Dormant: only the dormant session-creation caller of this sub-slice, in
// `../supabase/`, imports this module. Keep it direct-import only and off
// every barrel.

export const LOGIN_SESSION_DURATION_LIMITS: Readonly<{
  expiryMarginSeconds: number;
  minimumSeconds: number;
  maximumSeconds: number;
}> = Object.freeze({
  expiryMarginSeconds: 120,
  minimumSeconds: 1,
  maximumSeconds: 3600,
});

// The largest instant a JavaScript Date can hold: 8.64e15 milliseconds, that
// is 8.64e12 seconds, after the epoch. Both bounds keep every product below a
// safe integer.
const MAXIMUM_EPOCH_MILLISECONDS = 8_640_000_000_000_000;
const MAXIMUM_EPOCH_SECONDS = 8_640_000_000_000;

// `expires_at` as PostgreSQL prints a `timestamptz` in JSON: the date, `T`,
// the time, up to six fraction digits, and an offset (`+00:00` on Supabase;
// `Z` is also accepted). `\d` is ASCII only without the `u` flag, and with no
// `m` flag `$` matches only at the very end, so a final line terminator is
// refused.
const EXPIRES_AT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function isWholeNumberInRange(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

// The provider access token's remaining life in whole seconds, rounded down,
// from the token's expiry (epoch seconds, as the token and the auth library
// give it) and the current time (epoch milliseconds). It may be zero or
// negative; null means an input was not a whole number in range.
export function providerTokenRemainingLifeSeconds(
  providerTokenExpiresAtSeconds: number,
  nowMilliseconds: number,
): number | null {
  if (
    !isWholeNumberInRange(providerTokenExpiresAtSeconds, 1, MAXIMUM_EPOCH_SECONDS) ||
    !isWholeNumberInRange(nowMilliseconds, 0, MAXIMUM_EPOCH_MILLISECONDS)
  ) {
    return null;
  }
  return Math.floor((providerTokenExpiresAtSeconds * 1000 - nowMilliseconds) / 1000);
}

// Contract 25 Section 7: the remaining life minus 120, capped at 3600. Null
// when that is under 1 (the login is denied) or when the input is not a whole
// number.
export function requestedLoginSessionDurationSeconds(
  providerTokenRemainingLife: number,
): number | null {
  if (typeof providerTokenRemainingLife !== "number" || !Number.isSafeInteger(providerTokenRemainingLife)) {
    return null;
  }
  const duration = providerTokenRemainingLife - LOGIN_SESSION_DURATION_LIMITS.expiryMarginSeconds;
  if (duration < LOGIN_SESSION_DURATION_LIMITS.minimumSeconds) {
    return null;
  }
  return Math.min(duration, LOGIN_SESSION_DURATION_LIMITS.maximumSeconds);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// The session function's `expires_at` as epoch milliseconds, or null for
// anything that is not exactly the printed form above with a real calendar
// date and time. Fraction digits past the third are dropped (rounding down).
// Years before 1970 are refused: no session expires then, and `Date.UTC`
// would read a two-digit year as 1900-something.
export function parseLoginSessionExpiresAt(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = EXPIRES_AT_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? "";
  const sign = match[8];
  const offsetHours = sign === undefined ? 0 : Number(match[9]);
  const offsetMinutes = sign === undefined ? 0 : Number(match[10]);
  if (
    year < 1970 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHours > 23 ||
    offsetMinutes > 59
  ) {
    return null;
  }
  const milliseconds = fraction === "" ? 0 : Number(`${fraction}00`.slice(0, 3));
  const offset = (offsetHours * 60 + offsetMinutes) * 60_000 * (sign === "-" ? -1 : 1);
  const instant = Date.UTC(year, month - 1, day, hour, minute, second, milliseconds) - offset;
  return Number.isSafeInteger(instant) ? instant : null;
}

// Contract 25 Section 7: the cookies' Max-Age, from the session's expiry and
// the current time (both epoch milliseconds): the session's remaining life in
// whole seconds, rounded down, with no cap. Null when that is under 1 second,
// so no cookie is written with a lifetime of 0 or less; when it is over 3600
// seconds (see the module comment); or when an input is not a whole number in
// range.
export function loginSessionCookieMaxAgeSeconds(
  sessionExpiresAtMilliseconds: number,
  nowMilliseconds: number,
): number | null {
  if (
    !isWholeNumberInRange(sessionExpiresAtMilliseconds, 0, MAXIMUM_EPOCH_MILLISECONDS) ||
    !isWholeNumberInRange(nowMilliseconds, 0, MAXIMUM_EPOCH_MILLISECONDS)
  ) {
    return null;
  }
  const remaining = Math.floor((sessionExpiresAtMilliseconds - nowMilliseconds) / 1000);
  if (
    remaining < LOGIN_SESSION_DURATION_LIMITS.minimumSeconds ||
    remaining > LOGIN_SESSION_DURATION_LIMITS.maximumSeconds
  ) {
    return null;
  }
  return remaining;
}
