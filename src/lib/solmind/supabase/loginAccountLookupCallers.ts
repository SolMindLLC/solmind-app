import "server-only";

import { SOLMIND_ROLES, type SolMindRole } from "../roles";

// Login step 6, sub-slice S6-8: the server callers of the two banked sign-in
// lookups of sub-slice S6-5
// (`supabase/migrations/20261005010000_login_account_and_redeemed_challenge_lookups.sql`):
// `public.solmind_resolve_login_account` and
// `public.solmind_confirm_redeemed_login_challenge`.
//
// Source of truth: solmind-docs
// `execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
// (contract 21) Sections 7.1.3, 7.3 and 7.9, and
// `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
// (contract 25) Section 6.
//
// The account lookup. `resolve` takes the canonical identifier the shared
// normalizer returned, its type, and the role the route's login path fixes.
// It checks the request (exactly those three keys; a non-empty string
// identifier; the type `email` or `username`; one of the three role names),
// then calls the account function once through the injected RPC seam
// (the service-role client satisfies it), under a caller response deadline.
// Its answers:
//   - `found`: exactly one row whose only keys are the function's four
//     output columns, with the account UUID and the contact UUID in
//     PostgreSQL's lowercase canonical form, a non-empty stored email, and a
//     provider user id that is itself a lowercase canonical UUID (the column
//     is text; the identity bridge accepts only that form). The result
//     carries exactly those four values and nothing else;
//   - `not_found`: an answer with no error and zero rows. The function gives
//     the same zero rows for every unknown, ineligible or ambiguous state, so
//     this outcome says nothing about why;
//   - `failed`: everything else. A malformed request (no database call), an
//     error (the function's three fixed argument errors included), a throw, a
//     rejection, a lost, late or malformed answer, more than one row, or a
//     row whose values are not in the forms above.
//
// The confirmation. `confirm` takes the server-derived account UUID, the
// exact selector the route has just redeemed, and the purpose the route
// fixes (`login` or `role_reentry`). It checks the request, calls the
// confirmation function once under its own deadline, and answers `confirmed`
// only for exactly one row whose only key is `confirmed` and whose value is
// the boolean `true`; `not_confirmed` for exactly that row with `false`; and
// `failed` for everything else.
//
// The caller response deadline, as in the session caller beside this module:
// before the call a monotonic deadline is recorded (`performance.now()` plus
// the configured limit) and a timer is armed that aborts the call's
// AbortSignal, which postgrest-js passes to `fetch`. A late answer is
// `failed`, and the deadline is checked again just before an answer is
// accepted. It is the time the caller waits, not a limit on the call itself;
// nothing proves that PostgreSQL stops a call already started. Both functions
// are STABLE, so a late call cannot write.
//
// One database call per `resolve` or `confirm`, and no retry. postgrest-js
// 2.108.2 does not replay a POST; the tests show one POST per call through
// the real client, also after a 503, a 520 and a network error.
//
// Posture (contract 21 Section 7.1.3): two fixed function names, each called
// through its own narrow seam. Neither caller accepts a function name from
// anyone, and neither goes through a generic executor or a broad query.
//
// Results are frozen. Every result other than `found` is one shared object
// with only `outcome`. A `found` result carries an account UUID, a contact
// UUID, an email and a provider user id: the route hands them to the issuing
// caller, the confirmation, the identity bridge and the session caller, and
// never logs them or returns them outward. Neither caller logs or reads the
// environment; no database error text reaches a result. Request,
// dependency-record and answer-row fields are inspected through own-property
// descriptors, so no field getter runs. Construction rejects invalid
// configuration with one fixed value-free error; `resolve` and `confirm`
// resolve failures without propagating underlying exceptions.
//
// Called by login step 6's Explorer sign-in routes (S6-8), through their
// request-scoped dependency factory. Keep it server-only, direct-import only
// and off every barrel.

export const LOGIN_ACCOUNT_LOOKUP_FUNCTION = "solmind_resolve_login_account" as const;
export const REDEEMED_LOGIN_CHALLENGE_CONFIRMATION_FUNCTION =
  "solmind_confirm_redeemed_login_challenge" as const;
export const LOGIN_CHALLENGE_OWNERSHIP_FUNCTION = "solmind_check_login_challenge_owner" as const;
export const LOGIN_PASSWORD_FAILURE_FUNCTION = "solmind_record_login_password_failure" as const;

export const LOGIN_IDENTIFIER_TYPES = Object.freeze(["email", "username"] as const);

export type LoginIdentifierType = (typeof LOGIN_IDENTIFIER_TYPES)[number];

// The purposes the confirmation function accepts.
export const REDEEMED_LOGIN_CHALLENGE_PURPOSES = Object.freeze(["login", "role_reentry"] as const);

export type RedeemedLoginChallengePurpose = (typeof REDEEMED_LOGIN_CHALLENGE_PURPOSES)[number];

// The caller response deadline for each database call: how long the caller
// waits for an answer, not a limit on the call itself.
export const LOGIN_ACCOUNT_LOOKUP_LIMITS: Readonly<{
  minimumRpcTimeoutMilliseconds: number;
  maximumRpcTimeoutMilliseconds: number;
}> = Object.freeze({
  minimumRpcTimeoutMilliseconds: 10,
  maximumRpcTimeoutMilliseconds: 60_000,
});

export const LOGIN_ACCOUNT_LOOKUP_ERROR_CODES = Object.freeze([
  "login_account_lookup_invalid_configuration",
] as const);

export type LoginAccountLookupErrorCode = (typeof LOGIN_ACCOUNT_LOOKUP_ERROR_CODES)[number];

// Fixed, value-free construction errors. `resolve` and `confirm` never throw.
export class LoginAccountLookupError extends Error {
  readonly code: LoginAccountLookupErrorCode;

  constructor(code: LoginAccountLookupErrorCode) {
    super(code);
    this.name = "LoginAccountLookupError";
    this.code = code;
  }
}

// One database call, before it is sent: `abortSignal` attaches the signal
// and returns the awaitable call. postgrest-js's builder satisfies it.
export type LoginAccountLookupRpcRequest = Readonly<{
  abortSignal(signal: AbortSignal): PromiseLike<unknown>;
}>;

// The narrow RPC seam. The server-only service-role Supabase client satisfies
// it. Each caller calls exactly one fixed function through it.
export type LoginAccountLookupRpcClient = Readonly<{
  rpc(functionName: string, args: Readonly<Record<string, string>>): LoginAccountLookupRpcRequest;
}>;

export type LoginAccountLookupRequest = Readonly<{
  normalizedIdentifier: string;
  identifierType: LoginIdentifierType;
  requestedRoleContext: SolMindRole;
}>;

export type LoginAccountLookupResult =
  | Readonly<{
      outcome: "found";
      userAccountId: string;
      userContactMethodId: string;
      normalizedEmail: string;
      providerUserId: string;
    }>
  | Readonly<{ outcome: "not_found" }>
  | Readonly<{ outcome: "failed" }>;

export type LoginAccountLookup = Readonly<{
  resolve(request: LoginAccountLookupRequest): Promise<LoginAccountLookupResult>;
}>;

export type RedeemedLoginChallengeConfirmationRequest = Readonly<{
  userAccountId: string;
  challengeId: string;
  expectedPurpose: RedeemedLoginChallengePurpose;
}>;

export type RedeemedLoginChallengeConfirmationResult = Readonly<{
  outcome: "confirmed" | "not_confirmed" | "failed";
}>;

export type RedeemedLoginChallengeConfirmation = Readonly<{
  confirm(
    request: RedeemedLoginChallengeConfirmationRequest,
  ): Promise<RedeemedLoginChallengeConfirmationResult>;
}>;

export type LoginAccountLookupDependencies = Readonly<{
  rpcClient: LoginAccountLookupRpcClient;
  rpcTimeoutMilliseconds: number;
}>;

const DEPENDENCY_KEYS: ReadonlyArray<string> = Object.freeze(["rpcClient", "rpcTimeoutMilliseconds"]);
const LOOKUP_REQUEST_KEYS: ReadonlyArray<string> = Object.freeze([
  "normalizedIdentifier",
  "identifierType",
  "requestedRoleContext",
]);
const LOOKUP_ROW_KEYS: ReadonlyArray<string> = Object.freeze([
  "user_account_id",
  "user_contact_method_id",
  "normalized_contact_value",
  "provider_user_id",
]);
const CONFIRMATION_REQUEST_KEYS: ReadonlyArray<string> = Object.freeze([
  "userAccountId",
  "challengeId",
  "expectedPurpose",
]);
const CONFIRMATION_ROW_KEYS: ReadonlyArray<string> = Object.freeze(["confirmed"]);

const ROLE_CONTEXTS: ReadonlyArray<string> = Object.freeze(Object.values(SOLMIND_ROLES));

// A UUID exactly as PostgreSQL prints one: lowercase canonical form. No `m`
// flag, so a final line terminator is refused.
const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const LOOKUP_NOT_FOUND: LoginAccountLookupResult = Object.freeze({ outcome: "not_found" });
const LOOKUP_FAILED: LoginAccountLookupResult = Object.freeze({ outcome: "failed" });
const CONFIRMED: RedeemedLoginChallengeConfirmationResult = Object.freeze({ outcome: "confirmed" });
const NOT_CONFIRMED: RedeemedLoginChallengeConfirmationResult = Object.freeze({
  outcome: "not_confirmed",
});
const CONFIRMATION_FAILED: RedeemedLoginChallengeConfirmationResult = Object.freeze({
  outcome: "failed",
});

type RpcAnswer = Readonly<{ data: unknown; error: unknown }>;

type RpcCall = Readonly<{
  // The answer, or null when it is missing, malformed, rejected or late.
  answer: Promise<RpcAnswer | null>;
  // The monotonic deadline, in performance.now() milliseconds.
  deadline: number;
}>;

function fail(code: LoginAccountLookupErrorCode): never {
  throw new LoginAccountLookupError(code);
}

// Reads the listed keys of a plain object through own-property descriptors,
// rejecting accessor fields without invoking those field getters directly.
// Returns null when the value is not a plain object, when its own keys are
// not exactly `keys` (all strings and enumerable), when a listed key holds an
// accessor, or when any reflection call throws (for example in a hostile
// Proxy trap). The exception is dropped unread, so it can never carry a value
// out.
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

function isTimeout(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= LOGIN_ACCOUNT_LOOKUP_LIMITS.minimumRpcTimeoutMilliseconds &&
    value <= LOGIN_ACCOUNT_LOOKUP_LIMITS.maximumRpcTimeoutMilliseconds
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

// Calls one fixed database function once. The monotonic deadline is recorded
// before `rpc` is called; a timer aborts the call's signal at the deadline
// and decides the answer as null if nothing came earlier. An answer is
// accepted only if its callback runs before the deadline, by the monotonic
// clock. A throw, a rejection, or an answer without readable `data`/`error`
// is null.
function startRpc(
  client: LoginAccountLookupRpcClient,
  functionName: string,
  args: Readonly<Record<string, string>>,
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
    resolve(client.rpc(functionName, args).abortSignal(controller.signal));
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

type CallerSettings = Readonly<{ client: LoginAccountLookupRpcClient; rpcTimeout: number }>;

function readDependencies(dependencies: unknown): CallerSettings {
  const fields = readExactDataProperties(dependencies, DEPENDENCY_KEYS);
  if (fields === null) {
    fail("login_account_lookup_invalid_configuration");
  }
  const rpcClient = fields.get("rpcClient");
  const rpcTimeoutMilliseconds = fields.get("rpcTimeoutMilliseconds");
  if (!hasCallable(rpcClient, "rpc") || !isTimeout(rpcTimeoutMilliseconds)) {
    fail("login_account_lookup_invalid_configuration");
  }
  return Object.freeze({
    client: rpcClient as LoginAccountLookupRpcClient,
    rpcTimeout: rpcTimeoutMilliseconds as number,
  });
}

// Exactly one row whose only keys are the account function's four output
// columns, each in the form the module comment gives. Null for anything else.
function readAccountRow(row: unknown): LoginAccountLookupResult | null {
  const fields = readExactDataProperties(row, LOOKUP_ROW_KEYS);
  if (fields === null) {
    return null;
  }
  const userAccountId = fields.get("user_account_id");
  const userContactMethodId = fields.get("user_contact_method_id");
  const normalizedEmail = fields.get("normalized_contact_value");
  const providerUserId = fields.get("provider_user_id");
  if (
    !isCanonicalUuid(userAccountId) ||
    !isCanonicalUuid(userContactMethodId) ||
    typeof normalizedEmail !== "string" ||
    normalizedEmail.length === 0 ||
    !isCanonicalUuid(providerUserId)
  ) {
    return null;
  }
  return Object.freeze({
    outcome: "found" as const,
    userAccountId,
    userContactMethodId,
    normalizedEmail,
    providerUserId,
  });
}

function mapLookupAnswer(answer: RpcAnswer | null): LoginAccountLookupResult {
  if (answer === null || (answer.error !== null && answer.error !== undefined)) {
    return LOOKUP_FAILED;
  }
  if (!Array.isArray(answer.data)) {
    return LOOKUP_FAILED;
  }
  if (answer.data.length === 0) {
    return LOOKUP_NOT_FOUND;
  }
  if (answer.data.length !== 1) {
    return LOOKUP_FAILED;
  }
  return readAccountRow(answer.data[0]) ?? LOOKUP_FAILED;
}

function mapConfirmationAnswer(answer: RpcAnswer | null): RedeemedLoginChallengeConfirmationResult {
  if (answer === null || (answer.error !== null && answer.error !== undefined)) {
    return CONFIRMATION_FAILED;
  }
  if (!Array.isArray(answer.data) || answer.data.length !== 1) {
    return CONFIRMATION_FAILED;
  }
  const fields = readExactDataProperties(answer.data[0], CONFIRMATION_ROW_KEYS);
  const confirmed = fields === null ? undefined : fields.get("confirmed");
  if (confirmed === true) {
    return CONFIRMED;
  }
  return confirmed === false ? NOT_CONFIRMED : CONFIRMATION_FAILED;
}

// The account lookup: one fixed function, one call per `resolve`.
export function createLoginAccountLookup(
  dependencies: LoginAccountLookupDependencies,
): LoginAccountLookup {
  const settings = readDependencies(dependencies);

  async function resolve(request: unknown): Promise<LoginAccountLookupResult> {
    try {
      const fields = readExactDataProperties(request, LOOKUP_REQUEST_KEYS);
      const normalizedIdentifier = fields === null ? undefined : fields.get("normalizedIdentifier");
      const identifierType = fields === null ? undefined : fields.get("identifierType");
      const requestedRoleContext = fields === null ? undefined : fields.get("requestedRoleContext");
      if (
        typeof normalizedIdentifier !== "string" ||
        normalizedIdentifier.length === 0 ||
        typeof identifierType !== "string" ||
        !(LOGIN_IDENTIFIER_TYPES as ReadonlyArray<string>).includes(identifierType) ||
        typeof requestedRoleContext !== "string" ||
        !ROLE_CONTEXTS.includes(requestedRoleContext)
      ) {
        return LOOKUP_FAILED;
      }
      const call = startRpc(
        settings.client,
        LOGIN_ACCOUNT_LOOKUP_FUNCTION,
        {
          p_normalized_login_identifier: normalizedIdentifier,
          p_login_identifier_type: identifierType,
          p_requested_role_context: requestedRoleContext,
        },
        settings.rpcTimeout,
      );
      const mapped = mapLookupAnswer(await call.answer);
      // Checked again just before a row is accepted: nothing late is acted on.
      if (mapped.outcome === "found" && !isBeforeDeadline(call.deadline)) {
        return LOOKUP_FAILED;
      }
      return mapped;
    } catch {
      return LOOKUP_FAILED;
    }
  }

  return Object.freeze({
    resolve: (request: LoginAccountLookupRequest) => resolve(request),
  });
}

// The redeemed-challenge confirmation: one fixed function, one call per
// `confirm`.
export function createRedeemedLoginChallengeConfirmation(
  dependencies: LoginAccountLookupDependencies,
): RedeemedLoginChallengeConfirmation {
  const settings = readDependencies(dependencies);

  async function confirm(request: unknown): Promise<RedeemedLoginChallengeConfirmationResult> {
    try {
      const fields = readExactDataProperties(request, CONFIRMATION_REQUEST_KEYS);
      const userAccountId = fields === null ? undefined : fields.get("userAccountId");
      const challengeId = fields === null ? undefined : fields.get("challengeId");
      const expectedPurpose = fields === null ? undefined : fields.get("expectedPurpose");
      if (
        !isCanonicalUuid(userAccountId) ||
        !isCanonicalUuid(challengeId) ||
        typeof expectedPurpose !== "string" ||
        !(REDEEMED_LOGIN_CHALLENGE_PURPOSES as ReadonlyArray<string>).includes(expectedPurpose)
      ) {
        return CONFIRMATION_FAILED;
      }
      const call = startRpc(
        settings.client,
        REDEEMED_LOGIN_CHALLENGE_CONFIRMATION_FUNCTION,
        {
          p_user_account_id: userAccountId,
          p_verification_challenge_id: challengeId,
          p_expected_purpose: expectedPurpose,
        },
        settings.rpcTimeout,
      );
      const mapped = mapConfirmationAnswer(await call.answer);
      // Checked again just before `confirmed` is accepted: nothing late is
      // acted on.
      if (mapped.outcome === "confirmed" && !isBeforeDeadline(call.deadline)) {
        return CONFIRMATION_FAILED;
      }
      return mapped;
    } catch {
      return CONFIRMATION_FAILED;
    }
  }

  return Object.freeze({
    confirm: (request: RedeemedLoginChallengeConfirmationRequest) => confirm(request),
  });
}

// Guide/Admin R04 ownership component. The two S6-8 callers above retain their
// existing contracts. This additional dormant caller reads only exact ownership,
// before password authentication; it does not prove a factor or redeemability.
// SQL also joins the challenge's contact back to this account (R04 review U1).
// Used, expired, invalidated and exhausted challenges can remain owned. The
// later atomic redemption, identity assertion, redeemed confirmation and session
// checks remain mandatory. No route or factory wiring is introduced here.
export type LoginChallengeOwnershipRequest = Readonly<{
  userAccountId: string;
  challengeId: string;
}>;

export type LoginChallengeOwnershipResult = Readonly<{
  outcome: "owned" | "not_owned" | "failed";
}>;

export type LoginChallengeOwnershipCheck = Readonly<{
  check(request: LoginChallengeOwnershipRequest): Promise<LoginChallengeOwnershipResult>;
}>;

const OWNERSHIP_REQUEST_KEYS = Object.freeze(["userAccountId", "challengeId"]);
const OWNERSHIP_ROW_KEYS = Object.freeze(["owned"]);
const OWNED: LoginChallengeOwnershipResult = Object.freeze({ outcome: "owned" });
const NOT_OWNED: LoginChallengeOwnershipResult = Object.freeze({ outcome: "not_owned" });
const OWNERSHIP_FAILED: LoginChallengeOwnershipResult = Object.freeze({ outcome: "failed" });

function mapOwnershipAnswer(answer: RpcAnswer | null): LoginChallengeOwnershipResult {
  if (answer === null || (answer.error !== null && answer.error !== undefined)) {
    return OWNERSHIP_FAILED;
  }
  const rows = answer.data;
  if (!Array.isArray(rows) || Object.getPrototypeOf(rows) !== Array.prototype || rows.length !== 1) {
    return OWNERSHIP_FAILED;
  }
  const keys = Reflect.ownKeys(rows);
  const row = Object.getOwnPropertyDescriptor(rows, "0");
  if (keys.length !== 2 || !keys.includes("0") || !keys.includes("length") ||
      row === undefined || !Object.prototype.hasOwnProperty.call(row, "value") || !row.enumerable) {
    return OWNERSHIP_FAILED;
  }
  const fields = readExactDataProperties(row.value, OWNERSHIP_ROW_KEYS);
  const owned = fields === null ? undefined : fields.get("owned");
  return owned === true ? OWNED : owned === false ? NOT_OWNED : OWNERSHIP_FAILED;
}

// Account is server-derived; the exact selector is never replaced. Purpose is
// fixed internally to login. The existing monotonic deadline bounds waiting,
// requests abort and consumes late rejection; it cannot prove server cancellation.
// A valid positive result is rechecked against the deadline after parsing.
export function createLoginChallengeOwnershipCheck(
  dependencies: LoginAccountLookupDependencies,
): LoginChallengeOwnershipCheck {
  const settings = readDependencies(dependencies);
  async function check(request: unknown): Promise<LoginChallengeOwnershipResult> {
    try {
      const fields = readExactDataProperties(request, OWNERSHIP_REQUEST_KEYS);
      const userAccountId = fields?.get("userAccountId");
      const challengeId = fields?.get("challengeId");
      if (!isCanonicalUuid(userAccountId) || !isCanonicalUuid(challengeId)) {
        return OWNERSHIP_FAILED;
      }
      const call = startRpc(settings.client, LOGIN_CHALLENGE_OWNERSHIP_FUNCTION, {
        p_user_account_id: userAccountId,
        p_verification_challenge_id: challengeId,
        p_expected_purpose: "login",
      }, settings.rpcTimeout);
      const mapped = mapOwnershipAnswer(await call.answer);
      return mapped.outcome === "owned" && !isBeforeDeadline(call.deadline) ? OWNERSHIP_FAILED : mapped;
    } catch {
      return OWNERSHIP_FAILED;
    }
  }
  return Object.freeze({ check: (request: LoginChallengeOwnershipRequest) => check(request) });
}

// Card 9 item 15: a confirmed wrong password may record one eligible challenge
// failure. This is a write, unlike the lookups above: a lost/late answer does
// not prove rollback and never authorizes an automatic retry. No password/code
// value reaches this capability. SQL owns exact ownership, eligibility, the
// existing shared five-failure budget and the atomic content-free audit.
export type LoginPasswordFailureRequest = Readonly<{
  userAccountId: string; challengeId: string;
  roleContext: typeof SOLMIND_ROLES.GUIDE | typeof SOLMIND_ROLES.ADMIN;
}>;
export type LoginPasswordFailureResult = Readonly<{ outcome: "recorded" | "not_recorded" | "failed" }>;
export type LoginPasswordFailureRecorder = Readonly<{
  recordWrongPassword(request: LoginPasswordFailureRequest): Promise<LoginPasswordFailureResult>;
}>;
const PASSWORD_FAILURE_KEYS = Object.freeze(["userAccountId", "challengeId", "roleContext"]);
const PASSWORD_RECORDED: LoginPasswordFailureResult = Object.freeze({ outcome: "recorded" });
const PASSWORD_NOT_RECORDED: LoginPasswordFailureResult = Object.freeze({ outcome: "not_recorded" });
const PASSWORD_RECORD_FAILED: LoginPasswordFailureResult = Object.freeze({ outcome: "failed" });

export function createLoginPasswordFailureRecorder(
  dependencies: LoginAccountLookupDependencies,
): LoginPasswordFailureRecorder {
  const settings = readDependencies(dependencies);
  async function recordWrongPassword(request: unknown): Promise<LoginPasswordFailureResult> {
    try {
      const fields = readExactDataProperties(request, PASSWORD_FAILURE_KEYS);
      const userAccountId = fields?.get("userAccountId");
      const challengeId = fields?.get("challengeId");
      const role = fields?.get("roleContext");
      if (!isCanonicalUuid(userAccountId) || userAccountId.length !== 36 ||
          !isCanonicalUuid(challengeId) || challengeId.length !== 36 ||
          (role !== SOLMIND_ROLES.GUIDE && role !== SOLMIND_ROLES.ADMIN)) return PASSWORD_RECORD_FAILED;
      const call = startRpc(settings.client, LOGIN_PASSWORD_FAILURE_FUNCTION, {
        p_user_account_id: userAccountId, p_verification_challenge_id: challengeId,
        p_role_context: role,
      }, settings.rpcTimeout);
      const answer = await call.answer;
      if (answer === null || (answer.error !== null && answer.error !== undefined) ||
          !Array.isArray(answer.data) || answer.data.length !== 1) return PASSWORD_RECORD_FAILED;
      const row = readExactDataProperties(answer.data[0], ["recorded"]);
      const recorded = row?.get("recorded");
      if (!isBeforeDeadline(call.deadline)) return PASSWORD_RECORD_FAILED;
      return recorded === true ? PASSWORD_RECORDED : recorded === false ? PASSWORD_NOT_RECORDED : PASSWORD_RECORD_FAILED;
    } catch { return PASSWORD_RECORD_FAILED; }
  }
  return Object.freeze({ recordWrongPassword: (request: LoginPasswordFailureRequest) => recordWrongPassword(request) });
}


// Item 17 server-only lookup of one flow-bound current challenge. The public
// selector is not a challenge UUID/factor; never return the actual ID to the
// browser or fall back to another candidate. No route/factory wiring here.
export const LOGIN_FLOW_CHALLENGE_RESOLUTION_FUNCTION = "solmind_resolve_login_flow_challenge" as const;
export type LoginFlowChallengeResolutionRequest = Readonly<{
  flowId: string;
  userAccountId: string;
  userContactMethodId: string;
  roleContext: SolMindRole;
}>;
export type LoginFlowChallengeResolutionResult =
  | Readonly<{ outcome: "found"; challengeId: string }>
  | Readonly<{ outcome: "not_found" | "failed" }>;
export type LoginFlowChallengeResolver = Readonly<{
  resolve(request: LoginFlowChallengeResolutionRequest): Promise<LoginFlowChallengeResolutionResult>;
}>;
const FLOW_RESOLUTION_KEYS = Object.freeze(["flowId", "userAccountId", "userContactMethodId", "roleContext"]);
const FLOW_RESOLUTION_ROW_KEYS = Object.freeze(["outcome", "verification_challenge_id"]);
const FLOW_NOT_FOUND: LoginFlowChallengeResolutionResult = Object.freeze({ outcome: "not_found" });
const FLOW_RESOLUTION_FAILED: LoginFlowChallengeResolutionResult = Object.freeze({ outcome: "failed" });
const NIL_FLOW_ID = "00000000-0000-0000-0000-000000000000";

function mapFlowResolutionAnswer(answer: RpcAnswer | null): LoginFlowChallengeResolutionResult {
  if (answer === null || (answer.error !== null && answer.error !== undefined)) return FLOW_RESOLUTION_FAILED;
  const rows = answer.data;
  if (!Array.isArray(rows) || Object.getPrototypeOf(rows) !== Array.prototype || rows.length !== 1) return FLOW_RESOLUTION_FAILED;
  const keys = Reflect.ownKeys(rows);
  const slot = Object.getOwnPropertyDescriptor(rows, "0");
  if (keys.length !== 2 || !keys.includes("0") || !keys.includes("length") ||
      slot === undefined || !Object.prototype.hasOwnProperty.call(slot, "value") || !slot.enumerable) return FLOW_RESOLUTION_FAILED;
  const row = readExactDataProperties(slot.value, FLOW_RESOLUTION_ROW_KEYS);
  const outcome = row?.get("outcome");
  const challengeId = row?.get("verification_challenge_id");
  if (outcome === "not_found" && challengeId === null) return FLOW_NOT_FOUND;
  if (outcome === "found" && isCanonicalUuid(challengeId) && challengeId.length === 36) {
    return Object.freeze({ outcome: "found", challengeId });
  }
  return FLOW_RESOLUTION_FAILED;
}

// One call, one candidate, no automatic retry. The existing caller deadline
// bounds local waiting and requests abort; it proves neither remote stop nor
// rollback. Parsing cannot turn a late answer into a usable challenge.
export function createLoginFlowChallengeResolver(
  dependencies: LoginAccountLookupDependencies,
): LoginFlowChallengeResolver {
  const settings = readDependencies(dependencies);
  async function resolve(request: unknown): Promise<LoginFlowChallengeResolutionResult> {
    try {
      const fields = readExactDataProperties(request, FLOW_RESOLUTION_KEYS);
      const flowId = fields?.get("flowId");
      const userAccountId = fields?.get("userAccountId");
      const userContactMethodId = fields?.get("userContactMethodId");
      const roleContext = fields?.get("roleContext");
      if (!isCanonicalUuid(flowId) || flowId.length !== 36 || flowId === NIL_FLOW_ID ||
          !isCanonicalUuid(userAccountId) || userAccountId.length !== 36 ||
          !isCanonicalUuid(userContactMethodId) || userContactMethodId.length !== 36 ||
          typeof roleContext !== "string" || !ROLE_CONTEXTS.includes(roleContext)) return FLOW_RESOLUTION_FAILED;
      const call = startRpc(settings.client, LOGIN_FLOW_CHALLENGE_RESOLUTION_FUNCTION, {
        p_login_flow_id: flowId,
        p_user_account_id: userAccountId,
        p_user_contact_method_id: userContactMethodId,
        p_role_context: roleContext,
      }, settings.rpcTimeout);
      const mapped = mapFlowResolutionAnswer(await call.answer);
      return isBeforeDeadline(call.deadline) ? mapped : FLOW_RESOLUTION_FAILED;
    } catch { return FLOW_RESOLUTION_FAILED; }
  }
  return Object.freeze({ resolve: (request: LoginFlowChallengeResolutionRequest) => resolve(request) });
}
