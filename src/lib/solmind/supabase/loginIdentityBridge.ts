import "server-only";

import { createServerClient } from "@supabase/ssr";

// Login step 6, sub-slice S6-7: the Supabase identity bridge, hold then write.
//
// Source of truth: solmind-docs
// `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
// (contract 25), accepted by Paul on 2026-10-04 (AUTH-RLS-DEC-043), Section 6
// "Hold, then write", and
// `execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
// (contract 21) Section 7.9, the Supabase Auth identity and session bridge of
// AUTH-RLS-DEC-035.
//
// The hold client. Each sign-in builds one Supabase SSR server client, the
// cookie-less client of AUTH-RLS-DEC-035: its cookie reader returns no
// cookies, so no request cookie ever reaches it, and its cookie setter only
// holds, in memory, what the library hands over. Its storage key,
// and so its cookie name, is the auth cookie name N that the route's
// composition root takes from S6-2's session-cookie policy and passes in.
// With no cookies to read, the installed library hands over the session's
// cookies once, after its sign-in event: N alone, or `N.0` to `N.k`, and no
// removal. That set is what S6-2's login-step cookie writer accepts.
//
// Guide and Admin, the password factor. `signInWithPassword` sends the typed
// email and password to Supabase Auth through the hold client. Wrong
// credentials give `credentials_refused` with nothing held, and the SolMind
// challenge is untouched (the route redeems it only after this step). A
// success gives a hold. After the route has redeemed the challenge, it calls
// the hold's `assertProviderUser` with the account's bound provider user id;
// a hold is released only after that assertion passed.
//
// Explorer, the internal exchange after SolMind's own trust decision
// (AUTH-RLS-DEC-035). After the route has redeemed the challenge and resolved
// the account's bound provider user id and canonical email,
// `exchangeExplorerLink` asks the injected server-only link seam (the
// service-role client's Auth admin API) for a link of type `magiclink`,
// checks that the link was made for the bound user before anything else, and
// at once exchanges the link's token hash with `verifyOtp` (type `email`) on
// the hold client. The link token goes only to Supabase Auth's verify
// endpoint; it is never stored, logged, returned or accepted from a client.
// The session's user must be the bound user, so this hold comes back already
// asserted.
//
// The provider-id assertion. The answer's user id, the session's user id and
// the access token's subject must be one id, and the held cookies must carry
// that same access token; if not, the result is `failed`. That id must equal
// the bound provider user id, a lowercase canonical UUID; if not, the result
// is `denied`. Either way the bridge immediately attempts best-effort local
// revocation of that session. A link made for another user is `denied`
// before any exchange, so no session exists.
//
// Release. `release` hands over the held cookies as `{ name, value }` copies
// only when the hold was asserted and the caller states that the session
// function answered `created`, or `existing` for this exact flow. That
// outcome is a precondition the trusted caller attests; the bridge cannot
// check it, and it cannot tell whether `existing` belongs to this exact flow.
// A refused first release while the hold is pending starts the cleanup.
// Repeated release attempts return `refused` without another provider
// operation. A hold is released at most once. Writing the released cookies is
// the route's, through S6-2's writer.
//
// Cleanup. `discard` is best-effort. It drops the held cookies and
// immediately attempts best-effort local revocation of this one transient
// session (`POST /logout` with scope `local`, sent with the session's own
// access token, not a service key). It may run whatever came before, also
// after a release whose write then failed. It never rejects and gives the
// same answer on every call. Only a successful answer counts as `cleaned`;
// anything else is `failed` and raises the injected cleanup-failure signal
// once, with no argument. A failed cleanup never turns a deny into an allow:
// the hold can no longer be released.
//
// Recovered access tokens, for cleanup only. Each sign-in or exchange is one
// attempt with its own hold client, transport and record of recovered access
// tokens, so concurrent attempts never share a token. While the attempt is
// open, the access token in the body of every answer to a request it sent,
// whatever the library then makes of that answer, and the access token that
// a completed hand-over carries are recorded. When the attempt ends, it gives
// a hold only if the library's answer is a well-formed session, the one
// hand-over carries that session's access token, and no other access token
// was recovered; otherwise every recovered access token immediately gets
// best-effort local revocation, each failed revocation raising the signal
// once. An answer to the attempt's request that is read only after the
// attempt ended (a successful answer that arrives after the deadline, or
// whose body completes after it) never gives a hold and never reaches a
// release: its access token immediately gets best-effort local revocation.
// Cleanup requests are never read for tokens. A timeout does not establish
// whether Supabase created a session; if no access token is ever recovered,
// revocation cannot be attempted.
//
// Provider expiry. `accessTokenExpiresAt` (epoch seconds) is the access
// token's own `exp` claim. Contract 25 Section 7 sizes the SolMind session
// from the access token's remaining life, and AUTH-RLS-DEC-039 forbids
// requesting more than the token's actual lifetime; the session's
// `expires_at`, which the library stores, must be well formed but does not
// redefine it.
//
// Transport. Every hold-client request goes through the attempt's transport,
// which bounds it by the configured deadline (an abort through the injected
// fetch, and a timer that settles even when that fetch ignores the abort)
// and never rejects: a failure, a late answer or an unreadable answer
// becomes one fixed 503 answer. The library reports that as an error, so its
// own logging of a rejected fetch is not reached on these requests. The link
// seam is raced against the same deadline; it has no abort. The link seam's
// client is not behind this transport, and the library itself logs a
// rejected fetch's error, in time or after the deadline, where the bridge
// cannot prevent it. So a non-logging, non-rejecting fetch boundary for that
// client is a required precondition (an S6-8 composition gate).
//
// It never reads a request cookie, an environment variable or a setting;
// makes no direct session-read or session-write call (no user, session,
// refresh or set-session call; the library's own initial-session emission
// still reads the hold's empty storage), and its cleanup does not reload the
// stored session; never writes a cookie or a response; calls no database
// function; its own code logs nothing (the installed library keeps its own
// logging paths), and it throws nothing once constructed. Every result except
// a successful release carries no token, cookie value, password, email, link
// token or provider id; a successful release carries the held cookie values,
// which contain the tokens, and `accessTokenExpiresAt` is a time. The tokens
// stay in this module's memory until the hold is dropped. The configuration,
// dependencies and request objects themselves are read through own data
// properties only, so no getter on them runs; the link seam's `generateLink`
// method and the library's answers are read as ordinary properties.
//
// Where it lives. It sits beside the request-auth client, in the request-auth
// adapter layer where contract 25 Sections 5.1 and 6 keep `@supabase/ssr`
// (AUTH-RLS-DEC-012, DEC-013 and DEC-019). It imports no Next.js module; the
// route's composition root hands it everything.
//
// Dormant: no application runtime caller is introduced (no route, page,
// middleware or other application module imports this module); the unit
// tests invoke the bridge, and nothing is written at runtime. Keep it
// server-only, direct-import only and off every barrel.

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: the login identity bridge must not be imported in browser code.",
  );
}

export type LoginIdentityBridgeConfiguration = Readonly<{
  supabaseUrl: string;
  anonKey: string;
  authCookieName: string;
  providerTimeoutMilliseconds: number;
}>;

// The part of the service-role client's Auth admin API that the Explorer
// exchange uses. The service-role client's `auth.admin` satisfies it.
// Required precondition (an S6-8 composition gate): that client must reach
// Supabase Auth through a non-logging, non-rejecting fetch boundary. The
// library itself logs a rejected fetch's error, in time or after the
// deadline, where the bridge cannot prevent it.
export type LoginIdentityLinkAdmin = Readonly<{
  generateLink(params: Readonly<{ type: "magiclink"; email: string }>): Promise<unknown>;
}>;

export type LoginIdentityBridgeDependencies = Readonly<{
  fetch: typeof fetch;
  linkAdmin: LoginIdentityLinkAdmin;
  signalCleanupFailure: () => void;
}>;

export type PasswordSignInRequest = Readonly<{ email: string; password: string }>;

export type ExplorerLinkExchangeRequest = Readonly<{ email: string; boundProviderUserId: string }>;

export type HeldCookieReleaseRequest = Readonly<{ sessionOutcome: "created" | "existing" }>;

// A held cookie as a release hands it over: its name and value only. The
// library's own cookie options are dropped; the writer chooses every
// attribute.
export type HeldIdentityCookie = Readonly<{ name: string; value: string }>;

export type ProviderUserAssertionResult = Readonly<{ outcome: "asserted" } | { outcome: "denied" }>;

export type HeldCookieReleaseResult = Readonly<
  { outcome: "released"; heldCookies: ReadonlyArray<HeldIdentityCookie> } | { outcome: "refused" }
>;

export type HoldDiscardResult = Readonly<{ outcome: "discarded"; cleanup: "cleaned" | "failed" }>;

export type LoginIdentityHold = Readonly<{
  accessTokenExpiresAt: number;
  assertProviderUser(boundProviderUserId: string): Promise<ProviderUserAssertionResult>;
  release(request: HeldCookieReleaseRequest): HeldCookieReleaseResult;
  discard(): Promise<HoldDiscardResult>;
}>;

export type PasswordSignInResult = Readonly<
  | { outcome: "held"; hold: LoginIdentityHold }
  | { outcome: "credentials_refused" }
  | { outcome: "invalid_request" }
  | { outcome: "failed" }
>;

export type ExplorerLinkExchangeResult = Readonly<
  | { outcome: "held"; hold: LoginIdentityHold }
  | { outcome: "denied" }
  | { outcome: "invalid_request" }
  | { outcome: "failed" }
>;

export type LoginIdentityBridge = Readonly<{
  signInWithPassword(request: PasswordSignInRequest): Promise<PasswordSignInResult>;
  exchangeExplorerLink(request: ExplorerLinkExchangeRequest): Promise<ExplorerLinkExchangeResult>;
}>;

export const LOGIN_IDENTITY_BRIDGE_LIMITS: Readonly<{
  minimumProviderTimeoutMilliseconds: number;
  maximumProviderTimeoutMilliseconds: number;
  maximumEmailLength: number;
  maximumLinkTokenLength: number;
}> = Object.freeze({
  minimumProviderTimeoutMilliseconds: 10,
  maximumProviderTimeoutMilliseconds: 60_000,
  maximumEmailLength: 254,
  maximumLinkTokenLength: 1024,
});

// The error `createLoginIdentityBridge` throws for malformed configuration or
// dependencies. Its message is fixed and carries no value.
export class LoginIdentityBridgeConfigurationError extends Error {
  constructor() {
    super("SolMind login identity bridge: invalid configuration or dependencies.");
    this.name = "LoginIdentityBridgeConfigurationError";
  }
}

const CREDENTIALS_REFUSED: PasswordSignInResult = Object.freeze({ outcome: "credentials_refused" });
const SIGN_IN_INVALID_REQUEST: PasswordSignInResult = Object.freeze({ outcome: "invalid_request" });
const SIGN_IN_FAILED: PasswordSignInResult = Object.freeze({ outcome: "failed" });
const EXCHANGE_DENIED: ExplorerLinkExchangeResult = Object.freeze({ outcome: "denied" });
const EXCHANGE_INVALID_REQUEST: ExplorerLinkExchangeResult = Object.freeze({ outcome: "invalid_request" });
const EXCHANGE_FAILED: ExplorerLinkExchangeResult = Object.freeze({ outcome: "failed" });
const ASSERTED: ProviderUserAssertionResult = Object.freeze({ outcome: "asserted" });
const ASSERTION_DENIED: ProviderUserAssertionResult = Object.freeze({ outcome: "denied" });
const RELEASE_REFUSED: HeldCookieReleaseResult = Object.freeze({ outcome: "refused" });
const DISCARDED_CLEANED: HoldDiscardResult = Object.freeze({ outcome: "discarded", cleanup: "cleaned" });
const DISCARDED_CLEANUP_FAILED: HoldDiscardResult = Object.freeze({ outcome: "discarded", cleanup: "failed" });

const CONFIGURATION_KEYS: ReadonlyArray<string> = Object.freeze([
  "supabaseUrl",
  "anonKey",
  "authCookieName",
  "providerTimeoutMilliseconds",
]);
const DEPENDENCY_KEYS: ReadonlyArray<string> = Object.freeze(["fetch", "linkAdmin", "signalCleanupFailure"]);
const PASSWORD_SIGN_IN_KEYS: ReadonlyArray<string> = Object.freeze(["email", "password"]);
const EXPLORER_EXCHANGE_KEYS: ReadonlyArray<string> = Object.freeze(["email", "boundProviderUserId"]);
const RELEASE_KEYS: ReadonlyArray<string> = Object.freeze(["sessionOutcome"]);
const HAND_OVER_ENTRY_KEYS: ReadonlyArray<string> = Object.freeze(["name", "value", "options"]);

// A provider user id exactly as Supabase Auth prints a UUID. No `m` flag, so a
// final line terminator is refused.
const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// The auth cookie name: no dot, so its chunk names `N.0`, `N.1`, ... stay
// unambiguous; the hosted `__Host-` prefix fits.
const COOKIE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const EMAIL_SHAPE_PATTERN = /^[^\s@]+@[^\s@]+$/;
// The link's token hash: printable ASCII with no space.
const LINK_TOKEN_PATTERN = /^[!-~]+$/;
// One JWT segment, or a stored cookie value after its prefix: base64url.
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
// The library writes each stored value as this prefix plus base64url.
const STORED_VALUE_PREFIX = "base64-";
// HTTP statuses whose answer has no body.
const NULL_BODY_STATUSES: ReadonlySet<number> = new Set([101, 103, 204, 205, 304]);

// The hold client's calls. A Supabase SSR server client satisfies it.
type HoldClient = Readonly<{
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): Promise<unknown>;
    verifyOtp(params: { token_hash: string; type: "email" }): Promise<unknown>;
    admin: { signOut(jwt: string, scope: "local"): Promise<unknown> };
  };
}>;

type HandOverCollector = Readonly<{
  accept(cookies: unknown): void;
  take(): ReadonlyArray<HeldIdentityCookie> | null;
}>;

// How an attempt's transport and collector report what they see: whether
// the attempt is still open (only a request sent while it is open is read
// for an access token), and each access token recovered.
type AttemptRecorder = Readonly<{
  harvesting(): boolean;
  recover(accessToken: string): void;
}>;

// What an ended attempt leaves: the one well-formed hand-over (or null) and
// every access token it recovered, in the order first seen.
type AttemptEnd = Readonly<{
  held: ReadonlyArray<HeldIdentityCookie> | null;
  recovered: ReadonlyArray<string>;
}>;

// One sign-in or exchange: its own hold client, collector, transport and
// recovered access tokens.
type SignInAttempt = Readonly<{ client: HoldClient; finish(): AttemptEnd }>;

type ProviderSession = Readonly<{ accessToken: string; userId: string; accessTokenExpiresAt: number }>;

// A sign-in answer as read. `accessToken` is set whenever the answer carried
// one, so that a session the bridge rejects can still be cleaned up;
// `session` is set only when every part is well formed.
type SessionAnswer = Readonly<{
  error: unknown;
  accessToken: string | null;
  session: ProviderSession | null;
}>;

type Settlement<T> = Readonly<{ settled: true; value: T }> | Readonly<{ settled: false }>;

const NOT_SETTLED: Readonly<{ settled: false }> = Object.freeze({ settled: false });

type BridgeSettings = Readonly<{
  supabaseUrl: string;
  anonKey: string;
  authCookieName: string;
  timeoutMilliseconds: number;
  send: typeof fetch;
  linkAdmin: object;
  generateLink: (...args: unknown[]) => unknown;
  signal: () => void;
}>;

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

// One field of a library answer, read as an ordinary property; undefined for
// anything that is not an object.
function recordField(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  return Reflect.get(value, key);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function hasNoControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
      return false;
    }
  }
  return true;
}

function isEmailAddress(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= LOGIN_IDENTITY_BRIDGE_LIMITS.maximumEmailLength &&
    EMAIL_SHAPE_PATTERN.test(value) &&
    hasNoControlCharacter(value)
  );
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID_PATTERN.test(value);
}

function readBridgeSettings(configuration: unknown, dependencies: unknown): BridgeSettings | null {
  try {
    const config = readExactDataProperties(configuration, CONFIGURATION_KEYS);
    const deps = readExactDataProperties(dependencies, DEPENDENCY_KEYS);
    if (config === null || deps === null) {
      return null;
    }
    const supabaseUrl = config.get("supabaseUrl");
    const anonKey = config.get("anonKey");
    const authCookieName = config.get("authCookieName");
    const timeoutMilliseconds = config.get("providerTimeoutMilliseconds");
    const send = deps.get("fetch");
    const linkAdmin = deps.get("linkAdmin");
    const signal = deps.get("signalCleanupFailure");
    if (
      typeof supabaseUrl !== "string" ||
      typeof anonKey !== "string" ||
      anonKey.length === 0 ||
      /\s/.test(anonKey) ||
      !hasNoControlCharacter(anonKey) ||
      typeof authCookieName !== "string" ||
      !COOKIE_NAME_PATTERN.test(authCookieName) ||
      typeof timeoutMilliseconds !== "number" ||
      !Number.isSafeInteger(timeoutMilliseconds) ||
      timeoutMilliseconds < LOGIN_IDENTITY_BRIDGE_LIMITS.minimumProviderTimeoutMilliseconds ||
      timeoutMilliseconds > LOGIN_IDENTITY_BRIDGE_LIMITS.maximumProviderTimeoutMilliseconds ||
      typeof send !== "function" ||
      linkAdmin === null ||
      typeof linkAdmin !== "object" ||
      typeof signal !== "function"
    ) {
      return null;
    }
    const parsed = new URL(supabaseUrl);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username !== "" ||
      parsed.password !== ""
    ) {
      return null;
    }
    const generateLink: unknown = Reflect.get(linkAdmin, "generateLink");
    if (typeof generateLink !== "function") {
      return null;
    }
    return Object.freeze({
      supabaseUrl,
      anonKey,
      authCookieName,
      timeoutMilliseconds,
      send: send as typeof fetch,
      linkAdmin,
      generateLink: generateLink as (...args: unknown[]) => unknown,
      signal: signal as () => void,
    });
  } catch {
    return null;
  }
}

// Runs `start` and waits for it at most `milliseconds`. A rejection, a
// timeout, or an answer that comes later than the deadline (for example after
// a blocked event loop) is `settled: false`. Never rejects. `start` itself
// keeps running after a timeout; whatever it does then is its own.
async function settleWithin<T>(start: () => Promise<T>, milliseconds: number): Promise<Settlement<T>> {
  const startedAt = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<Settlement<T>>((resolve) => {
    timer = setTimeout(() => resolve(NOT_SETTLED), milliseconds);
  });
  const answered = (async (): Promise<Settlement<T>> => {
    try {
      const value = await start();
      return Object.freeze({ settled: true as const, value });
    } catch {
      return NOT_SETTLED;
    }
  })();
  try {
    const outcome = await Promise.race([answered, expired]);
    return outcome.settled && performance.now() - startedAt <= milliseconds ? outcome : NOT_SETTLED;
  } finally {
    clearTimeout(timer);
  }
}

// The answer the transport gives for every failure: one fixed 503 with no
// body, which the library reports as an error.
function transportFailure(): Response {
  return new Response(null, { status: 503 });
}

// The access token an answer's body carries at its top level, as Supabase
// Auth's token and verify answers do. Read for cleanup only, whatever the
// library then makes of the answer; null for anything else.
function answeredAccessToken(body: ArrayBuffer): string | null {
  try {
    if (body.byteLength === 0) {
      return null;
    }
    const parsed: unknown = JSON.parse(Buffer.from(body).toString("utf8"));
    const accessToken = recordField(parsed, "access_token");
    return typeof accessToken === "string" && accessToken.length > 0 ? accessToken : null;
  } catch {
    return null;
  }
}

// An attempt's transport: one deadline per request, the answer read in full
// within it, and never a rejection. The answer to a request sent while the
// attempt is open is read for an access token as soon as its body is in,
// even after the deadline, so a late session can still be revoked.
function createBoundedTransport(
  send: typeof fetch,
  milliseconds: number,
  recorder: AttemptRecorder,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const harvest = recorder.harvesting();
    const controller = new AbortController();
    const outcome = await settleWithin(async (): Promise<Response | null> => {
      const response: unknown = await send(input, { ...init, signal: controller.signal });
      if (!(response instanceof Response)) {
        return null;
      }
      const body = await response.arrayBuffer();
      if (harvest) {
        const accessToken = answeredAccessToken(body);
        if (accessToken !== null) {
          recorder.recover(accessToken);
        }
      }
      return new Response(
        body.byteLength === 0 || NULL_BODY_STATUSES.has(response.status) ? null : body,
        { status: response.status, statusText: response.statusText, headers: response.headers },
      );
    }, milliseconds);
    if (!outcome.settled || outcome.value === null) {
      controller.abort();
      return transportFailure();
    }
    return outcome.value;
  };
}

// The library's hand-over as frozen `{ name, value }` copies, read through
// own data properties only; null unless it is a non-empty list of plain
// entries with string names and values, at least one value non-empty.
function readHandOver(cookies: unknown): ReadonlyArray<HeldIdentityCookie> | null {
  if (!Array.isArray(cookies)) {
    return null;
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(cookies, "length");
  const length: unknown = lengthDescriptor === undefined ? undefined : lengthDescriptor.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 1) {
    return null;
  }
  const held: HeldIdentityCookie[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(cookies, String(index));
    if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      return null;
    }
    const entry: unknown = descriptor.value;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return null;
    }
    const prototype: unknown = Object.getPrototypeOf(entry);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    for (const key of Reflect.ownKeys(entry)) {
      if (typeof key !== "string" || !HAND_OVER_ENTRY_KEYS.includes(key)) {
        return null;
      }
    }
    const name = Object.getOwnPropertyDescriptor(entry, "name");
    const value = Object.getOwnPropertyDescriptor(entry, "value");
    if (
      name === undefined ||
      value === undefined ||
      !Object.prototype.hasOwnProperty.call(name, "value") ||
      !Object.prototype.hasOwnProperty.call(value, "value") ||
      typeof name.value !== "string" ||
      name.value.length === 0 ||
      typeof value.value !== "string"
    ) {
      return null;
    }
    held.push(Object.freeze({ name: name.value, value: value.value }));
  }
  if (!held.some((cookie) => cookie.value.length > 0)) {
    return null;
  }
  return Object.freeze(held);
}

// Collects the library's hand-overs. A sign-in must produce exactly one well
// formed hand-over; `take` closes the collector, and anything handed over
// after that is ignored. The access token of every well-formed hand-over
// before then is recovered for cleanup, even when the hand-over cannot be
// held. `accept` never throws: the library awaits the cookie setter inside
// its sign-in event, logs any error it throws and rethrows it.
function createHandOverCollector(baseName: string, recorder: AttemptRecorder): HandOverCollector {
  let closed = false;
  let count = 0;
  let held: ReadonlyArray<HeldIdentityCookie> | null = null;
  return Object.freeze({
    accept(cookies: unknown): void {
      try {
        if (closed) {
          return;
        }
        count += 1;
        const handedOver = readHandOver(cookies);
        if (handedOver !== null) {
          const accessToken = heldSessionAccessToken(handedOver, baseName);
          if (accessToken !== null) {
            recorder.recover(accessToken);
          }
        }
        held = count === 1 ? handedOver : null;
      } catch {
        held = null;
      }
    },
    take(): ReadonlyArray<HeldIdentityCookie> | null {
      closed = true;
      const taken = count === 1 ? held : null;
      held = null;
      return taken;
    },
  });
}

// The access token the held cookies carry: their value joined as the library
// joins it (N alone, or `N.0` to `N.k` in order), the prefix removed, the
// base64url decoded, and the stored session's `access_token` read. Null for
// anything else.
function heldSessionAccessToken(held: ReadonlyArray<HeldIdentityCookie>, baseName: string): string | null {
  try {
    let joined = "";
    if (held.length === 1 && held[0].name === baseName) {
      joined = held[0].value;
    } else {
      for (let index = 0; index < held.length; index += 1) {
        if (held[index].name !== `${baseName}.${index}`) {
          return null;
        }
        joined += held[index].value;
      }
    }
    if (!joined.startsWith(STORED_VALUE_PREFIX)) {
      return null;
    }
    const encoded = joined.slice(STORED_VALUE_PREFIX.length);
    if (!BASE64URL_PATTERN.test(encoded)) {
      return null;
    }
    const stored: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const accessToken = recordField(stored, "access_token");
    return typeof accessToken === "string" && accessToken.length > 0 ? accessToken : null;
  } catch {
    return null;
  }
}

// The access token's own `exp` and `sub` claims. The token came straight from
// Supabase Auth to this server; its signature is Supabase Auth's to check, and
// it is read here only for these two claims.
function readAccessTokenClaims(accessToken: string): Readonly<{ expiresAt: number; subject: string }> | null {
  try {
    const segments = accessToken.split(".");
    if (segments.length !== 3 || !BASE64URL_PATTERN.test(segments[1])) {
      return null;
    }
    const payload: unknown = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    const expiresAt = recordField(payload, "exp");
    const subject = recordField(payload, "sub");
    if (!isPositiveSafeInteger(expiresAt) || typeof subject !== "string" || subject.length === 0) {
      return null;
    }
    return Object.freeze({ expiresAt, subject });
  } catch {
    return null;
  }
}

function readSessionAnswer(answer: unknown): SessionAnswer {
  try {
    const error = recordField(answer, "error");
    const data = recordField(answer, "data");
    const session = recordField(data, "session");
    const rawAccessToken = recordField(session, "access_token");
    const accessToken =
      typeof rawAccessToken === "string" && rawAccessToken.length > 0 ? rawAccessToken : null;
    if (error !== null || accessToken === null) {
      return Object.freeze({ error, accessToken, session: null });
    }
    const userId = recordField(recordField(data, "user"), "id");
    const sessionUserId = recordField(recordField(session, "user"), "id");
    const refreshToken = recordField(session, "refresh_token");
    const expiresAt = recordField(session, "expires_at");
    const claims = readAccessTokenClaims(accessToken);
    if (
      typeof userId !== "string" ||
      userId.length === 0 ||
      sessionUserId !== userId ||
      typeof refreshToken !== "string" ||
      refreshToken.length === 0 ||
      !isPositiveSafeInteger(expiresAt) ||
      claims === null ||
      claims.subject !== userId
    ) {
      return Object.freeze({ error: null, accessToken, session: null });
    }
    // The provider expiry is the access token's own `exp` (contract 25
    // Section 7); the stored `expires_at` must be well formed but does not
    // redefine it.
    const providerSession: ProviderSession = Object.freeze({
      accessToken,
      userId,
      accessTokenExpiresAt: claims.expiresAt,
    });
    return Object.freeze({ error: null, accessToken, session: providerSession });
  } catch {
    return Object.freeze({ error: undefined, accessToken: null, session: null });
  }
}

// The session an ended attempt may hold: a well-formed session whose access
// token the one hand-over carries, with no other access token recovered by
// the attempt. Null otherwise.
function acceptedSession(
  read: SessionAnswer,
  ended: AttemptEnd,
  baseName: string,
): Readonly<{ session: ProviderSession; held: ReadonlyArray<HeldIdentityCookie> }> | null {
  const session = read.session;
  const held = ended.held;
  if (
    session === null ||
    held === null ||
    heldSessionAccessToken(held, baseName) !== session.accessToken ||
    !ended.recovered.every((accessToken) => accessToken === session.accessToken)
  ) {
    return null;
  }
  return Object.freeze({ session, held });
}

// Supabase Auth's refusal of the typed credentials: a client-error status
// with the `invalid_credentials` code.
function isCredentialsRefusal(error: unknown): boolean {
  try {
    const status = recordField(error, "status");
    return (
      typeof status === "number" &&
      status >= 400 &&
      status <= 499 &&
      recordField(error, "code") === "invalid_credentials"
    );
  } catch {
    return false;
  }
}

// The link seam's answer: the user the link was made for and its token hash,
// only when the answer has no error, the type is `magiclink` and both are
// well formed.
function readLinkAnswer(answer: unknown): Readonly<{ userId: string; tokenHash: string }> | null {
  try {
    if (recordField(answer, "error") !== null) {
      return null;
    }
    const data = recordField(answer, "data");
    const userId = recordField(recordField(data, "user"), "id");
    const properties = recordField(data, "properties");
    const tokenHash = recordField(properties, "hashed_token");
    if (
      typeof userId !== "string" ||
      userId.length === 0 ||
      recordField(properties, "verification_type") !== "magiclink" ||
      typeof tokenHash !== "string" ||
      tokenHash.length > LOGIN_IDENTITY_BRIDGE_LIMITS.maximumLinkTokenLength ||
      !LINK_TOKEN_PATTERN.test(tokenHash)
    ) {
      return null;
    }
    return Object.freeze({ userId, tokenHash });
  } catch {
    return null;
  }
}

// Builds the identity bridge. Throws `LoginIdentityBridgeConfigurationError`
// for malformed configuration or dependencies; a constructed bridge never
// throws or rejects.
export function createLoginIdentityBridge(
  configuration: LoginIdentityBridgeConfiguration,
  dependencies: LoginIdentityBridgeDependencies,
): LoginIdentityBridge {
  const settings = readBridgeSettings(configuration, dependencies);
  if (settings === null) {
    throw new LoginIdentityBridgeConfigurationError();
  }

  // The cleanup-failure signal, guarded so that it can never change an
  // outcome.
  const raiseCleanupFailureSignal = (): void => {
    try {
      Reflect.apply(settings.signal, undefined, []);
    } catch {
      // Intentionally empty: the signal never affects the outcome.
    }
  };

  // Attempts best-effort local revocation of one transient Supabase session.
  // Never rejects.
  const revokeTransientSession = async (
    client: HoldClient,
    accessToken: string,
  ): Promise<"cleaned" | "failed"> => {
    let cleaned = false;
    try {
      const answer = await client.auth.admin.signOut(accessToken, "local");
      cleaned = recordField(answer, "error") === null;
    } catch {
      cleaned = false;
    }
    if (!cleaned) {
      raiseCleanupFailureSignal();
    }
    return cleaned ? "cleaned" : "failed";
  };

  // Ends an attempt that gives no hold: each distinct access token, in order,
  // immediately gets best-effort local revocation. Never rejects.
  const revokeRecovered = async (
    client: HoldClient,
    accessTokens: ReadonlyArray<string | null>,
  ): Promise<void> => {
    const distinct: string[] = [];
    for (const accessToken of accessTokens) {
      if (accessToken !== null && !distinct.includes(accessToken)) {
        distinct.push(accessToken);
      }
    }
    for (const accessToken of distinct) {
      await revokeTransientSession(client, accessToken);
    }
  };

  const openAttempt = (): SignInAttempt | null => {
    try {
      let open = true;
      let attemptClient: HoldClient | null = null;
      const seen: string[] = [];
      const recovered: string[] = [];
      const recorder: AttemptRecorder = Object.freeze({
        harvesting: (): boolean => open,
        recover: (accessToken: string): void => {
          try {
            if (seen.includes(accessToken)) {
              return;
            }
            seen.push(accessToken);
            if (open) {
              recovered.push(accessToken);
            } else if (attemptClient !== null) {
              // Recovered after the attempt ended, so no hold can own it.
              void revokeTransientSession(attemptClient, accessToken);
            }
          } catch {
            // Intentionally empty: recovery never affects an outcome.
          }
        },
      });
      const collector = createHandOverCollector(settings.authCookieName, recorder);
      const client: HoldClient = createServerClient(settings.supabaseUrl, settings.anonKey, {
        cookieOptions: { name: settings.authCookieName },
        cookies: {
          // Cookie-less: the hold client never sees a request cookie.
          getAll: () => [],
          // Hold only: what the library hands over stays in memory here.
          setAll: (cookiesToSet) => {
            collector.accept(cookiesToSet);
          },
        },
        global: { fetch: createBoundedTransport(settings.send, settings.timeoutMilliseconds, recorder) },
      });
      attemptClient = client;
      return Object.freeze({
        client,
        finish: (): AttemptEnd => {
          open = false;
          const held = collector.take();
          return Object.freeze({ held, recovered: Object.freeze([...recovered]) });
        },
      });
    } catch {
      return null;
    }
  };

  const createHold = (
    client: HoldClient,
    held: ReadonlyArray<HeldIdentityCookie>,
    session: ProviderSession,
    asserted: boolean,
  ): LoginIdentityHold => {
    let state: "held" | "released" | "discarded" = "held";
    let isAsserted = asserted;
    let heldCookies: ReadonlyArray<HeldIdentityCookie> | null = held;
    let transient: Readonly<{ client: HoldClient; accessToken: string }> | null = Object.freeze({
      client,
      accessToken: session.accessToken,
    });
    let discarding: Promise<HoldDiscardResult> | null = null;

    const discard = (): Promise<HoldDiscardResult> => {
      if (discarding !== null) {
        return discarding;
      }
      state = "discarded";
      heldCookies = null;
      const target = transient;
      transient = null;
      discarding = (async (): Promise<HoldDiscardResult> => {
        if (target === null) {
          raiseCleanupFailureSignal();
          return DISCARDED_CLEANUP_FAILED;
        }
        const cleanup = await revokeTransientSession(target.client, target.accessToken);
        return cleanup === "cleaned" ? DISCARDED_CLEANED : DISCARDED_CLEANUP_FAILED;
      })();
      return discarding;
    };

    const assertProviderUser = async (boundProviderUserId: unknown): Promise<ProviderUserAssertionResult> => {
      if (state !== "held") {
        return ASSERTION_DENIED;
      }
      if (isCanonicalUuid(boundProviderUserId) && boundProviderUserId === session.userId) {
        isAsserted = true;
        return ASSERTED;
      }
      await discard();
      return ASSERTION_DENIED;
    };

    const release = (request: unknown): HeldCookieReleaseResult => {
      if (state !== "held") {
        return RELEASE_REFUSED;
      }
      const fields = readExactDataProperties(request, RELEASE_KEYS);
      const sessionOutcome = fields === null ? undefined : fields.get("sessionOutcome");
      const cookies = heldCookies;
      if (
        !isAsserted ||
        cookies === null ||
        (sessionOutcome !== "created" && sessionOutcome !== "existing")
      ) {
        void discard();
        return RELEASE_REFUSED;
      }
      state = "released";
      heldCookies = null;
      return Object.freeze({ outcome: "released", heldCookies: cookies });
    };

    return Object.freeze({
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      assertProviderUser,
      release,
      discard,
    });
  };

  const signInWithPassword = async (request: unknown): Promise<PasswordSignInResult> => {
    try {
      const fields = readExactDataProperties(request, PASSWORD_SIGN_IN_KEYS);
      const email = fields === null ? undefined : fields.get("email");
      const password = fields === null ? undefined : fields.get("password");
      if (!isEmailAddress(email) || typeof password !== "string" || password.length === 0) {
        return SIGN_IN_INVALID_REQUEST;
      }
      const attempt = openAttempt();
      if (attempt === null) {
        return SIGN_IN_FAILED;
      }
      let answer: unknown = null;
      try {
        answer = await attempt.client.auth.signInWithPassword({ email, password });
      } catch {
        answer = null;
      }
      const read = readSessionAnswer(answer);
      const ended = attempt.finish();
      const accepted = acceptedSession(read, ended, settings.authCookieName);
      if (accepted !== null) {
        return Object.freeze({
          outcome: "held",
          hold: createHold(attempt.client, accepted.held, accepted.session, false),
        });
      }
      if (read.accessToken === null && ended.recovered.length === 0) {
        return isCredentialsRefusal(read.error) ? CREDENTIALS_REFUSED : SIGN_IN_FAILED;
      }
      await revokeRecovered(attempt.client, [read.accessToken, ...ended.recovered]);
      return SIGN_IN_FAILED;
    } catch {
      return SIGN_IN_FAILED;
    }
  };

  const exchangeExplorerLink = async (request: unknown): Promise<ExplorerLinkExchangeResult> => {
    try {
      const fields = readExactDataProperties(request, EXPLORER_EXCHANGE_KEYS);
      const email = fields === null ? undefined : fields.get("email");
      const boundProviderUserId = fields === null ? undefined : fields.get("boundProviderUserId");
      if (!isEmailAddress(email) || !isCanonicalUuid(boundProviderUserId)) {
        return EXCHANGE_INVALID_REQUEST;
      }
      const linkParams = Object.freeze({ type: "magiclink" as const, email });
      const linkAnswer = await settleWithin(
        async (): Promise<unknown> => Reflect.apply(settings.generateLink, settings.linkAdmin, [linkParams]),
        settings.timeoutMilliseconds,
      );
      const link = linkAnswer.settled ? readLinkAnswer(linkAnswer.value) : null;
      if (link === null) {
        return EXCHANGE_FAILED;
      }
      // The pre-exchange assertion: no session is minted for any other user.
      if (link.userId !== boundProviderUserId) {
        return EXCHANGE_DENIED;
      }
      const attempt = openAttempt();
      if (attempt === null) {
        return EXCHANGE_FAILED;
      }
      let answer: unknown = null;
      try {
        answer = await attempt.client.auth.verifyOtp({ token_hash: link.tokenHash, type: "email" });
      } catch {
        answer = null;
      }
      const read = readSessionAnswer(answer);
      const ended = attempt.finish();
      const accepted = acceptedSession(read, ended, settings.authCookieName);
      if (accepted === null) {
        await revokeRecovered(attempt.client, [read.accessToken, ...ended.recovered]);
        return EXCHANGE_FAILED;
      }
      if (accepted.session.userId !== boundProviderUserId) {
        await revokeRecovered(attempt.client, [accepted.session.accessToken]);
        return EXCHANGE_DENIED;
      }
      return Object.freeze({
        outcome: "held",
        hold: createHold(attempt.client, accepted.held, accepted.session, true),
      });
    } catch {
      return EXCHANGE_FAILED;
    }
  };

  return Object.freeze({ signInWithPassword, exchangeExplorerLink });
}
