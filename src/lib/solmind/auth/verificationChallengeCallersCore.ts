import "server-only";

import {
  computeVerificationCodeVerifier,
  generateVerificationChallengeId,
  generateVerificationCode,
  isCanonicalVerificationChallengeId,
  isVerificationCodePepper,
  isVerificationCodePurpose,
  type VerificationCodePepper,
} from "./verificationCode";
import {
  VERIFICATION_CODE_DELIVERY_LIMITS,
  deliverVerificationCode,
  isCanonicalVerificationEmail,
  isSixDigitVerificationCode,
  prepareVerificationCodeDelivery,
  type PreparedVerificationCodeDelivery,
  type VerificationCodeDeliveryChannel,
  type VerificationCodeDeliveryOutcome,
  type VerificationCodeDeliveryPurpose,
  type VerificationCodeDeliveryTransport,
} from "./verificationCodeDelivery";

// Login step 5: the restricted core of the server callers that issue and
// redeem verification challenges
// (execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md
// sections 7.1 to 7.1.3 and 7.2; AUTH-RLS-DEC-031 to AUTH-RLS-DEC-034 and
// AUTH-RLS-DEC-037).
//
// Restricted: its factories take the slot pool as a separate argument, so
// only `verificationChallengeCallers.ts` may import this module, which binds
// them to its two module-level pools, and only three named unit-test files
// may import it: the issuance and redemption tests, which pass test pools to
// its caller factories, and the composition test, which exercises its slot
// factory. The boundary test VCB-006, using TypeScript's own parser, checks
// every literal reference in every `src` file, as the provider-probe harness
// does for its restricted modules, and VCB-004 refuses computed references
// and `import.meta` in every non-test file. So the public module and those
// unit tests are the only literal `src` importers of this module, no caller
// built through the public factories can supply a pool, and no parser-checked
// `src` reference outside the public module and those unit tests reaches this
// module. Reflective loading (`createRequire`, `module.require`, the
// `Function` constructor) is beyond those source checks and could still reach
// this module's exported factories.
//
// Dormant: nothing calls these callers. There is no route, server action,
// cookie, session or UI here; the login routes are login step 6.
//
// The issuing caller, in order:
//   1. picks a fresh challenge UUID for every request. The one exception: if
//      Node's randomUUID ever failed, the result would carry the fixed nil
//      UUID, which randomUUID never issues. The UUID names a challenge only
//      when the outcome is `issued`; otherwise it matches no row, and
//      redeeming it is an ordinary `denied` that writes nothing. So every
//      result carries one UUID the client can keep as its opaque selector,
//      and the outward response has one shape;
//   2. checks the request against the same rules the issuance function
//      applies (purpose, contact type and its delivery channel, canonical
//      contact, the account/contact binding pair and the three purposes that
//      may be unbound). Each check is a whole-string match: a value with a
//      final line terminator is refused before any HMAC or database call;
//   3. takes one issuance slot from its pool. With no slot free it returns
//      `busy` before any code exists, so nothing is issued and no budget is
//      spent;
//   4. generates the six-digit code and computes the verifier;
//   5. calls `public.solmind_issue_verification_challenge` once, through the
//      injected RPC seam, under a caller response deadline (see below). Only
//      an answer of exactly one row `{ outcome: "issued" }`, received before
//      the deadline, is treated as an issuance. A `denied` row (the
//      AUTH-RLS-DEC-037 budget or pause) is `denied`; the function's fixed
//      `solmind_issue_ineligible_contact` and `solmind_issue_invalid_binding`
//      errors are `ineligible`; anything else (another error, a throw, a lost
//      or late answer, zero or two rows, an unknown value) is `failed`. A lost
//      or late answer may hide an issuance the database did make; its code is
//      dropped undelivered, and a new request supersedes it
//      (AUTH-RLS-DEC-033);
//   6. only after an `issued` answer, and only if the deadline has still not
//      passed, prepares exactly one delivery for that issuance and hands it
//      to deliverVerificationCode(), never to the transport's `send`
//      directly. The code is kept only for that single local delivery
//      attempt: it is held in this call's local variables and the one
//      prepared delivery, and is never stored, returned or logged. (This is
//      not a claim that memory is erased; JavaScript strings cannot be
//      wiped.) There is no retry: a resend is a new issuance that spends
//      budget (AUTH-RLS-DEC-037). The delivery outcome is reported as it came
//      back from the boundary, or as `not_attempted` if the delivery could not
//      be prepared or started.
//
// What an `issued` or `redeemed` answer proves, and what it does not: it is
// the database function's own answer. It shows committed state only if
// PostgREST runs the call as one READ COMMITTED transaction of its own, begun
// just before the function runs, and commits it before it sends the answer,
// and if no layer replays the POST. postgrest-js 2.108.2 does not retry a POST
// (its retry list holds only GET, HEAD and OPTIONS, for both network errors
// and 503/520 answers), and the composition tests show one POST per call
// through the real client, for both callers. Node's own `fetch` and the rest
// are unproved until a local database run, which needs Paul's
// AUTH-RLS-DEF-011 approval.
//
// The caller response deadline: before calling `rpc`, the caller records a
// monotonic deadline (`performance.now()` plus the configured limit) and arms
// a timer that aborts the call's AbortSignal at that time. It is the time the
// caller waits for an answer, not a limit on the call itself. The signal is
// passed through the seam's `abortSignal()`, which postgrest-js passes to
// `fetch`. The deadline is checked when the answer settles, so an answer
// whose callback runs late (for example after a stalled event loop, before
// the timer could fire) is late. It is checked again just before a delivery
// is prepared or a redemption is accepted. Late means `failed`, and nothing
// late is acted on, whenever (or whether) the call itself settles. At the
// deadline the abort requests cancellation through `fetch`; whether the
// transport cancels, and whether and when the call then settles, depend on
// the transport (postgrest-js turns `fetch`'s AbortError into an error
// answer), and nothing proves that PostgreSQL stopped or rolled back the call.
//
// Outstanding calls: each caller takes a slot before its database call and
// releases it only once that call has settled, even when the deadline has
// already decided the outcome, and (for issuance) once its one delivery has
// ended. A call that never settles holds its slot indefinitely, so a pool
// fails closed to `busy` rather than growing.
//
// The redeeming caller takes the purpose the route fixes and the client's
// selector and code, and refuses a malformed selector or code (whole-string
// checks, as above) without calling the database. It takes one redemption
// slot (`busy` if none is free), computes the verifier, calls
// `public.solmind_redeem_verification_challenge` once under a caller response
// deadline, and maps exactly one row `{ outcome: "redeemed" }`, received and
// still checked before the deadline, to `redeemed`, exactly one row
// `{ outcome: "denied" }` to `denied`, and everything else to `failed`. It
// never looks for the newest challenge and never compares a verifier itself:
// the database compare-and-set decides.
//
// Results are frozen, value-free objects from closed sets. The only value an
// issuance result carries is the challenge UUID, which AUTH-RLS-DEC-031
// makes the client's opaque selector; a redemption result carries none.
// Neither caller ever throws once constructed, logs, reads the environment,
// or puts a code, verifier, pepper, contact or database error text in a
// result or error. Construction errors are fixed and value-free.
//
// Outward opacity (AUTH-RLS-DEC-037; contract section 7.1.3): every issuance
// outcome maps to the same generic acknowledgment, with the result's UUID.
// That includes `invalid_request`, because a route that chose the binding
// from what it found in the database could otherwise reveal it through a
// distinct refusal; checking the format a user typed is the route's job,
// before it calls. Section 7.1.3 allows a calm actionable message only for a
// delivery condition the user can fix without learning whether an account,
// invitation, contact or role exists; every delivery outcome here follows an
// `issued` answer, so any distinct message would reveal that the contact
// was eligible. The response time still differs between `issued` (database
// plus delivery) and the other outcomes; the login route owns that timing.
//
// Not provided here, and owed before activation: the pepper's source and its
// startup check (AUTH-RLS-DEC-032); the one shared, unit-tested contact
// normalizer (AUTH-RLS-DEC-033), since these callers only check that a
// contact is already canonical; and the route-owned purpose and eligibility,
// since the route must fix the purpose and prove invitation, first-Admin or
// account eligibility before it calls.

export const VERIFICATION_CHALLENGE_ISSUANCE_FUNCTION =
  "solmind_issue_verification_challenge" as const;
export const VERIFICATION_CHALLENGE_REDEMPTION_FUNCTION =
  "solmind_redeem_verification_challenge" as const;

export const VERIFICATION_CHALLENGE_CONTACT_METHOD_TYPES = Object.freeze([
  "email",
  "phone",
] as const);

export type VerificationChallengeContactMethodType =
  (typeof VERIFICATION_CHALLENGE_CONTACT_METHOD_TYPES)[number];

// The delivery channel the issuance function requires for each contact type.
export const VERIFICATION_CHALLENGE_DELIVERY_CHANNEL_BY_CONTACT_TYPE = Object.freeze({
  email: "email",
  phone: "sms",
} as const satisfies Record<
  VerificationChallengeContactMethodType,
  VerificationCodeDeliveryChannel
>);

// The purposes the issuance function lets a caller issue with both binding
// UUIDs null. The function cannot prove the invitation or first-Admin
// eligibility behind them, and neither can this caller.
export const VERIFICATION_CHALLENGE_UNBOUND_PURPOSES = Object.freeze([
  "first_admin_setup",
  "login",
  "contact_verify",
] as const satisfies ReadonlyArray<VerificationCodeDeliveryPurpose>);

export const VERIFICATION_CHALLENGE_ISSUANCE_OUTCOMES = Object.freeze([
  "issued",
  "denied",
  "ineligible",
  "busy",
  "invalid_request",
  "failed",
] as const);

export type VerificationChallengeIssuanceOutcome =
  (typeof VERIFICATION_CHALLENGE_ISSUANCE_OUTCOMES)[number];

export const VERIFICATION_CHALLENGE_REDEMPTION_OUTCOMES = Object.freeze([
  "redeemed",
  "denied",
  "busy",
  "invalid_request",
  "failed",
] as const);

export type VerificationChallengeRedemptionOutcome =
  (typeof VERIFICATION_CHALLENGE_REDEMPTION_OUTCOMES)[number];

// After `issued`: one of the delivery boundary's nine outcomes, or
// `not_attempted` when the delivery could not be prepared or started.
export type VerificationChallengeDeliveryStatus =
  | VerificationCodeDeliveryOutcome
  | "not_attempted";

// The caller response deadline for each database call: how long the caller
// waits for an answer. A late answer is `failed` and is never acted on. It
// does not bound the call itself, which keeps its slot until it settles.
export const VERIFICATION_CHALLENGE_LIMITS = Object.freeze({
  minimumRpcTimeoutMilliseconds: 10,
  maximumRpcTimeoutMilliseconds: 60_000,
} as const);

// The one outward acknowledgment for every issuance outcome.
export const VERIFICATION_CHALLENGE_ACKNOWLEDGMENT =
  "verification_code_requested" as const;

export const VERIFICATION_CHALLENGE_ERROR_CODES = Object.freeze([
  "verification_challenge_invalid_configuration",
] as const);

export type VerificationChallengeErrorCode =
  (typeof VERIFICATION_CHALLENGE_ERROR_CODES)[number];

// Fixed, value-free construction errors. Issuing and redeeming never throw.
export class VerificationChallengeError extends Error {
  readonly code: VerificationChallengeErrorCode;

  constructor(code: VerificationChallengeErrorCode) {
    super(code);
    this.name = "VerificationChallengeError";
    this.code = code;
  }
}

// One database call, before it is sent: `abortSignal` attaches the signal
// and returns the awaitable call. postgrest-js's builder satisfies it.
export type VerificationChallengeRpcRequest = Readonly<{
  abortSignal(signal: AbortSignal): PromiseLike<unknown>;
}>;

// The narrow RPC seam. The server-only service-role Supabase client satisfies
// it. Each caller calls exactly one fixed function through it; neither caller
// accepts a function name from anyone.
export type VerificationChallengeRpcClient = Readonly<{
  rpc(
    functionName: string,
    args: Readonly<Record<string, string | null>>,
  ): VerificationChallengeRpcRequest;
}>;

// A pool of slots. tryAcquire() returns a release function, or null when no
// slot is free. A caller holds its slot until its database call has settled.
export type VerificationCallSlots = Readonly<{
  tryAcquire(): (() => void) | null;
}>;

export type VerificationChallengeIssuanceRequest = Readonly<{
  purpose: VerificationCodeDeliveryPurpose;
  contactMethodType: VerificationChallengeContactMethodType;
  normalizedContact: string;
  userAccountId: string | null;
  userContactMethodId: string | null;
}>;

export type VerificationChallengeIssuanceResult =
  | Readonly<{
      outcome: "issued";
      challengeId: string;
      delivery: VerificationChallengeDeliveryStatus;
    }>
  | Readonly<{
      outcome: Exclude<VerificationChallengeIssuanceOutcome, "issued">;
      challengeId: string;
    }>;

export type VerificationChallengeIssuanceAcknowledgment = Readonly<{
  acknowledgment: typeof VERIFICATION_CHALLENGE_ACKNOWLEDGMENT;
  challengeId: string;
}>;

export type VerificationChallengeRedemptionRequest = Readonly<{
  purpose: VerificationCodeDeliveryPurpose;
  challengeId: string;
  code: string;
}>;

export type VerificationChallengeRedemptionResult = Readonly<{
  outcome: VerificationChallengeRedemptionOutcome;
}>;

export type VerificationChallengeIssuer = Readonly<{
  issue(request: VerificationChallengeIssuanceRequest): Promise<VerificationChallengeIssuanceResult>;
}>;

export type VerificationChallengeRedeemer = Readonly<{
  redeem(
    request: VerificationChallengeRedemptionRequest,
  ): Promise<VerificationChallengeRedemptionResult>;
}>;

export type VerificationChallengeIssuerDependencies = Readonly<{
  rpcClient: VerificationChallengeRpcClient;
  rpcTimeoutMilliseconds: number;
  pepper: VerificationCodePepper;
  deliveryTransport: VerificationCodeDeliveryTransport;
  deliveryTimeoutMilliseconds: number;
}>;

export type VerificationChallengeRedeemerDependencies = Readonly<{
  rpcClient: VerificationChallengeRpcClient;
  rpcTimeoutMilliseconds: number;
  pepper: VerificationCodePepper;
}>;

// The issuance function's fixed errors that mean the contact or its binding
// is not eligible. Matched exactly, on PostgreSQL's raise_exception code.
const INELIGIBLE_ISSUANCE_ERROR_MESSAGES: ReadonlyArray<string> = Object.freeze([
  "solmind_issue_ineligible_contact",
  "solmind_issue_invalid_binding",
]);
const RAISE_EXCEPTION_CODE = "P0001";

const ISSUANCE_REQUEST_KEYS = Object.freeze([
  "purpose",
  "contactMethodType",
  "normalizedContact",
  "userAccountId",
  "userContactMethodId",
] as const);
const REDEMPTION_REQUEST_KEYS = Object.freeze(["purpose", "challengeId", "code"] as const);
const ISSUER_DEPENDENCY_KEYS = Object.freeze([
  "rpcClient",
  "rpcTimeoutMilliseconds",
  "pepper",
  "deliveryTransport",
  "deliveryTimeoutMilliseconds",
] as const);
const REDEEMER_DEPENDENCY_KEYS = Object.freeze([
  "rpcClient",
  "rpcTimeoutMilliseconds",
  "pepper",
] as const);
const TRANSPORT_KEYS = Object.freeze(["send"] as const);

// Mirrors public.solmind_issue_verification_challenge: E.164 phone. The email
// check is the delivery boundary's, which mirrors the same function. Neither
// pattern has the `m` flag, so `$` matches only at the very end of the text:
// a final line terminator is refused (tests pin this).
const E164_PHONE_PATTERN = /^\+[1-9][0-9]{7,14}$/;

const NIL_CHALLENGE_ID = "00000000-0000-0000-0000-000000000000";

const REDEMPTION_RESULTS = Object.freeze(
  Object.fromEntries(
    VERIFICATION_CHALLENGE_REDEMPTION_OUTCOMES.map((outcome) => [
      outcome,
      Object.freeze({ outcome }),
    ]),
  ) as Record<VerificationChallengeRedemptionOutcome, VerificationChallengeRedemptionResult>,
);

type RpcAnswer = Readonly<{ data: unknown; error: unknown }>;

type RpcCall = Readonly<{
  // The answer, or null when it is missing, malformed, rejected or late.
  answer: Promise<RpcAnswer | null>;
  // Settles once the call itself has settled, whatever the outcome.
  settled: Promise<void>;
  // The monotonic deadline, in performance.now() milliseconds.
  deadline: number;
}>;

function fail(code: VerificationChallengeErrorCode): never {
  throw new VerificationChallengeError(code);
}

// A fixed-size pool. tryAcquire() returns a release function that frees the
// slot once, however often it is called, or null when every slot is taken.
export function createVerificationCallSlots(maximum: number): VerificationCallSlots {
  if (typeof maximum !== "number" || !Number.isSafeInteger(maximum) || maximum < 1) {
    fail("verification_challenge_invalid_configuration");
  }
  let inUse = 0;
  return Object.freeze({
    tryAcquire: (): (() => void) | null => {
      if (inUse >= maximum) {
        return null;
      }
      inUse += 1;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          inUse -= 1;
        }
      };
    },
  });
}

// Reads the listed keys of a plain object through own data property
// descriptors only, so no getter, setter or Proxy `get` trap ever runs.
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

function isOneOf<T extends string>(values: ReadonlyArray<T>, value: unknown): value is T {
  return typeof value === "string" && (values as ReadonlyArray<string>).includes(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeout(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= VERIFICATION_CHALLENGE_LIMITS.minimumRpcTimeoutMilliseconds &&
    value <= VERIFICATION_CHALLENGE_LIMITS.maximumRpcTimeoutMilliseconds
  );
}

function isDeliveryTimeout(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= VERIFICATION_CODE_DELIVERY_LIMITS.minimumTimeoutMilliseconds &&
    value <= VERIFICATION_CODE_DELIVERY_LIMITS.maximumTimeoutMilliseconds
  );
}

// The RPC client and the slot pools are server-built objects whose methods
// may live on a prototype (the Supabase client's `rpc` does), so they are
// checked with an ordinary read inside a guard. Any exception is dropped.
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

// The delivery boundary reads the transport through own data properties, so
// the same is required here, at construction, to fail early on wiring.
function isDeliveryTransport(value: unknown): value is VerificationCodeDeliveryTransport {
  const fields = readExactDataProperties(value, TRANSPORT_KEYS);
  return fields !== null && typeof fields.get("send") === "function";
}

// True while the monotonic clock is still before the deadline. At or after
// it, the call is late.
function isBeforeDeadline(deadline: number): boolean {
  return performance.now() < deadline;
}

// Calls one fixed database function once. The monotonic deadline is recorded
// before `rpc` is called; a timer aborts the call's signal at the deadline and
// decides the answer as null if nothing came earlier. An answer is accepted
// only if its callback runs before the deadline, by the monotonic clock, so a
// callback delayed past the deadline is null even if the timer has not fired.
// A throw, a rejection, or an answer without readable `data`/`error` is null.
// `settled` follows the call itself, so the caller can hold its slot until
// the call is really over.
function startRpc(
  client: VerificationChallengeRpcClient,
  functionName: string,
  args: Readonly<Record<string, string | null>>,
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
  const settled = call.then(
    () => undefined,
    () => undefined,
  );
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
  return Object.freeze({ answer, settled, deadline });
}

// Exactly one row whose only key is `outcome`, holding one of `outcomes`.
function readSingleOutcome<T extends string>(
  data: unknown,
  outcomes: ReadonlyArray<T>,
): T | null {
  if (!Array.isArray(data) || data.length !== 1) {
    return null;
  }
  const row: unknown = data[0];
  if (!isPlainRecord(row)) {
    return null;
  }
  const keys = Object.keys(row);
  if (keys.length !== 1 || keys[0] !== "outcome") {
    return null;
  }
  return isOneOf(outcomes, row.outcome) ? row.outcome : null;
}

function isIneligibleIssuanceError(error: unknown): boolean {
  return (
    isPlainRecord(error) &&
    error.code === RAISE_EXCEPTION_CODE &&
    typeof error.message === "string" &&
    INELIGIBLE_ISSUANCE_ERROR_MESSAGES.includes(error.message)
  );
}

function mapIssuanceAnswer(answer: RpcAnswer | null): "issued" | "denied" | "ineligible" | "failed" {
  if (answer === null) {
    return "failed";
  }
  if (answer.error !== null && answer.error !== undefined) {
    return isIneligibleIssuanceError(answer.error) ? "ineligible" : "failed";
  }
  return readSingleOutcome(answer.data, ["issued", "denied"] as const) ?? "failed";
}

function mapRedemptionAnswer(answer: RpcAnswer | null): "redeemed" | "denied" | "failed" {
  if (answer === null || (answer.error !== null && answer.error !== undefined)) {
    return "failed";
  }
  return readSingleOutcome(answer.data, ["redeemed", "denied"] as const) ?? "failed";
}

function isBindingId(value: unknown): value is string {
  return isCanonicalVerificationChallengeId(value);
}

type ParsedIssuanceRequest = Readonly<{
  purpose: VerificationCodeDeliveryPurpose;
  contactMethodType: VerificationChallengeContactMethodType;
  channel: VerificationCodeDeliveryChannel;
  normalizedContact: string;
  userAccountId: string | null;
  userContactMethodId: string | null;
}>;

function parseIssuanceRequest(value: unknown): ParsedIssuanceRequest | null {
  const fields = readExactDataProperties(value, ISSUANCE_REQUEST_KEYS);
  if (fields === null) {
    return null;
  }
  const purpose = fields.get("purpose");
  const contactMethodType = fields.get("contactMethodType");
  const normalizedContact = fields.get("normalizedContact");
  const userAccountId = fields.get("userAccountId");
  const userContactMethodId = fields.get("userContactMethodId");
  if (!isVerificationCodePurpose(purpose)) {
    return null;
  }
  if (!isOneOf(VERIFICATION_CHALLENGE_CONTACT_METHOD_TYPES, contactMethodType)) {
    return null;
  }
  if (
    contactMethodType === "email"
      ? !isCanonicalVerificationEmail(normalizedContact)
      : typeof normalizedContact !== "string" || !E164_PHONE_PATTERN.test(normalizedContact)
  ) {
    return null;
  }
  if (userAccountId === null && userContactMethodId === null) {
    if (!isOneOf(VERIFICATION_CHALLENGE_UNBOUND_PURPOSES, purpose)) {
      return null;
    }
  } else if (!isBindingId(userAccountId) || !isBindingId(userContactMethodId)) {
    return null;
  }
  return Object.freeze({
    purpose,
    contactMethodType,
    channel: VERIFICATION_CHALLENGE_DELIVERY_CHANNEL_BY_CONTACT_TYPE[contactMethodType],
    normalizedContact: normalizedContact as string,
    userAccountId: userAccountId as string | null,
    userContactMethodId: userContactMethodId as string | null,
  });
}

function issuanceResult(
  outcome: Exclude<VerificationChallengeIssuanceOutcome, "issued">,
  challengeId: string,
): VerificationChallengeIssuanceResult {
  return Object.freeze({ outcome, challengeId });
}

function issuedResult(
  challengeId: string,
  delivery: VerificationChallengeDeliveryStatus,
): VerificationChallengeIssuanceResult {
  return Object.freeze({ outcome: "issued" as const, challengeId, delivery });
}

function acquireSlot(slots: VerificationCallSlots): (() => void) | null {
  try {
    const release: unknown = slots.tryAcquire();
    return typeof release === "function" ? (release as () => void) : null;
  } catch {
    return null;
  }
}

// Releases a slot once the database call has settled (immediately if it
// already has). A release that throws is dropped: the outcome is decided.
function releaseWhenSettled(settled: Promise<void>, release: () => void): void {
  void settled.then(() => {
    try {
      release();
    } catch {
      // Dropped unread.
    }
  });
}

// The issuer, bound to one slot pool. Only the public module and the named
// unit tests reach this; see the module comment.
export function createVerificationChallengeIssuerWithSlots(
  dependencies: VerificationChallengeIssuerDependencies,
  issuanceSlots: VerificationCallSlots,
): VerificationChallengeIssuer {
  const fields = readExactDataProperties(dependencies, ISSUER_DEPENDENCY_KEYS);
  if (fields === null) {
    fail("verification_challenge_invalid_configuration");
  }
  const rpcClient = fields.get("rpcClient");
  const rpcTimeoutMilliseconds = fields.get("rpcTimeoutMilliseconds");
  const pepper = fields.get("pepper");
  const deliveryTransport = fields.get("deliveryTransport");
  const deliveryTimeoutMilliseconds = fields.get("deliveryTimeoutMilliseconds");
  if (
    !hasCallable(rpcClient, "rpc") ||
    !isTimeout(rpcTimeoutMilliseconds) ||
    !isVerificationCodePepper(pepper) ||
    !isDeliveryTransport(deliveryTransport) ||
    !isDeliveryTimeout(deliveryTimeoutMilliseconds) ||
    !hasCallable(issuanceSlots, "tryAcquire")
  ) {
    fail("verification_challenge_invalid_configuration");
  }
  const client = rpcClient as VerificationChallengeRpcClient;
  const rpcTimeout = rpcTimeoutMilliseconds as number;
  const pepperHandle = pepper as VerificationCodePepper;
  const transport = deliveryTransport as VerificationCodeDeliveryTransport;
  const deliveryTimeout = deliveryTimeoutMilliseconds as number;
  const slots = issuanceSlots as VerificationCallSlots;

  async function deliverOnce(
    request: ParsedIssuanceRequest,
    challengeId: string,
    code: string,
  ): Promise<VerificationChallengeDeliveryStatus> {
    let delivery: PreparedVerificationCodeDelivery;
    try {
      delivery = prepareVerificationCodeDelivery({
        issuanceOutcome: "issued",
        channel: request.channel,
        normalizedContact: request.normalizedContact,
        code,
        purpose: request.purpose,
        challengeId,
      });
    } catch {
      return "not_attempted";
    }
    try {
      const result = await deliverVerificationCode({
        delivery,
        transport,
        timeoutMilliseconds: deliveryTimeout,
      });
      return result.outcome;
    } catch {
      // The boundary throws only before it calls the transport.
      return "not_attempted";
    }
  }

  async function issue(request: unknown): Promise<VerificationChallengeIssuanceResult> {
    let challengeId: string;
    try {
      challengeId = generateVerificationChallengeId();
    } catch {
      // Node's randomUUID fails only if the system's random source does.
      // The fixed nil UUID keeps the result's shape; it is not version 4, so
      // randomUUID never issues it, and redeeming it is `denied`.
      return issuanceResult("failed", NIL_CHALLENGE_ID);
    }
    const parsed = parseIssuanceRequest(request);
    if (parsed === null) {
      return issuanceResult("invalid_request", challengeId);
    }
    const release = acquireSlot(slots);
    if (release === null) {
      return issuanceResult("busy", challengeId);
    }
    let callSettled: Promise<void> = Promise.resolve();
    try {
      // The code is kept only for the single local delivery attempt below.
      const code = generateVerificationCode();
      const verifier = computeVerificationCodeVerifier(
        pepperHandle,
        challengeId,
        parsed.purpose,
        code,
      );
      const call = startRpc(
        client,
        VERIFICATION_CHALLENGE_ISSUANCE_FUNCTION,
        {
          p_verification_challenge_id: challengeId,
          p_normalized_contact_value: parsed.normalizedContact,
          p_contact_method_type: parsed.contactMethodType,
          p_purpose: parsed.purpose,
          p_delivery_channel: parsed.channel,
          p_verifier: verifier,
          p_user_account_id: parsed.userAccountId,
          p_user_contact_method_id: parsed.userContactMethodId,
        },
        rpcTimeout,
      );
      callSettled = call.settled;
      const outcome = mapIssuanceAnswer(await call.answer);
      if (outcome !== "issued") {
        // The code is dropped undelivered.
        return issuanceResult(outcome, challengeId);
      }
      // Checked again just before the delivery: nothing late is acted on.
      if (!isBeforeDeadline(call.deadline)) {
        return issuanceResult("failed", challengeId);
      }
      // Exactly one delivery, bound to this issuance answer.
      return issuedResult(challengeId, await deliverOnce(parsed, challengeId, code));
    } catch {
      return issuanceResult("failed", challengeId);
    } finally {
      // The slot is held until the database call has settled and the one
      // delivery has ended, so the pool bounds outstanding calls, not only
      // sends.
      releaseWhenSettled(callSettled, release);
    }
  }

  return Object.freeze({
    issue: (request: VerificationChallengeIssuanceRequest) => issue(request),
  });
}

// The redeemer, bound to one slot pool. Only the public module and the named
// unit tests reach this; see the module comment.
export function createVerificationChallengeRedeemerWithSlots(
  dependencies: VerificationChallengeRedeemerDependencies,
  redemptionSlots: VerificationCallSlots,
): VerificationChallengeRedeemer {
  const fields = readExactDataProperties(dependencies, REDEEMER_DEPENDENCY_KEYS);
  if (fields === null) {
    fail("verification_challenge_invalid_configuration");
  }
  const rpcClient = fields.get("rpcClient");
  const rpcTimeoutMilliseconds = fields.get("rpcTimeoutMilliseconds");
  const pepper = fields.get("pepper");
  if (
    !hasCallable(rpcClient, "rpc") ||
    !isTimeout(rpcTimeoutMilliseconds) ||
    !isVerificationCodePepper(pepper) ||
    !hasCallable(redemptionSlots, "tryAcquire")
  ) {
    fail("verification_challenge_invalid_configuration");
  }
  const client = rpcClient as VerificationChallengeRpcClient;
  const rpcTimeout = rpcTimeoutMilliseconds as number;
  const pepperHandle = pepper as VerificationCodePepper;
  const slots = redemptionSlots as VerificationCallSlots;

  async function redeem(request: unknown): Promise<VerificationChallengeRedemptionResult> {
    const input = readExactDataProperties(request, REDEMPTION_REQUEST_KEYS);
    if (input === null) {
      return REDEMPTION_RESULTS.invalid_request;
    }
    const purpose = input.get("purpose");
    const challengeId = input.get("challengeId");
    const code = input.get("code");
    if (
      !isVerificationCodePurpose(purpose) ||
      !isCanonicalVerificationChallengeId(challengeId) ||
      !isSixDigitVerificationCode(code)
    ) {
      return REDEMPTION_RESULTS.invalid_request;
    }
    const release = acquireSlot(slots);
    if (release === null) {
      return REDEMPTION_RESULTS.busy;
    }
    let callSettled: Promise<void> = Promise.resolve();
    try {
      const verifier = computeVerificationCodeVerifier(pepperHandle, challengeId, purpose, code);
      const call = startRpc(
        client,
        VERIFICATION_CHALLENGE_REDEMPTION_FUNCTION,
        {
          p_verification_challenge_id: challengeId,
          p_purpose: purpose,
          p_verifier: verifier,
        },
        rpcTimeout,
      );
      callSettled = call.settled;
      const outcome = mapRedemptionAnswer(await call.answer);
      // Checked again before a redemption is accepted: nothing late is acted on.
      if (outcome === "redeemed" && !isBeforeDeadline(call.deadline)) {
        return REDEMPTION_RESULTS.failed;
      }
      return REDEMPTION_RESULTS[outcome];
    } catch {
      return REDEMPTION_RESULTS.failed;
    } finally {
      releaseWhenSettled(callSettled, release);
    }
  }

  return Object.freeze({
    redeem: (request: VerificationChallengeRedemptionRequest) => redeem(request),
  });
}

// The one generic outward acknowledgment, for every issuance outcome. The
// login route sends this, never the internal outcome.
export function toVerificationChallengeIssuanceAcknowledgment(
  result: VerificationChallengeIssuanceResult,
): VerificationChallengeIssuanceAcknowledgment {
  return Object.freeze({
    acknowledgment: VERIFICATION_CHALLENGE_ACKNOWLEDGMENT,
    challengeId: result.challengeId,
  });
}
