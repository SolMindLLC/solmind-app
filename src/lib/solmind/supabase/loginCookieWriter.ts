import "server-only";

import {
  SESSION_COOKIE_NO_STORE_HEADERS,
  isSessionAuthCookieName,
  isSessionCodeVerifierCookieName,
  isSessionCookieMaxAge,
  readSessionCookieEntries,
  resolveSessionCookiePolicy,
  sessionCookieRemovalAttributes,
  sessionCookieWriteAttributes,
  type SessionCookieAttributes,
  type SessionCookieEntry,
  type SessionCookiePolicy,
} from "../auth/sessionCookiePolicy";

// Login step 6, sub-slice S6-2: the login-step cookie writer.
//
// Source of truth: solmind-docs
// `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
// (contract 25), accepted by Paul on 2026-10-04 (AUTH-RLS-DEC-043): Section
// 6's writer rules, with the names and attributes of Sections 4 and 5.2 from
// `../auth/sessionCookiePolicy.ts`.
//
// At login. The route holds, in memory only, the cookies the Supabase SSR
// library hands to its cookie setter after sign-in (that hold is S6-7's).
// Only after the session function has returned `created`, or `existing` for
// this exact flow, the route calls `writeLoginSessionCookies` with the held
// cookies, the request's cookies, the session UUID the database returned,
// and the session's remaining life in whole seconds (S6-6 works it out from
// `expires_at`). The writer then:
//   - accepts only the auth cookie N and its chunks `N.0`, `N.1`, ..., and,
//     for removals only, `N-code-verifier` and its chunks. Any other name, a
//     non-empty code verifier, a name given twice, or writes that do not form
//     one complete session value (N alone, or `N.0` to `N.k` with no gap and
//     no N) deny the login: nothing is written, and the route runs its
//     cleanup;
//   - writes an empty value as a removal (empty value, Max-Age 0, `Path=/`,
//     `HttpOnly`, `SameSite=Lax`, and `Secure` when hosted). A removal never
//     gets the session's lifetime;
//   - writes each session chunk with Max-Age equal to the session's
//     remaining life (1 to 3600 seconds, since AUTH-RLS-DEC-039 caps a
//     session at 3600), in place of the library's 400 days, with the same
//     attributes and, when hosted, `Secure` and the `__Host-` names;
//   - writes the session-binding cookie with the database's session UUID. It
//     never reads the request's binding cookie, so a client-supplied session
//     id is never used;
//   - clears, as removals, every other auth chunk and every code-verifier
//     cookie the request carries (fixation: the cookie-less hold cannot see
//     them, so the library's own clearing does not reach them);
//   - sets the three no-store headers before any cookie.
//
// At logout. `writeLogoutSessionCookieClears` writes removals only. It plans
// the fixed clears of N, `N-code-verifier` and the binding cookie regardless
// of earlier authentication or provider outcomes, and adds permitted names
// from readable cookie lists: every auth chunk and code-verifier cookie the
// request carries and every removal the library handed over for an allowed
// name. A non-empty value, or any other name, is not written. Invalid
// configuration or a malformed call denies before writing. A response-setter
// exception can stop the clears partway and returns `failed`.
//
// Where it lives. Contract 25 Section 6 puts the writer in the same
// request-auth adapter layer as the request-auth client, given the
// response's cookie store by the route's composition root, with the
// per-request accessor left read-only (AUTH-RLS-DEC-012, DEC-013 and DEC-019).
// This module imports no Supabase or Next.js module: the composition root
// hands it the response, anything with `cookies.set` and `headers.set` (a
// Next.js response has both), so the framework call stays at the root. A
// removal is always a `set` with Max-Age 0, never the framework's delete,
// which drops `Secure` (contract 25 F3).
//
// Results are frozen, closed and value-free; nothing throws and nothing
// logs. If the response throws while it is being written, the result is
// `failed` and that response may already hold some of the cookies: the
// composition root must discard it and send a fresh deny response instead.
//
// Dormant: no route, page, middleware or other caller imports this module,
// and it writes nothing at runtime. Keep it server-only, direct-import only
// and off every barrel.

// One cookie as the Supabase SSR library hands it to its cookie setter. The
// `options` it carries are never read: the writer chooses every attribute.
export type HeldSessionCookie = Readonly<{ name: string; value: string; options?: unknown }>;

// The part of a response the writer uses. A Next.js response satisfies it.
export type SessionCookieResponse = Readonly<{
  cookies: { set(name: string, value: string, attributes: SessionCookieAttributes): unknown };
  headers: { set(name: string, value: string): unknown };
}>;

export type LoginSessionCookieWrite = Readonly<{
  trustedOrigin: string;
  heldCookies: ReadonlyArray<HeldSessionCookie>;
  requestCookies: ReadonlyArray<SessionCookieEntry>;
  sessionId: string;
  maxAgeSeconds: number;
  response: SessionCookieResponse;
}>;

export type LoginSessionCookieDenialReason = "configuration" | "held_cookies" | "request";

export type LoginSessionCookieWriteResult = Readonly<
  | { outcome: "written" }
  | { outcome: "denied"; reason: LoginSessionCookieDenialReason }
  | { outcome: "failed" }
>;

export type LogoutSessionCookieClear = Readonly<{
  trustedOrigin: string;
  heldCookies: ReadonlyArray<HeldSessionCookie>;
  requestCookies: ReadonlyArray<SessionCookieEntry>;
  response: SessionCookieResponse;
}>;

export type LogoutSessionCookieDenialReason = "configuration" | "request";

// `ignoredInput` is true when a held cookie was not written (a non-empty
// value or a name outside the allow-list), or when the held or request list
// could not be read; the fixed clears still ran.
export type LogoutSessionCookieClearResult = Readonly<
  | { outcome: "cleared"; ignoredInput: boolean }
  | { outcome: "denied"; reason: LogoutSessionCookieDenialReason }
  | { outcome: "failed" }
>;

type CookieWrite = Readonly<{ name: string; value: string; attributes: SessionCookieAttributes }>;

type ResponseWriters = Readonly<{
  setCookie: (name: string, value: string, attributes: SessionCookieAttributes) => void;
  setHeader: (name: string, value: string) => void;
}>;

type WritePlan = Readonly<{ writers: ResponseWriters; writes: ReadonlyArray<CookieWrite> }>;

function loginResult(result: LoginSessionCookieWriteResult): LoginSessionCookieWriteResult {
  return Object.freeze(result);
}

function logoutResult(result: LogoutSessionCookieClearResult): LogoutSessionCookieClearResult {
  return Object.freeze(result);
}

const LOGIN_WRITTEN = loginResult({ outcome: "written" });
const LOGIN_DENIED_CONFIGURATION = loginResult({ outcome: "denied", reason: "configuration" });
const LOGIN_DENIED_HELD_COOKIES = loginResult({ outcome: "denied", reason: "held_cookies" });
const LOGIN_DENIED_REQUEST = loginResult({ outcome: "denied", reason: "request" });
const LOGIN_FAILED = loginResult({ outcome: "failed" });

const LOGOUT_CLEARED = logoutResult({ outcome: "cleared", ignoredInput: false });
const LOGOUT_CLEARED_IGNORING_INPUT = logoutResult({ outcome: "cleared", ignoredInput: true });
const LOGOUT_DENIED_CONFIGURATION = logoutResult({ outcome: "denied", reason: "configuration" });
const LOGOUT_DENIED_REQUEST = logoutResult({ outcome: "denied", reason: "request" });
const LOGOUT_FAILED = logoutResult({ outcome: "failed" });

const LOGIN_INPUT_KEYS: ReadonlyArray<string> = Object.freeze([
  "trustedOrigin",
  "heldCookies",
  "requestCookies",
  "sessionId",
  "maxAgeSeconds",
  "response",
]);
const LOGOUT_INPUT_KEYS: ReadonlyArray<string> = Object.freeze([
  "trustedOrigin",
  "heldCookies",
  "requestCookies",
  "response",
]);

// The session UUID exactly as PostgreSQL prints a `uuid`: lowercase
// canonical form. No `m` flag, so a final line terminator is refused.
const CANONICAL_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Reads exactly the listed keys of a plain object through own data property
// descriptors only, so no getter, setter or Proxy `get` trap runs. Returns
// null for anything else; an exception is dropped unread.
function readExactDataProperties(
  value: unknown,
  keys: ReadonlyArray<string>,
): ReadonlyMap<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      !ownKeys.every(
        (key) =>
          typeof key === "string" &&
          keys.includes(key) &&
          Object.prototype.propertyIsEnumerable.call(value, key),
      )
    ) {
      return null;
    }
    const fields = new Map<string, unknown>();
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        return null;
      }
      fields.set(key, descriptor.value);
    }
    return fields;
  } catch {
    return null;
  }
}

// Captures the response's two setters once, bound to their own stores. The
// response's `cookies` and `headers` are read as ordinary properties, because
// a Next.js response exposes them through getters.
function readResponse(value: unknown): ResponseWriters | null {
  try {
    if (value === null || typeof value !== "object") {
      return null;
    }
    const cookieStore: unknown = Reflect.get(value, "cookies");
    const headerStore: unknown = Reflect.get(value, "headers");
    if (
      cookieStore === null ||
      typeof cookieStore !== "object" ||
      headerStore === null ||
      typeof headerStore !== "object"
    ) {
      return null;
    }
    const setCookie: unknown = Reflect.get(cookieStore, "set");
    const setHeader: unknown = Reflect.get(headerStore, "set");
    if (typeof setCookie !== "function" || typeof setHeader !== "function") {
      return null;
    }
    const writers: ResponseWriters = {
      setCookie: (name, cookieValue, attributes) => {
        Reflect.apply(setCookie, cookieStore, [name, cookieValue, attributes]);
      },
      setHeader: (name, headerValue) => {
        Reflect.apply(setHeader, headerStore, [name, headerValue]);
      },
    };
    return Object.freeze(writers);
  } catch {
    return null;
  }
}

// The no-store headers first, then every cookie, in plan order. False if the
// response threw; the exception is dropped unread.
function applyPlan(plan: WritePlan): boolean {
  try {
    for (const header of SESSION_COOKIE_NO_STORE_HEADERS) {
      plan.writers.setHeader(header.name, header.value);
    }
    for (const write of plan.writes) {
      plan.writers.setCookie(write.name, write.value, write.attributes);
    }
    return true;
  } catch {
    return false;
  }
}

function isAllowedRemovalName(policy: SessionCookiePolicy, name: string): boolean {
  return isSessionAuthCookieName(policy, name) || isSessionCodeVerifierCookieName(policy, name);
}

type HeldClassification = Readonly<{
  sessionWrites: ReadonlyArray<SessionCookieEntry>;
  removals: ReadonlyArray<string>;
}>;

// The login allow-list and the complete-value rule. Null denies the login.
function classifyHeldLoginCookies(
  policy: SessionCookiePolicy,
  held: ReadonlyArray<SessionCookieEntry>,
): HeldClassification | null {
  const seen = new Set<string>();
  const writes = new Map<string, string>();
  const removals: string[] = [];
  for (const entry of held) {
    if (seen.has(entry.name)) {
      return null;
    }
    seen.add(entry.name);
    if (entry.value === "") {
      if (!isAllowedRemovalName(policy, entry.name)) {
        return null;
      }
      removals.push(entry.name);
    } else {
      // A non-empty value is a session write, accepted only for N or its
      // chunks; a non-empty code verifier, or any other name, denies.
      if (!isSessionAuthCookieName(policy, entry.name)) {
        return null;
      }
      writes.set(entry.name, entry.value);
    }
  }
  const sessionWrites = completeSessionValue(policy.authCookieName, writes);
  if (sessionWrites === null) {
    return null;
  }
  return Object.freeze({ sessionWrites, removals: Object.freeze(removals) });
}

// One complete session value: N alone, or `N.0` to `N.k` with no gap and no
// N. The writes are already unique names of N's family, so requiring `N.0`
// to `N.(count - 1)` to be present rules out a gap and any extra chunk.
function completeSessionValue(
  baseName: string,
  writes: ReadonlyMap<string, string>,
): ReadonlyArray<SessionCookieEntry> | null {
  if (writes.size === 0) {
    return null;
  }
  const whole = writes.get(baseName);
  if (whole !== undefined) {
    return writes.size === 1 ? Object.freeze([Object.freeze({ name: baseName, value: whole })]) : null;
  }
  const ordered: SessionCookieEntry[] = [];
  for (let index = 0; index < writes.size; index += 1) {
    const name = `${baseName}.${index}`;
    const value = writes.get(name);
    if (value === undefined) {
      return null;
    }
    ordered.push(Object.freeze({ name, value }));
  }
  return Object.freeze(ordered);
}

type LoginPlanOrResult =
  | Readonly<{ kind: "plan"; plan: WritePlan }>
  | Readonly<{ kind: "result"; result: LoginSessionCookieWriteResult }>;

function loginDecision(result: LoginSessionCookieWriteResult): LoginPlanOrResult {
  return Object.freeze({ kind: "result", result });
}

function planLoginWrite(input: unknown): LoginPlanOrResult {
  const fields = readExactDataProperties(input, LOGIN_INPUT_KEYS);
  if (fields === null) {
    return loginDecision(LOGIN_DENIED_REQUEST);
  }
  const policy = resolveSessionCookiePolicy(fields.get("trustedOrigin"));
  if (policy === null) {
    return loginDecision(LOGIN_DENIED_CONFIGURATION);
  }
  const sessionId = fields.get("sessionId");
  const maxAgeSeconds = fields.get("maxAgeSeconds");
  if (
    typeof sessionId !== "string" ||
    !CANONICAL_SESSION_ID_PATTERN.test(sessionId) ||
    !isSessionCookieMaxAge(maxAgeSeconds)
  ) {
    return loginDecision(LOGIN_DENIED_REQUEST);
  }
  const writeAttributes = sessionCookieWriteAttributes(policy, maxAgeSeconds);
  const removalAttributes = sessionCookieRemovalAttributes(policy);
  const writers = readResponse(fields.get("response"));
  const requestCookies = readSessionCookieEntries(fields.get("requestCookies"), false);
  if (
    writeAttributes === null ||
    removalAttributes === null ||
    writers === null ||
    requestCookies === null
  ) {
    return loginDecision(LOGIN_DENIED_REQUEST);
  }
  const held = readSessionCookieEntries(fields.get("heldCookies"), true);
  const classified = held === null ? null : classifyHeldLoginCookies(policy, held);
  if (classified === null) {
    return loginDecision(LOGIN_DENIED_HELD_COOKIES);
  }

  const writtenNames = new Set(classified.sessionWrites.map((write) => write.name));
  const removalNames = new Set<string>();
  for (const name of classified.removals) {
    if (!writtenNames.has(name)) {
      removalNames.add(name);
    }
  }
  // Fixation: every other auth chunk and code-verifier cookie in the
  // request is cleared. The request's binding cookie is replaced below.
  for (const cookie of requestCookies) {
    if (isAllowedRemovalName(policy, cookie.name) && !writtenNames.has(cookie.name)) {
      removalNames.add(cookie.name);
    }
  }

  const writes: CookieWrite[] = [];
  for (const name of removalNames) {
    writes.push(Object.freeze({ name, value: "", attributes: removalAttributes }));
  }
  for (const write of classified.sessionWrites) {
    writes.push(Object.freeze({ name: write.name, value: write.value, attributes: writeAttributes }));
  }
  writes.push(
    Object.freeze({ name: policy.bindingCookieName, value: sessionId, attributes: writeAttributes }),
  );
  return Object.freeze({
    kind: "plan",
    plan: Object.freeze({ writers, writes: Object.freeze(writes) }),
  });
}

// Writes a successful login's cookies to the response, or writes nothing and
// denies. See the module comment for the rules.
export function writeLoginSessionCookies(
  input: LoginSessionCookieWrite,
): LoginSessionCookieWriteResult {
  let decision: LoginPlanOrResult;
  try {
    decision = planLoginWrite(input);
  } catch {
    return LOGIN_DENIED_REQUEST;
  }
  if (decision.kind === "result") {
    return decision.result;
  }
  return applyPlan(decision.plan) ? LOGIN_WRITTEN : LOGIN_FAILED;
}

type LogoutPlanOrResult =
  | Readonly<{ kind: "plan"; plan: WritePlan; ignoredInput: boolean }>
  | Readonly<{ kind: "result"; result: LogoutSessionCookieClearResult }>;

function logoutDecision(result: LogoutSessionCookieClearResult): LogoutPlanOrResult {
  return Object.freeze({ kind: "result", result });
}

function planLogoutClears(input: unknown): LogoutPlanOrResult {
  const fields = readExactDataProperties(input, LOGOUT_INPUT_KEYS);
  if (fields === null) {
    return logoutDecision(LOGOUT_DENIED_REQUEST);
  }
  const policy = resolveSessionCookiePolicy(fields.get("trustedOrigin"));
  if (policy === null) {
    return logoutDecision(LOGOUT_DENIED_CONFIGURATION);
  }
  const removalAttributes = sessionCookieRemovalAttributes(policy);
  const writers = readResponse(fields.get("response"));
  if (removalAttributes === null || writers === null) {
    return logoutDecision(LOGOUT_DENIED_REQUEST);
  }

  let ignoredInput = false;
  const removalNames = new Set<string>([
    policy.authCookieName,
    policy.codeVerifierCookieName,
    policy.bindingCookieName,
  ]);
  const held = readSessionCookieEntries(fields.get("heldCookies"), true);
  if (held === null) {
    ignoredInput = true;
  } else {
    for (const entry of held) {
      if (entry.value === "" && isAllowedRemovalName(policy, entry.name)) {
        removalNames.add(entry.name);
      } else {
        ignoredInput = true;
      }
    }
  }
  const requestCookies = readSessionCookieEntries(fields.get("requestCookies"), false);
  if (requestCookies === null) {
    ignoredInput = true;
  } else {
    for (const cookie of requestCookies) {
      if (isAllowedRemovalName(policy, cookie.name)) {
        removalNames.add(cookie.name);
      }
    }
  }

  const writes: CookieWrite[] = [];
  for (const name of removalNames) {
    writes.push(Object.freeze({ name, value: "", attributes: removalAttributes }));
  }
  return Object.freeze({
    kind: "plan",
    plan: Object.freeze({ writers, writes: Object.freeze(writes) }),
    ignoredInput,
  });
}

// Writes logout's clears to the response, whatever failed before it. Invalid
// configuration or a malformed call denies before writing; a response-setter
// exception can stop the clears partway and returns `failed`.
export function writeLogoutSessionCookieClears(
  input: LogoutSessionCookieClear,
): LogoutSessionCookieClearResult {
  let decision: LogoutPlanOrResult;
  try {
    decision = planLogoutClears(input);
  } catch {
    return LOGOUT_DENIED_REQUEST;
  }
  if (decision.kind === "result") {
    return decision.result;
  }
  if (!applyPlan(decision.plan)) {
    return LOGOUT_FAILED;
  }
  return decision.ignoredInput ? LOGOUT_CLEARED_IGNORING_INPUT : LOGOUT_CLEARED;
}
