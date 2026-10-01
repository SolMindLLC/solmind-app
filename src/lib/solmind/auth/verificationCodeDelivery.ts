import "server-only";

// Login step 4: the server-only, provider-neutral verification-code delivery
// boundary (execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md
// section 7.1.3; AUTH-RLS-DEC-032, AUTH-RLS-DEC-033 and AUTH-RLS-DEC-037).
//
// What it does:
//   - prepareVerificationCodeDelivery() refuses every issuance outcome other
//     than `issued` and returns an opaque handle with no readable values, so
//     logging or serializing the handle cannot leak the code or the contact.
//   - deliverVerificationCode() calls one injected transport's `send` at most
//     once per prepared handle. The retry ceiling is 0: no retry happens here,
//     including after `ambiguous` or `timeout`, and a handle cannot be
//     delivered twice. `retryable_failure` never permits resending the same
//     code; under AUTH-RLS-DEC-033 the only retry path is supersede-and-reissue,
//     which is a new issuance that uses the committed-issuance budget
//     (AUTH-RLS-DEC-037).
//   - The elapsed-time ceiling is bounded (10 ms to 15 s). When it is reached
//     the transport is aborted and given one turn of the event loop to
//     report. Only `ambiguous` (or a rejection, which counts as `ambiguous`)
//     can win in that turn: the local transport reports `ambiguous` if the
//     message had started. Anything else, or no answer, is `timeout`, so no
//     success is ever reported after the deadline. Like `ambiguous`, `timeout`
//     means the code may or may not have been sent.
//   - Results are one frozen, value-free `{ outcome }` object from a closed set.
//     Before the ceiling, a transport that throws, rejects or returns anything
//     outside the set is `ambiguous`, never `retryable_failure`, because
//     nobody can know whether the code was sent. After it, see the ceiling.
//   - Inputs are read only through own data property descriptors: getters and
//     setters on the fields this module reads are refused, extra fields that
//     the delivery input tolerates are never read, and any exception while
//     reading an input (for example from a hostile Proxy trap) becomes a
//     fixed, value-free error. The exception itself is dropped unread.
//
// What it cannot prove, so the login step 5 caller must:
//   - The `issued` check is a trusted-caller precondition, not proof. This
//     module cannot see the database, so it cannot tell whether a challenge
//     really committed. The caller must bind each delivery to its own
//     committed issuance result and prove that ordering in its own tests.
//   - Duplicate suppression is per prepared handle only: two handles prepared
//     with the same challenge and code are two sends. The caller chooses the
//     challenge id and holds the only plaintext code (AUTH-RLS-DEC-033), and a
//     registry here would not hold across server instances. So the caller must
//     prepare exactly one delivery per committed issuance, keep no copy of
//     the code, and reach the transport only through deliverVerificationCode(),
//     never by calling the transport's `send` directly.
//   - Spend and delivery proof belong to the transport. This module meters no
//     spend and passes through whatever closed outcome the transport returns,
//     including `delivered`. The local development transport has a spend
//     ceiling of 0 and never returns `delivered`. A future provider adapter
//     must state and prove its own spend ceiling and delivery proof, with its
//     own reviewed idempotency, retry and elapsed-time limits, before
//     activation.
//
// What it never does: generate a code, compute or read a verifier or pepper,
// write to a database, audit table or logger, read environment variables, fall
// back to a fake transport, or say whether an account, invitation, contact or
// role exists. Mapping outcomes to the one generic outward response belongs to
// the future server caller. Keep this module direct-import only and off every
// barrel.

export const VERIFICATION_CODE_DELIVERY_CHANNELS = Object.freeze([
  "email",
  "sms",
] as const);

export type VerificationCodeDeliveryChannel =
  (typeof VERIFICATION_CODE_DELIVERY_CHANNELS)[number];

// The schema-constrained challenge purposes (contract section 7.1).
export const VERIFICATION_CODE_DELIVERY_PURPOSES = Object.freeze([
  "login",
  "password_reset",
  "contact_verify",
  "first_admin_setup",
  "role_reentry",
] as const);

export type VerificationCodeDeliveryPurpose =
  (typeof VERIFICATION_CODE_DELIVERY_PURPOSES)[number];

// The closed outcome vocabulary required by contract section 7.1.3.
// `delivered` is only for a provider that can prove delivery; `accepted` means
// the next hop took the message, nothing more. `cleanup_failure` is reserved
// for a provider adapter that must clean up provider-side state.
export const VERIFICATION_CODE_DELIVERY_OUTCOMES = Object.freeze([
  "accepted",
  "delivered",
  "bounced",
  "throttled",
  "ambiguous",
  "timeout",
  "retryable_failure",
  "terminal_failure",
  "cleanup_failure",
] as const);

export type VerificationCodeDeliveryOutcome =
  (typeof VERIFICATION_CODE_DELIVERY_OUTCOMES)[number];

// One send per prepared handle, not per challenge: see the module comment for
// the caller's obligation. The spend ceiling belongs to each transport.
export const VERIFICATION_CODE_DELIVERY_LIMITS = Object.freeze({
  retryCeiling: 0,
  attemptsPerPreparedDelivery: 1,
  minimumTimeoutMilliseconds: 10,
  maximumTimeoutMilliseconds: 15_000,
} as const);

export const VERIFICATION_CODE_DELIVERY_ERROR_CODES = Object.freeze([
  "verification_code_delivery_not_issued",
  "verification_code_delivery_invalid_request",
  "verification_code_delivery_invalid_transport",
  "verification_code_delivery_invalid_timeout",
  "verification_code_delivery_already_attempted",
] as const);

export type VerificationCodeDeliveryErrorCode =
  (typeof VERIFICATION_CODE_DELIVERY_ERROR_CODES)[number];

// Fixed, value-free programming/configuration errors. A delivery attempt never
// throws; it returns a result.
export class VerificationCodeDeliveryError extends Error {
  readonly code: VerificationCodeDeliveryErrorCode;

  constructor(code: VerificationCodeDeliveryErrorCode) {
    super(code);
    this.name = "VerificationCodeDeliveryError";
    this.code = code;
  }
}

// What a transport receives. It carries the plaintext code only in memory for
// the one send; the transport must not log, store or echo any of it.
export type VerificationCodeDeliveryRequest = Readonly<{
  channel: VerificationCodeDeliveryChannel;
  normalizedContact: string;
  code: string;
  purpose: VerificationCodeDeliveryPurpose;
  challengeId: string | null;
}>;

export type PrepareVerificationCodeDeliveryInput = Readonly<{
  // The outcome returned by public.solmind_issue_verification_challenge. Only
  // `issued` may be delivered; `denied` and every failure deliver nothing.
  // This is the caller's word, not proof of a committed issuance.
  issuanceOutcome: "issued";
  channel: VerificationCodeDeliveryChannel;
  normalizedContact: string;
  code: string;
  purpose: VerificationCodeDeliveryPurpose;
  challengeId?: string;
}>;

declare const preparedVerificationCodeDeliveryBrand: unique symbol;

// An opaque handle. It has no own properties, so it serializes to `{}`.
export type PreparedVerificationCodeDelivery = Readonly<{
  [preparedVerificationCodeDeliveryBrand]: true;
}>;

export type VerificationCodeDeliveryResult = Readonly<{
  outcome: VerificationCodeDeliveryOutcome;
}>;

// The one capability a provider or development implementation supplies. The
// signal is aborted when the elapsed-time ceiling is reached.
export type VerificationCodeDeliveryTransport = Readonly<{
  send: (
    request: VerificationCodeDeliveryRequest,
    signal: AbortSignal,
  ) => Promise<unknown>;
}>;

const PREPARE_KEYS = Object.freeze([
  "issuanceOutcome",
  "channel",
  "normalizedContact",
  "code",
  "purpose",
  "challengeId",
] as const);
const REQUIRED_PREPARE_KEYS = Object.freeze([
  "issuanceOutcome",
  "channel",
  "normalizedContact",
  "code",
  "purpose",
] as const);
const DELIVER_KEYS = Object.freeze([
  "delivery",
  "transport",
  "timeoutMilliseconds",
] as const);
const TRANSPORT_KEYS = Object.freeze(["send"] as const);

// Mirrors the canonical checks in public.solmind_issue_verification_challenge
// (migration 20260929010000): lowercase canonical email, 3 to 254 characters,
// no consecutive dots; E.164 phone. Neither pattern admits CR, LF, spaces or
// angle brackets.
const CANONICAL_EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+$/;
const E164_PHONE_PATTERN = /^\+[1-9][0-9]{7,14}$/;
const SIX_DIGIT_CODE_PATTERN = /^[0-9]{6}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const RESULTS = Object.freeze(
  Object.fromEntries(
    VERIFICATION_CODE_DELIVERY_OUTCOMES.map((outcome) => [
      outcome,
      Object.freeze({ outcome }),
    ]),
  ) as Record<VerificationCodeDeliveryOutcome, VerificationCodeDeliveryResult>,
);

// Prepared requests live only here, keyed by their opaque handle. A handle is
// removed on its one delivery attempt and remembered as attempted.
const preparedRequests = new WeakMap<object, VerificationCodeDeliveryRequest>();
const attemptedDeliveries = new WeakSet<object>();

function fail(code: VerificationCodeDeliveryErrorCode): never {
  throw new VerificationCodeDeliveryError(code);
}

// Reads the listed keys of a plain object through own data property
// descriptors only, so no getter, setter or Proxy `get` trap ever runs.
// Returns null when the value is not a plain object, when a listed key holds
// an accessor, or when any reflection call throws (for example in a hostile
// Proxy trap). The exception is dropped unread, so it can never carry the
// code or the contact out of this module. Absent keys are missing from the
// map; other own keys are not read here.
function readOwnDataProperties(
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
    const fields = new Map<string, unknown>();
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        continue;
      }
      // A data descriptor always has its own `value`; an accessor never has.
      if (!Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        return null;
      }
      fields.set(key, descriptor.value);
    }
    return fields;
  } catch {
    return null;
  }
}

// True when every own key is one of `keys`, is a string and is enumerable.
// Any exception from a reflection call gives false and is dropped unread.
function hasOnlyEnumerableKeys(value: object, keys: ReadonlyArray<string>): boolean {
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (
        typeof key !== "string" ||
        !keys.includes(key) ||
        !Object.prototype.propertyIsEnumerable.call(value, key)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function isOneOf<T extends string>(
  values: ReadonlyArray<T>,
  value: unknown,
): value is T {
  return typeof value === "string" && (values as ReadonlyArray<string>).includes(value);
}

export function isCanonicalVerificationEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 254 &&
    CANONICAL_EMAIL_PATTERN.test(value) &&
    !value.includes("..")
  );
}

export function isSixDigitVerificationCode(value: unknown): value is string {
  return typeof value === "string" && SIX_DIGIT_CODE_PATTERN.test(value);
}

function isE164Phone(value: unknown): value is string {
  return typeof value === "string" && E164_PHONE_PATTERN.test(value);
}

export function prepareVerificationCodeDelivery(
  input: PrepareVerificationCodeDeliveryInput,
): PreparedVerificationCodeDelivery {
  const raw: unknown = input;
  const fields = readOwnDataProperties(raw, PREPARE_KEYS);
  if (fields === null) {
    fail("verification_code_delivery_invalid_request");
  }
  if (fields.get("issuanceOutcome") !== "issued") {
    fail("verification_code_delivery_not_issued");
  }
  if (!hasOnlyEnumerableKeys(raw as object, PREPARE_KEYS)) {
    fail("verification_code_delivery_invalid_request");
  }
  for (const key of REQUIRED_PREPARE_KEYS) {
    if (!fields.has(key)) {
      fail("verification_code_delivery_invalid_request");
    }
  }

  const channel = fields.get("channel");
  const normalizedContact = fields.get("normalizedContact");
  const code = fields.get("code");
  const purpose = fields.get("purpose");
  if (!isOneOf(VERIFICATION_CODE_DELIVERY_CHANNELS, channel)) {
    fail("verification_code_delivery_invalid_request");
  }
  if (
    channel === "email"
      ? !isCanonicalVerificationEmail(normalizedContact)
      : !isE164Phone(normalizedContact)
  ) {
    fail("verification_code_delivery_invalid_request");
  }
  if (!isSixDigitVerificationCode(code)) {
    fail("verification_code_delivery_invalid_request");
  }
  if (!isOneOf(VERIFICATION_CODE_DELIVERY_PURPOSES, purpose)) {
    fail("verification_code_delivery_invalid_request");
  }
  let challengeId: string | null = null;
  if (fields.has("challengeId")) {
    const suppliedChallengeId = fields.get("challengeId");
    if (
      typeof suppliedChallengeId !== "string" ||
      !UUID_PATTERN.test(suppliedChallengeId)
    ) {
      fail("verification_code_delivery_invalid_request");
    }
    challengeId = suppliedChallengeId;
  }

  const request: VerificationCodeDeliveryRequest = Object.freeze({
    channel,
    normalizedContact: normalizedContact as string,
    code,
    purpose,
    challengeId,
  });
  const handle = Object.freeze({}) as PreparedVerificationCodeDelivery;
  preparedRequests.set(handle, request);
  return handle;
}

function parseTimeout(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < VERIFICATION_CODE_DELIVERY_LIMITS.minimumTimeoutMilliseconds ||
    value > VERIFICATION_CODE_DELIVERY_LIMITS.maximumTimeoutMilliseconds
  ) {
    fail("verification_code_delivery_invalid_timeout");
  }
  return value;
}

function parseTransport(
  value: unknown,
): VerificationCodeDeliveryTransport["send"] {
  const fields = readOwnDataProperties(value, TRANSPORT_KEYS);
  if (fields === null || !hasOnlyEnumerableKeys(value as object, TRANSPORT_KEYS)) {
    fail("verification_code_delivery_invalid_transport");
  }
  const send = fields.get("send");
  if (typeof send !== "function") {
    fail("verification_code_delivery_invalid_transport");
  }
  return send as VerificationCodeDeliveryTransport["send"];
}

function consumePreparedDelivery(
  value: unknown,
): VerificationCodeDeliveryRequest {
  if (value === null || typeof value !== "object") {
    fail("verification_code_delivery_invalid_request");
  }
  if (attemptedDeliveries.has(value)) {
    fail("verification_code_delivery_already_attempted");
  }
  const request = preparedRequests.get(value);
  if (request === undefined) {
    fail("verification_code_delivery_invalid_request");
  }
  preparedRequests.delete(value);
  attemptedDeliveries.add(value);
  return request;
}

function toOutcome(value: unknown): VerificationCodeDeliveryOutcome {
  return isOneOf(VERIFICATION_CODE_DELIVERY_OUTCOMES, value) ? value : "ambiguous";
}

export async function deliverVerificationCode(
  input: Readonly<{
    delivery: PreparedVerificationCodeDelivery;
    transport: VerificationCodeDeliveryTransport;
    timeoutMilliseconds: number;
  }>,
): Promise<VerificationCodeDeliveryResult> {
  const fields = readOwnDataProperties(input, DELIVER_KEYS);
  if (fields === null) {
    fail("verification_code_delivery_invalid_request");
  }
  // Configuration is checked before the handle is consumed, so a wiring
  // mistake neither sends anything nor burns the prepared delivery.
  const timeoutMilliseconds = parseTimeout(fields.get("timeoutMilliseconds"));
  const send = parseTransport(fields.get("transport"));
  const request = consumePreparedDelivery(fields.get("delivery"));

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  let ceilingReached = false;
  // At the ceiling the transport is aborted and given one turn of the event
  // loop to report. A transport that knows the message had started, like the
  // local one, settles on abort with `ambiguous`, and that result wins. Any
  // other result in that turn, or none, is `timeout`, so a success can never
  // be reported after the deadline.
  const elapsedCeiling = new Promise<VerificationCodeDeliveryOutcome>((resolve) => {
    timer = setTimeout(() => {
      ceilingReached = true;
      controller.abort();
      graceTimer = setTimeout(() => {
        resolve("timeout");
      }, 0);
    }, timeoutMilliseconds);
  });

  // The single attempt. Every rejection, including one that arrives after the
  // ceiling has already decided the result, is absorbed here, and a
  // synchronous throw inside `send` becomes a rejection. The module's own
  // promise adopts whatever `send` returns, which confines a returned promise
  // with a hostile `then`: it can delay the result until the ceiling, but
  // whatever it yields still reaches the callback below, and both of that
  // callback's branches give a closed-set outcome:
  //   - before the ceiling, `toOutcome` normalises the value, so anything
  //     outside the closed set is `ambiguous`;
  //   - after it, the raw value is compared and not normalised: only the
  //     literal `ambiguous` (or a rejection) may win, and any other value,
  //     including one outside the set, gives `timeout`, not `ambiguous`.
  // The branch depends on when the fulfilment is processed, not on when the
  // transport settled.
  const attempt = new Promise<unknown>((resolve) => {
    resolve(send(request, controller.signal));
  }).then(
    (value): VerificationCodeDeliveryOutcome =>
      ceilingReached ? (value === "ambiguous" ? "ambiguous" : "timeout") : toOutcome(value),
    () => "ambiguous" as const,
  );

  try {
    // Checked again, so only a closed-set outcome ever indexes RESULTS.
    return RESULTS[toOutcome(await Promise.race([attempt, elapsedCeiling]))];
  } finally {
    clearTimeout(timer);
    clearTimeout(graceTimer);
  }
}
