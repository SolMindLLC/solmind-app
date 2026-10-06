// Login step 6, sub-slice S6-2: the session-cookie policy.
//
// Source of truth: solmind-docs
// `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
// (contract 25), accepted by Paul on 2026-10-04 (AUTH-RLS-DEC-043):
//   - Section 4: one code path for every environment. The attribute set comes
//     from the scheme of the server-configured trusted origin. `https` gets
//     `Secure` and the `__Host-` name prefix. Plain `http` is allowed only
//     when the host is a loopback address (`127.0.0.1`, `::1` or
//     `localhost`), with no `Secure` and no prefix. Any other origin is a
//     configuration failure: no cookie is written and sign-in is denied.
//   - Section 5.2: the cookie names, and `HttpOnly`, `SameSite=Lax`, `Path=/`
//     and no `Domain` on every cookie.
//   - Section 6: the names the login-step writer may accept (the auth cookie
//     N and its chunks `N.0`, `N.1`, ...; for removals only,
//     `N-code-verifier` and its chunks), the removal attributes, and the
//     no-store headers on every response that sets or clears these cookies.
//   - Section 14, as Paul corrected it on 2026-10-05: the one shared format
//     check that every client reading the auth cookie applies before handing
//     it to the Supabase SSR library.
//
// Pure and dependency-free: no import, no IO, no environment read and no
// logging. Besides ECMAScript built-ins and the WHATWG `URL`, it
// uses one standard global, `TextDecoder`, only as a fatal UTF-8 check.
// The trusted origin is passed in by a server composition root,
// which loads it with the banked `loadTrustedApplicationOrigin()`. This
// module adds no setting and reads none.
//
// Chunk names follow the installed Supabase SSR library (0.12.0). It writes a
// value as `N` alone or as `N.0`, `N.1`, ..., it recognizes a chunk index
// only as `0` or a decimal with no leading zero, and its reader takes `N`
// when `N` has a non-empty value, and otherwise joins `N.0`, `N.1`, ... up to
// the first missing or empty chunk. It sets the Supabase auth client's
// storage key from `cookieOptions.name`, and that client (auth-js 2.108.2)
// stores its PKCE code verifier under the storage key plus `-code-verifier`,
// so with N as the name the verifier cookie is `N-code-verifier`.
//
// Dormant: only the dormant login-step cookie writer, beside the request-auth
// client, imports this module. Its readers to come are the per-request check
// (S6-4) and logout (S6-12). Keep it direct-import only and off every barrel.
//
// The library's decoder and the strict UTF-8 step. The installed library
// decodes a `base64-` value with its own base64url decoder
// (`stringFromBase64URL` in `dist/main/utils/base64url.js`) and passes any
// error that decoder throws to its warning. The decoder throws in three ways:
// for a character outside its alphabet, with a message that names the
// character and its position; with the fixed message "Invalid UTF-8
// sequence", for a byte 0x80 to 0xBF or 0xF8 to 0xFF where a sequence starts,
// or a byte below 0x80 inside one; and, from `String.fromCodePoint`, with a
// RangeError that names the number, when a four-byte sequence adds up to more
// than U+10FFFF. The character check keeps out the first. The strict UTF-8
// step keeps out the other two: it decodes the part after `base64-` into
// bytes exactly as the library's decoder does (6 bits a character, one byte
// for every 8 bits, and the 2, 4 or 6 bits left over at the end dropped) and
// refuses the value unless a fatal UTF-8 decoder accepts those bytes. The
// library's decoder throws on no well-formed UTF-8, so no decoder exception
// reaches its warning for a value this check returns. That is all the step
// claims. It does not show that the decoded value is JSON, which the library
// checks next with a separate warning that carries no part of the value, or
// that the session is authentic. As Section 14 requires, it also refuses some
// values the library would decode without an error: overlong forms,
// surrogate code points and a truncated last sequence.

// A cookie as a request carries it (the shape the request-cookie accessor
// and the Supabase SSR library's `getAll` use).
export type SessionCookieEntry = Readonly<{ name: string; value: string }>;

export type SessionCookieEnvironment = "hosted" | "loopback";

export type SessionCookiePolicy = Readonly<{
  environment: SessionCookieEnvironment;
  secure: boolean;
  authCookieName: string;
  bindingCookieName: string;
  codeVerifierCookieName: string;
}>;

// Every cookie the step 6 writer sets or clears gets exactly these keys: no
// `domain`, no `expires`, and never a `name` or `value` key.
export type SessionCookieAttributes = Readonly<{
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
}>;

export type SessionCookieHeader = Readonly<{ name: string; value: string }>;

// The result of the Section 14 format check. `cookies` is empty unless the
// status is `present`; then it holds frozen copies of the request's auth
// cookie and chunks only, which is all a reader may hand to the library.
export type SessionAuthCookieRead = Readonly<{
  status: "absent" | "malformed" | "present";
  cookies: ReadonlyArray<SessionCookieEntry>;
}>;

export const SESSION_AUTH_COOKIE_BASE_NAME = "solmind-auth";
export const SESSION_BINDING_COOKIE_BASE_NAME = "solmind-session";
export const SESSION_HOSTED_COOKIE_NAME_PREFIX = "__Host-";
export const SESSION_CODE_VERIFIER_NAME_SUFFIX = "-code-verifier";
export const SESSION_AUTH_COOKIE_VALUE_PREFIX = "base64-";

// A session lasts 1 to 3600 seconds (AUTH-RLS-DEC-039), so the remaining
// life a session cookie may be given is in that range too.
export const SESSION_COOKIE_MAX_AGE_LIMITS: Readonly<{ minimum: number; maximum: number }> =
  Object.freeze({ minimum: 1, maximum: 3600 });

// The headers of contract 25 F9c, which the Supabase SSR library hands to its
// cookie setter and the read-only request accessor ignores.
export const SESSION_COOKIE_NO_STORE_HEADERS: ReadonlyArray<SessionCookieHeader> = Object.freeze([
  Object.freeze({
    name: "Cache-Control",
    value: "private, no-cache, no-store, must-revalidate, max-age=0",
  }),
  Object.freeze({ name: "Expires", value: "0" }),
  Object.freeze({ name: "Pragma", value: "no-cache" }),
]);

function policyFor(
  environment: SessionCookieEnvironment,
  secure: boolean,
  prefix: string,
): SessionCookiePolicy {
  const authCookieName = `${prefix}${SESSION_AUTH_COOKIE_BASE_NAME}`;
  const policy: SessionCookiePolicy = {
    environment,
    secure,
    authCookieName,
    bindingCookieName: `${prefix}${SESSION_BINDING_COOKIE_BASE_NAME}`,
    codeVerifierCookieName: `${authCookieName}${SESSION_CODE_VERIFIER_NAME_SUFFIX}`,
  };
  return Object.freeze(policy);
}

// The only two policies. Every function below accepts only these exact
// objects, so a look-alike object cannot choose names or drop `Secure`.
const HOSTED_POLICY = policyFor("hosted", true, SESSION_HOSTED_COOKIE_NAME_PREFIX);
const LOOPBACK_POLICY = policyFor("loopback", false, "");

// Hostnames as the WHATWG URL parser gives them; `::1` keeps its brackets.
const LOOPBACK_HOSTNAMES: ReadonlyArray<string> = Object.freeze([
  "127.0.0.1",
  "[::1]",
  "localhost",
]);

function removalAttributesFor(policy: SessionCookiePolicy): SessionCookieAttributes {
  const attributes: SessionCookieAttributes = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: policy.secure,
    maxAge: 0,
  };
  return Object.freeze(attributes);
}

const HOSTED_REMOVAL_ATTRIBUTES = removalAttributesFor(HOSTED_POLICY);
const LOOPBACK_REMOVAL_ATTRIBUTES = removalAttributesFor(LOOPBACK_POLICY);

// A chunk index as the library's chunker recognizes it: `0`, or a decimal
// with no leading zero. No `m` flag, so `$` matches only at the very end.
const CHUNK_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;

// Section 14's character set: A-Z, a-z, 0-9, `-` and `_`, which covers the
// `base64-` start. No `m` flag, so a final line terminator is refused.
const AUTH_COOKIE_CHARACTER_PATTERN = /^[A-Za-z0-9_-]*$/;

function authCookieRead(
  status: SessionAuthCookieRead["status"],
  cookies: ReadonlyArray<SessionCookieEntry>,
): SessionAuthCookieRead {
  const read: SessionAuthCookieRead = { status, cookies: Object.freeze(cookies.slice()) };
  return Object.freeze(read);
}

const AUTH_COOKIE_ABSENT = authCookieRead("absent", []);
const AUTH_COOKIE_MALFORMED = authCookieRead("malformed", []);

// Resolves the policy from the trusted origin, or null for a configuration
// failure. Only the canonical origin form is accepted, exactly as
// `loadTrustedApplicationOrigin()` returns it (scheme and host in lower
// case, no default port, no path, user or trailing slash).
export function resolveSessionCookiePolicy(trustedOrigin: unknown): SessionCookiePolicy | null {
  if (typeof trustedOrigin !== "string" || trustedOrigin.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trustedOrigin);
  } catch {
    return null;
  }
  if (parsed.origin !== trustedOrigin) {
    return null;
  }
  if (parsed.protocol === "https:") {
    return HOSTED_POLICY;
  }
  if (parsed.protocol === "http:" && LOOPBACK_HOSTNAMES.includes(parsed.hostname)) {
    return LOOPBACK_POLICY;
  }
  return null;
}

export function isSessionCookiePolicy(value: unknown): value is SessionCookiePolicy {
  return value === HOSTED_POLICY || value === LOOPBACK_POLICY;
}

export function isSessionCookieMaxAge(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= SESSION_COOKIE_MAX_AGE_LIMITS.minimum &&
    value <= SESSION_COOKIE_MAX_AGE_LIMITS.maximum
  );
}

// The attributes of a session write: the session's remaining life as
// Max-Age, in place of the library's 400 days. Null for anything else.
export function sessionCookieWriteAttributes(
  policy: SessionCookiePolicy,
  maxAgeSeconds: number,
): SessionCookieAttributes | null {
  if (!isSessionCookiePolicy(policy) || !isSessionCookieMaxAge(maxAgeSeconds)) {
    return null;
  }
  const attributes: SessionCookieAttributes = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: policy.secure,
    maxAge: maxAgeSeconds,
  };
  return Object.freeze(attributes);
}

// The attributes of a removal: an empty value is written with Max-Age 0 and
// the same attributes, `Secure` included when hosted. It never gets the
// session's lifetime.
export function sessionCookieRemovalAttributes(
  policy: SessionCookiePolicy,
): SessionCookieAttributes | null {
  if (policy === HOSTED_POLICY) {
    return HOSTED_REMOVAL_ATTRIBUTES;
  }
  if (policy === LOOPBACK_POLICY) {
    return LOOPBACK_REMOVAL_ATTRIBUTES;
  }
  return null;
}

function isChunkFamilyName(baseName: string, name: unknown): boolean {
  if (typeof name !== "string") {
    return false;
  }
  if (name === baseName) {
    return true;
  }
  const chunkPrefix = `${baseName}.`;
  return name.startsWith(chunkPrefix) && CHUNK_INDEX_PATTERN.test(name.slice(chunkPrefix.length));
}

// N or one of its chunks `N.0`, `N.1`, ...
export function isSessionAuthCookieName(policy: SessionCookiePolicy, name: unknown): boolean {
  return isSessionCookiePolicy(policy) && isChunkFamilyName(policy.authCookieName, name);
}

// `N-code-verifier` or one of its chunks.
export function isSessionCodeVerifierCookieName(
  policy: SessionCookiePolicy,
  name: unknown,
): boolean {
  return isSessionCookiePolicy(policy) && isChunkFamilyName(policy.codeVerifierCookieName, name);
}

function readCookieEntry(value: unknown, allowOptions: boolean): SessionCookieEntry | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key !== "name" && key !== "value" && !(allowOptions && key === "options")) {
      return null;
    }
  }
  const name = Object.getOwnPropertyDescriptor(value, "name");
  const cookieValue = Object.getOwnPropertyDescriptor(value, "value");
  if (
    name === undefined ||
    cookieValue === undefined ||
    !Object.prototype.hasOwnProperty.call(name, "value") ||
    !Object.prototype.hasOwnProperty.call(cookieValue, "value") ||
    typeof name.value !== "string" ||
    typeof cookieValue.value !== "string"
  ) {
    return null;
  }
  return Object.freeze({ name: name.value, value: cookieValue.value });
}

// A frozen copy of a list of cookies, read through own data properties only,
// so no getter or setter runs; anything else gives null. Each entry must be a
// plain object with exactly `name` and `value` strings. With `allowOptions`,
// an entry may also carry an `options` key, as the Supabase SSR library's
// cookie setter receives it; that key is never read.
export function readSessionCookieEntries(
  value: unknown,
  allowOptions: boolean,
): ReadonlyArray<SessionCookieEntry> | null {
  try {
    if (!Array.isArray(value)) {
      return null;
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    const length: unknown = lengthDescriptor === undefined ? undefined : lengthDescriptor.value;
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
      return null;
    }
    const entries: SessionCookieEntry[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        return null;
      }
      const entry = readCookieEntry(descriptor.value, allowOptions);
      if (entry === null) {
        return null;
      }
      entries.push(entry);
    }
    return Object.freeze(entries);
  } catch {
    return null;
  }
}

// Joins the auth cookie exactly as the library's reader does: N when its
// value is non-empty, otherwise `N.0`, `N.1`, ... up to the first missing or
// empty chunk. For a repeated name the first one counts, as in the library.
function joinAuthCookie(
  baseName: string,
  family: ReadonlyArray<SessionCookieEntry>,
): string | null {
  const valueOf = (name: string): string | null => {
    const match = family.find((entry) => entry.name === name);
    return match === undefined ? null : match.value;
  };
  const whole = valueOf(baseName);
  if (whole !== null && whole.length > 0) {
    return whole;
  }
  const values: string[] = [];
  for (let index = 0; index < family.length; index += 1) {
    const chunk = valueOf(`${baseName}.${index}`);
    if (chunk === null || chunk.length === 0) {
      break;
    }
    values.push(chunk);
  }
  return values.length > 0 ? values.join("") : null;
}

// The 6-bit value of a base64url character, as the library's decoder maps
// it (A-Z, a-z, 0-9, `-`, `_` give 0 to 63), or -1 for any other character.
function base64UrlSextet(code: number): number {
  if (code >= 0x41 && code <= 0x5a) {
    return code - 0x41;
  }
  if (code >= 0x61 && code <= 0x7a) {
    return code - 0x61 + 26;
  }
  if (code >= 0x30 && code <= 0x39) {
    return code - 0x30 + 52;
  }
  if (code === 0x2d) {
    return 62;
  }
  if (code === 0x5f) {
    return 63;
  }
  return -1;
}

// The strict UTF-8 step of Section 14: true only when the part after
// `base64-`, decoded into bytes exactly as the library's decoder does, is
// well-formed UTF-8. The bytes come out of the same bit queue as the
// library's: each character adds 6 bits, a byte is taken whenever 8 bits are
// queued, and the bits left over at the end are dropped. A fatal UTF-8
// decoder then judges them; it refuses overlong forms, surrogate code points,
// code points above U+10FFFF, a truncated sequence and a stray continuation
// byte. Its error, which carries no value, is dropped here, and so is the
// decoded text. Any character outside the alphabet (already refused by the
// character check) or a missing `TextDecoder` also gives false.
function decodesToStrictUtf8(payload: string): boolean {
  const bytes = new Uint8Array(Math.floor((payload.length * 6) / 8));
  let queue = 0;
  let queuedBits = 0;
  let byteCount = 0;
  for (let index = 0; index < payload.length; index += 1) {
    const sextet = base64UrlSextet(payload.charCodeAt(index));
    if (sextet < 0) {
      return false;
    }
    queue = ((queue << 6) | sextet) & 0x3fff;
    queuedBits += 6;
    if (queuedBits >= 8) {
      queuedBits -= 8;
      bytes[byteCount] = (queue >> queuedBits) & 0xff;
      byteCount += 1;
    }
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

// Contract 25 Section 14, the one shared format check, as Paul corrected it
// on 2026-10-05. Every chunk of the auth cookie in the request (N and every
// `N.i`, whether or not the library would read it) must hold only A-Z, a-z,
// 0-9, `-` and `_`; the value the library would join must start with
// `base64-`; and the part after `base64-`, decoded as base64url exactly as
// the library decodes it, must be strictly valid UTF-8. Otherwise the auth
// cookie is treated as absent (deny): the status is `malformed` and no cookie
// is returned. `absent` means the library would find no value. Nothing here
// keeps, logs or returns any part of a refused value.
export function readSessionAuthCookies(
  policy: SessionCookiePolicy,
  requestCookies: unknown,
): SessionAuthCookieRead {
  if (!isSessionCookiePolicy(policy)) {
    return AUTH_COOKIE_MALFORMED;
  }
  const entries = readSessionCookieEntries(requestCookies, false);
  if (entries === null) {
    return AUTH_COOKIE_MALFORMED;
  }
  const family = entries.filter((entry) => isChunkFamilyName(policy.authCookieName, entry.name));
  if (family.some((entry) => !AUTH_COOKIE_CHARACTER_PATTERN.test(entry.value))) {
    return AUTH_COOKIE_MALFORMED;
  }
  const joined = joinAuthCookie(policy.authCookieName, family);
  if (joined === null) {
    return AUTH_COOKIE_ABSENT;
  }
  if (!joined.startsWith(SESSION_AUTH_COOKIE_VALUE_PREFIX)) {
    return AUTH_COOKIE_MALFORMED;
  }
  if (!decodesToStrictUtf8(joined.slice(SESSION_AUTH_COOKIE_VALUE_PREFIX.length))) {
    return AUTH_COOKIE_MALFORMED;
  }
  return authCookieRead("present", family);
}
