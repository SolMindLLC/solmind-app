import "server-only";

import {
  loginSessionCookieMaxAgeSeconds,
  parseLoginSessionExpiresAt,
  providerTokenRemainingLifeSeconds,
  requestedLoginSessionDurationSeconds,
} from "../auth/loginSessionDuration";
import { SOLMIND_ROLES, type SolMindRole } from "../roles";

// Login step 6, sub-slice S6-6: the server caller of the banked session
// function `public.solmind_create_user_session` (AUTH-RLS-DEC-039; its
// current definition is in
// `supabase/migrations/20260718000000_authorizing_evidence_consumption.sql`).
//
// Source of truth: solmind-docs
// `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
// (contract 25), accepted by Paul on 2026-10-04 (AUTH-RLS-DEC-043), Sections 6
// and 7 and Section 15 item 6, with
// `execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
// Section 7.3. The duration rule is in `../auth/loginSessionDuration.ts`.
//
// What one `create` does, in order:
//   1. checks the request: exactly the server-derived account UUID, the role
//      the route's login path fixes, the challenge UUID the route has just
//      redeemed (all UUIDs in PostgreSQL's lowercase canonical form), and the
//      provider access token's expiry in epoch seconds. Each check is a
//      whole-string match, so a value with a final line terminator is
//      refused. Anything else, including any extra key (a purpose, a
//      duration, a session id), is `invalid_request`, with no database call.
//      No client value ever seeds the session id or the duration;
//   2. works out the requested duration from the token's remaining life with
//      the duration rule: less the rule's margin, capped at its maximum. Under
//      1 second is `denied`, with no database call;
//   3. calls the session function once, through the injected RPC seam (the
//      service-role client satisfies it), with the purpose fixed to `login`,
//      under a caller response deadline: before the call it records a
//      monotonic deadline (`performance.now()` plus the configured limit) and
//      arms a timer that aborts the call's AbortSignal, which postgrest-js
//      passes to `fetch`. A late answer is `failed`, and the deadline is
//      checked again just before an answer is accepted;
//   4. accepts only exactly one row whose only keys are `outcome`,
//      `user_session_id` and `expires_at`, with `outcome` exactly `created` or
//      `existing`, a lowercase canonical session UUID, and `expires_at` in the
//      exact form PostgreSQL prints. `existing` is checked exactly as
//      `created` is;
//   5. works out the cookies' Max-Age from that `expires_at` and the current
//      time with the duration rule: the session's remaining life in whole
//      seconds, rounded down, with no cap. Under 1 second left is `failed`:
//      the session is too close to its end to write cookies for. More than
//      the rule's maximum is `failed` too: no session lasts that long, so only
//      this server's clock running behind the database's can show it, an
//      abnormal state.
//
// The function's fixed refusals of this evidence, account or role
// (`solmind_session_ineligible_account`, `_ineligible_role`,
// `_ineligible_evidence`, `_conflicting_retry`, `_evidence_consumed`,
// `_stale_evidence` and `_older_evidence`, matched exactly, with PostgreSQL's
// raise_exception code) are `denied`. Everything else is `failed`: its other
// fixed errors (an input the caller should have refused, an unavailable
// policy, a lock timeout, an integrity failure), any other error, a throw, a
// rejection, a lost, late or malformed answer. Contract 25 Section 12 lists a
// session-function denial among the failures after the provider sign-in; what
// the person sees is the route slice's mapping. Neither outcome says which
// check failed.
//
// `existing`, and why it is accepted only for this exact flow. The function
// returns `existing` with the same session only on an exact retry: a session
// already made from this very challenge, for the same account, role and
// purpose, still active and unexpired, and the account's only valid one. That
// branch comes before the freshness check, so it answers even after the
// redeemed evidence is too old to make a new session. So anything that could
// call this function twice with one redeemed challenge could recover a live
// session's UUID for up to an hour. This caller's part:
//   - one database call per `create`, and no retry;
//   - no other entry point: nothing looks up, lists or recovers a session;
//   - `existing` validated exactly like `created`;
//   - the purpose fixed to `login`, the one flow step 6 builds.
// postgrest-js 2.108.2 does not replay a POST (its retry list holds only GET,
// HEAD and OPTIONS); the tests show one POST per call through the real client,
// also after a 503, a 520 and a network error. The route's part, owed by the
// Explorer, Guide and Admin route slices (S6-8, S6-9): call `create` only
// after its own redemption of this same challenge returned `redeemed` in the
// same request, after every other factor and check the role's login path
// requires (contract 21 Section 7.3: the password as well, for Guides and the
// Admin), and at most once per request. Then no other flow can hold the same
// challenge, because the redemption function redeems a challenge once, and in
// a step 6 login `existing` can come only from a replay below the client.
//
// What a `created` or `existing` answer proves, and what it does not: it is
// the database function's own answer. It shows committed state only if the
// call runs as one READ COMMITTED transaction of its own (contract 21 Section
// 7.3 requires the runtime caller to call the function as a standalone call
// under READ COMMITTED), PostgREST commits it before it answers, and no layer
// replays the POST. Only the last is shown here, for the client layer; the
// rest is for the route slice's database run. A lost, late or aborted answer
// may hide a session the database did make, which has then also ended the
// account's previous session; this caller reports `failed`, the route writes
// no cookie, and that session is never presented and ends by itself within
// the hour.
//
// Results are frozen. Every result other than `created` and `existing` is
// one shared object with only `outcome`. An accepted result carries only the
// session UUID, which the binding cookie needs, and the Max-Age. Contract 25
// Section 14 keeps session UUIDs out of logs, errors, signals and URLs, so the
// route hands both to the cookie writer and never logs the result. The caller
// never logs and never reads the environment; no account, challenge, token or
// database error text reaches a result. Request, dependency-record and
// answer-row fields are inspected through own-property descriptors, rejecting
// accessor fields without invoking those field getters directly. Proxy
// reflection traps and injected RPC/response getters can execute; their
// exceptions are discarded. Construction rejects invalid configuration with
// one fixed value-free error; `create` resolves failures without propagating
// underlying exceptions.
//
// Dormant: nothing calls this caller. There is no composition root here (the
// route slice wires it to the service-role client), and no route, server
// action, cookie or UI uses it. Keep it direct-import only and off every
// barrel. Owed by the identity bridge slice (S6-7): which provider expiry
// feeds the rule; the auth library computes a session's `expires_at` from
// `expires_in` and this server's clock when the server omits it.

export const USER_SESSION_CREATION_FUNCTION = "solmind_create_user_session" as const;

// The one purpose step 6's sign-in routes issue, redeem and sessionize.
export const USER_SESSION_CREATION_PURPOSE = "login" as const;

export const USER_SESSION_CREATION_OUTCOMES = Object.freeze([
  "created",
  "existing",
  "denied",
  "invalid_request",
  "failed",
] as const);

export type UserSessionCreationOutcome = (typeof USER_SESSION_CREATION_OUTCOMES)[number];

// The caller response deadline for the database call: how long the caller
// waits for an answer, not a limit on the call itself.
export const USER_SESSION_CREATION_LIMITS: Readonly<{
  minimumRpcTimeoutMilliseconds: number;
  maximumRpcTimeoutMilliseconds: number;
}> = Object.freeze({
  minimumRpcTimeoutMilliseconds: 10,
  maximumRpcTimeoutMilliseconds: 60_000,
});

export const USER_SESSION_CREATION_ERROR_CODES = Object.freeze([
  "user_session_creation_invalid_configuration",
] as const);

export type UserSessionCreationErrorCode = (typeof USER_SESSION_CREATION_ERROR_CODES)[number];

// Fixed, value-free construction errors. `create` never throws.
export class UserSessionCreationError extends Error {
  readonly code: UserSessionCreationErrorCode;

  constructor(code: UserSessionCreationErrorCode) {
    super(code);
    this.name = "UserSessionCreationError";
    this.code = code;
  }
}

// One database call, before it is sent: `abortSignal` attaches the signal
// and returns the awaitable call. postgrest-js's builder satisfies it.
export type UserSessionCreationRpcRequest = Readonly<{
  abortSignal(signal: AbortSignal): PromiseLike<unknown>;
}>;

// The narrow RPC seam. The server-only service-role Supabase client satisfies
// it. The caller calls exactly one fixed function through it and accepts no
// function name from anyone.
export type UserSessionCreationRpcClient = Readonly<{
  rpc(
    functionName: string,
    args: Readonly<Record<string, string | number>>,
  ): UserSessionCreationRpcRequest;
}>;

export type UserSessionCreationRequest = Readonly<{
  userAccountId: string;
  activeRoleContext: SolMindRole;
  challengeId: string;
  providerAccessTokenExpiresAt: number;
}>;

export type UserSessionCreationResult =
  | Readonly<{
      outcome: "created" | "existing";
      sessionId: string;
      maxAgeSeconds: number;
    }>
  | Readonly<{
      outcome: Exclude<UserSessionCreationOutcome, "created" | "existing">;
    }>;

export type UserSessionCreator = Readonly<{
  create(request: UserSessionCreationRequest): Promise<UserSessionCreationResult>;
}>;

export type UserSessionCreatorDependencies = Readonly<{
  rpcClient: UserSessionCreationRpcClient;
  rpcTimeoutMilliseconds: number;
}>;

const REQUEST_KEYS = Object.freeze([
  "userAccountId",
  "activeRoleContext",
  "challengeId",
  "providerAccessTokenExpiresAt",
] as const);
const DEPENDENCY_KEYS = Object.freeze(["rpcClient", "rpcTimeoutMilliseconds"] as const);
const ANSWER_ROW_KEYS = Object.freeze(["outcome", "user_session_id", "expires_at"] as const);

const ROLE_CONTEXTS: ReadonlyArray<string> = Object.freeze(Object.values(SOLMIND_ROLES));

// A UUID exactly as PostgreSQL prints one: lowercase canonical form. No `m`
// flag, so a final line terminator is refused.
const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The largest token expiry, in epoch seconds, a JavaScript Date can hold.
const MAXIMUM_TOKEN_EXPIRY_SECONDS = 8_640_000_000_000;

const RAISE_EXCEPTION_CODE = "P0001";

// The session function's fixed refusals of the evidence, account or role,
// matched exactly. Its other fixed errors are failures.
const DENIAL_MESSAGES: ReadonlyArray<string> = Object.freeze([
  "solmind_session_ineligible_account",
  "solmind_session_ineligible_role",
  "solmind_session_ineligible_evidence",
  "solmind_session_conflicting_retry",
  "solmind_session_evidence_consumed",
  "solmind_session_stale_evidence",
  "solmind_session_older_evidence",
]);

type RefusalOutcome = Exclude<UserSessionCreationOutcome, "created" | "existing">;

const REFUSALS = Object.freeze({
  denied: Object.freeze({ outcome: "denied" as const }),
  invalid_request: Object.freeze({ outcome: "invalid_request" as const }),
  failed: Object.freeze({ outcome: "failed" as const }),
}) satisfies Record<RefusalOutcome, UserSessionCreationResult>;

type RpcAnswer = Readonly<{ data: unknown; error: unknown }>;

type RpcCall = Readonly<{
  // The answer, or null when it is missing, malformed, rejected or late.
  answer: Promise<RpcAnswer | null>;
  // The monotonic deadline, in performance.now() milliseconds.
  deadline: number;
}>;

type AcceptedRow = Readonly<{
  outcome: "created" | "existing";
  sessionId: string;
  expiresAtMilliseconds: number;
}>;

function fail(code: UserSessionCreationErrorCode): never {
  throw new UserSessionCreationError(code);
}

// Reads the listed keys of a plain object through own-property descriptors,
// rejecting accessor fields without invoking those field getters directly.
// Proxy reflection traps can execute; their exceptions are discarded.
// Returns null when the value is not a plain object, when its own keys are
// not exactly `keys` (all strings and enumerable), when a listed key holds an
// accessor, or when any reflection call throws (for example in a hostile Proxy
// trap). The exception is dropped unread, so it can never carry a value out.
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
      // A data descriptor always has its own `value`; an accessor never has.
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value")
      ) {
        return null;
      }
      fields.set(key, descriptor.value);
    }
    return fields;
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID_PATTERN.test(value);
}

function isAcceptedOutcome(value: unknown): value is "created" | "existing" {
  return value === "created" || value === "existing";
}

function isTimeout(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= USER_SESSION_CREATION_LIMITS.minimumRpcTimeoutMilliseconds &&
    value <= USER_SESSION_CREATION_LIMITS.maximumRpcTimeoutMilliseconds
  );
}

// The RPC client is a server-built object whose method may live on a
// prototype (the Supabase client's `rpc` does), so it is checked with an
// ordinary read inside a guard. Any exception is dropped.
function hasCallable(value: unknown, method: string): boolean {
  try {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Record<string, unknown>)[method] === "function"
    );
  } catch {
    return false;
  }
}

// True while the monotonic clock is still before the deadline. At or after
// it, the call is late.
function isBeforeDeadline(deadline: number): boolean {
  return performance.now() < deadline;
}

// Calls the one fixed database function once. The monotonic deadline is
// recorded before `rpc` is called; a timer aborts the call's signal at the
// deadline and decides the answer as null if nothing came earlier. An answer
// is accepted only if its callback runs before the deadline, by the monotonic
// clock, so a callback delayed past the deadline is null even if the timer has
// not fired. A throw, a rejection, or an answer without readable
// `data`/`error` is null.
function startRpc(
  client: UserSessionCreationRpcClient,
  args: Readonly<Record<string, string | number>>,
  timeoutMilliseconds: number,
): RpcCall {
  const controller = new AbortController();
  const deadline = performance.now() + timeoutMilliseconds;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMilliseconds);
  });
  // A synchronous throw inside `rpc` or `abortSignal` becomes a rejection.
  const call = new Promise<unknown>((resolve) => {
    resolve(client.rpc(USER_SESSION_CREATION_FUNCTION, args).abortSignal(controller.signal));
  });
  const attempt = call.then(
    (response): RpcAnswer | null => {
      if (!isBeforeDeadline(deadline)) {
        return null;
      }
      try {
        if (!isPlainRecord(response)) {
          return null;
        }
        return Object.freeze({ data: response.data, error: response.error });
      } catch {
        return null;
      }
    },
    () => null,
  );
  const answer = Promise.race([attempt, timedOut]).finally(() => {
    clearTimeout(timer);
  });
  return Object.freeze({ answer, deadline });
}

function isDenial(error: unknown): boolean {
  return (
    isPlainRecord(error) &&
    error.code === RAISE_EXCEPTION_CODE &&
    typeof error.message === "string" &&
    DENIAL_MESSAGES.includes(error.message)
  );
}

// Exactly one row whose only keys are the function's three output columns.
function readAcceptedRow(data: unknown): AcceptedRow | null {
  if (!Array.isArray(data) || data.length !== 1) {
    return null;
  }
  const row = readExactDataProperties(data[0], ANSWER_ROW_KEYS);
  if (row === null) {
    return null;
  }
  const outcome = row.get("outcome");
  const sessionId = row.get("user_session_id");
  const expiresAtMilliseconds = parseLoginSessionExpiresAt(row.get("expires_at"));
  if (
    !isAcceptedOutcome(outcome) ||
    !isCanonicalUuid(sessionId) ||
    expiresAtMilliseconds === null
  ) {
    return null;
  }
  return Object.freeze({ outcome, sessionId, expiresAtMilliseconds });
}

function mapAnswer(answer: RpcAnswer | null): AcceptedRow | "denied" | "failed" {
  if (answer === null) {
    return "failed";
  }
  if (answer.error !== null && answer.error !== undefined) {
    return isDenial(answer.error) ? "denied" : "failed";
  }
  return readAcceptedRow(answer.data) ?? "failed";
}

type ParsedRequest = Readonly<{
  userAccountId: string;
  activeRoleContext: SolMindRole;
  challengeId: string;
  providerAccessTokenExpiresAt: number;
}>;

function parseRequest(value: unknown): ParsedRequest | null {
  const fields = readExactDataProperties(value, REQUEST_KEYS);
  if (fields === null) {
    return null;
  }
  const userAccountId = fields.get("userAccountId");
  const activeRoleContext = fields.get("activeRoleContext");
  const challengeId = fields.get("challengeId");
  const providerAccessTokenExpiresAt = fields.get("providerAccessTokenExpiresAt");
  if (
    !isCanonicalUuid(userAccountId) ||
    typeof activeRoleContext !== "string" ||
    !ROLE_CONTEXTS.includes(activeRoleContext) ||
    !isCanonicalUuid(challengeId) ||
    typeof providerAccessTokenExpiresAt !== "number" ||
    !Number.isSafeInteger(providerAccessTokenExpiresAt) ||
    providerAccessTokenExpiresAt < 1 ||
    providerAccessTokenExpiresAt > MAXIMUM_TOKEN_EXPIRY_SECONDS
  ) {
    return null;
  }
  return Object.freeze({
    userAccountId,
    activeRoleContext: activeRoleContext as SolMindRole,
    challengeId,
    providerAccessTokenExpiresAt,
  });
}

// The session creator: one fixed function, one call per `create`.
export function createUserSessionCreator(
  dependencies: UserSessionCreatorDependencies,
): UserSessionCreator {
  const fields = readExactDataProperties(dependencies, DEPENDENCY_KEYS);
  if (fields === null) {
    fail("user_session_creation_invalid_configuration");
  }
  const rpcClient = fields.get("rpcClient");
  const rpcTimeoutMilliseconds = fields.get("rpcTimeoutMilliseconds");
  if (!hasCallable(rpcClient, "rpc") || !isTimeout(rpcTimeoutMilliseconds)) {
    fail("user_session_creation_invalid_configuration");
  }
  const client = rpcClient as UserSessionCreationRpcClient;
  const rpcTimeout = rpcTimeoutMilliseconds as number;

  async function create(request: unknown): Promise<UserSessionCreationResult> {
    try {
      const parsed = parseRequest(request);
      if (parsed === null) {
        return REFUSALS.invalid_request;
      }
      const remainingLife = providerTokenRemainingLifeSeconds(
        parsed.providerAccessTokenExpiresAt,
        Date.now(),
      );
      if (remainingLife === null) {
        return REFUSALS.failed;
      }
      const requestedDurationSeconds = requestedLoginSessionDurationSeconds(remainingLife);
      if (requestedDurationSeconds === null) {
        // Contract 25 Section 7: under 1 second, the login is denied.
        return REFUSALS.denied;
      }
      const call = startRpc(
        client,
        {
          p_user_account_id: parsed.userAccountId,
          p_active_role_context: parsed.activeRoleContext,
          p_verification_challenge_id: parsed.challengeId,
          p_expected_purpose: USER_SESSION_CREATION_PURPOSE,
          p_requested_duration_seconds: requestedDurationSeconds,
        },
        rpcTimeout,
      );
      const mapped = mapAnswer(await call.answer);
      if (mapped === "denied" || mapped === "failed") {
        return REFUSALS[mapped];
      }
      // Checked again just before the answer is accepted: nothing late is
      // acted on.
      if (!isBeforeDeadline(call.deadline)) {
        return REFUSALS.failed;
      }
      const maxAgeSeconds = loginSessionCookieMaxAgeSeconds(mapped.expiresAtMilliseconds, Date.now());
      if (maxAgeSeconds === null) {
        // Under 1 second left, or more than the rule's maximum (an abnormal
        // state): no cookie may be written.
        return REFUSALS.failed;
      }
      return Object.freeze({
        outcome: mapped.outcome,
        sessionId: mapped.sessionId,
        maxAgeSeconds,
      });
    } catch {
      return REFUSALS.failed;
    }
  }

  return Object.freeze({
    create: (request: UserSessionCreationRequest) => create(request),
  });
}
