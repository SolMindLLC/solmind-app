import "server-only";

import {
  createHmac,
  createSecretKey,
  randomInt,
  randomUUID,
  type KeyObject,
} from "node:crypto";

import {
  VERIFICATION_CODE_DELIVERY_PURPOSES,
  isSixDigitVerificationCode,
  type VerificationCodeDeliveryPurpose,
} from "./verificationCodeDelivery";

// Login step 5: the verification-code module. It generates the six-digit
// code and the challenge UUID and computes the versioned HMAC verifier that
// AUTH-RLS-DEC-032 fixes
// (execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md,
// the AUTH-RLS-DEC-032 row and its "DEF5-S2 register-first clarification
// (2026-07-12)").
//
// The verifier, exactly as the register fixes it:
//   - format: `svf1:` followed by 64 lowercase hexadecimal HMAC-SHA-256
//     characters, 69 ASCII characters in all;
//   - message: the ASCII fields `solmind-verification-challenge-svf1`, the
//     lowercase canonical challenge UUID, the purpose and the six-digit code,
//     joined by the byte 0x0A, with nothing before or after;
//   - key: the server-held pepper, at least 32 bytes. One format version is
//     accepted at a time; rotating the pepper does not change the version and
//     makes every still-open challenge unredeemable, so users ask for a new
//     code.
//
// Only the verifier crosses the service-role RPC boundary. The plaintext code
// and the pepper never do. The comparison belongs to PostgreSQL: the banked
// redemption function compares the stored verifier with byte-exact text
// equality (its own comment accepts that non-constant-time equality at this
// internal HMAC boundary), so this module compares nothing and creates no
// second verification authority.
//
// Codes come from Node's `randomInt`, which picks uniformly from 0 to 999,999,
// and are zero-padded to six digits. Challenge UUIDs come from `randomUUID`
// (lowercase version 4).
//
// The pepper is held behind an opaque handle with no own properties, so
// logging or serializing the handle shows `{}`. The bytes live only in a
// Node `KeyObject` that this module keeps out of reach. Where the pepper comes
// from (an environment variable, its name and its encoding) and the startup
// check that AUTH-RLS-DEC-032 asks for belong to activation, not to this
// module: it reads no environment variable.
//
// What it never does: log, write a database or audit record, read the
// environment, compare verifiers, or put a code, pepper, verifier, contact or
// challenge UUID in an error. Keep it direct-import only and off every barrel.

export const VERIFICATION_CODE_VERIFIER_VERSION = "svf1" as const;
export const VERIFICATION_CODE_VERIFIER_PREFIX = "svf1:" as const;
export const VERIFICATION_CODE_VERIFIER_DOMAIN =
  "solmind-verification-challenge-svf1" as const;

export const VERIFICATION_CODE_LIMITS = Object.freeze({
  codeDigits: 6,
  // `randomInt`'s upper bound is exclusive: codes run from 000000 to 999999.
  codeUpperBoundExclusive: 1_000_000,
  minimumPepperBytes: 32,
  verifierCharacters: 69,
} as const);

export const VERIFICATION_CODE_ERROR_CODES = Object.freeze([
  "verification_code_invalid_pepper",
  "verification_code_invalid_verifier_input",
] as const);

export type VerificationCodeErrorCode =
  (typeof VERIFICATION_CODE_ERROR_CODES)[number];

// Fixed, value-free errors: the message is the code and nothing else.
export class VerificationCodeError extends Error {
  readonly code: VerificationCodeErrorCode;

  constructor(code: VerificationCodeErrorCode) {
    super(code);
    this.name = "VerificationCodeError";
    this.code = code;
  }
}

declare const verificationCodePepperBrand: unique symbol;

// An opaque handle. It has no own properties, so it serializes to `{}`.
export type VerificationCodePepper = Readonly<{
  [verificationCodePepperBrand]: true;
}>;

// Whole-string patterns: without the `m` flag, JavaScript's `$` matches only
// at the very end of the text, so a final line terminator (LF, CR, CRLF,
// U+2028 or U+2029) is refused. The tests pin this.
const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VERIFIER_PATTERN = /^svf1:[0-9a-f]{64}$/;
const MESSAGE_SEPARATOR = "\n";

const pepperKeys = new WeakMap<object, KeyObject>();

function fail(code: VerificationCodeErrorCode): never {
  throw new VerificationCodeError(code);
}

// True for a lowercase canonical 8-4-4-4-12 UUID, the only form the verifier
// message accepts. An uppercase UUID would name the same database row but
// give a different verifier, so it is refused rather than silently
// mismatched.
export function isCanonicalVerificationChallengeId(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID_PATTERN.test(value);
}

export function isVerificationCodePurpose(
  value: unknown,
): value is VerificationCodeDeliveryPurpose {
  return (
    typeof value === "string" &&
    (VERIFICATION_CODE_DELIVERY_PURPOSES as ReadonlyArray<string>).includes(value)
  );
}

export function isVerificationCodeVerifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === VERIFICATION_CODE_LIMITS.verifierCharacters &&
    VERIFIER_PATTERN.test(value)
  );
}

export function isVerificationCodePepper(value: unknown): value is VerificationCodePepper {
  return typeof value === "object" && value !== null && pepperKeys.has(value);
}

// Wraps at least 32 pepper bytes in an opaque handle. The bytes are copied
// into a `KeyObject`; the caller's buffer is not kept. Anything that is not a
// genuine typed array or DataView (a Proxy is not) or is shorter than 32 bytes
// gives a fixed, value-free error. The bytes' randomness cannot be checked
// here; supplying CSPRNG bytes is the configuration's duty.
export function createVerificationCodePepper(bytes: ArrayBufferView): VerificationCodePepper {
  let key: KeyObject;
  try {
    if (!ArrayBuffer.isView(bytes)) {
      fail("verification_code_invalid_pepper");
    }
    if (bytes.byteLength < VERIFICATION_CODE_LIMITS.minimumPepperBytes) {
      fail("verification_code_invalid_pepper");
    }
    key = createSecretKey(
      new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    );
    if (key.symmetricKeySize !== bytes.byteLength) {
      fail("verification_code_invalid_pepper");
    }
  } catch {
    // Whatever was thrown is dropped unread, so it cannot carry the bytes out.
    fail("verification_code_invalid_pepper");
  }
  const handle = Object.freeze({}) as VerificationCodePepper;
  pepperKeys.set(handle, key);
  return handle;
}

// A uniformly random six-digit code, from 000000 to 999999.
export function generateVerificationCode(): string {
  return String(randomInt(0, VERIFICATION_CODE_LIMITS.codeUpperBoundExclusive)).padStart(
    VERIFICATION_CODE_LIMITS.codeDigits,
    "0",
  );
}

// A new challenge UUID (lowercase version 4). The issuing caller chooses it
// before issuance, as the issuance function requires.
export function generateVerificationChallengeId(): string {
  return randomUUID();
}

// Computes the `svf1:` verifier for one challenge. Every argument is a
// primitive or the opaque pepper handle, so no getter or Proxy trap can run.
// Invalid input gives a fixed, value-free error.
export function computeVerificationCodeVerifier(
  pepper: VerificationCodePepper,
  challengeId: string,
  purpose: VerificationCodeDeliveryPurpose,
  code: string,
): string {
  const key = isVerificationCodePepper(pepper) ? pepperKeys.get(pepper) : undefined;
  if (
    key === undefined ||
    !isCanonicalVerificationChallengeId(challengeId) ||
    !isVerificationCodePurpose(purpose) ||
    !isSixDigitVerificationCode(code)
  ) {
    fail("verification_code_invalid_verifier_input");
  }
  const message = [VERIFICATION_CODE_VERIFIER_DOMAIN, challengeId, purpose, code].join(
    MESSAGE_SEPARATOR,
  );
  const digest = createHmac("sha256", key).update(message, "ascii").digest("hex");
  return `${VERIFICATION_CODE_VERIFIER_PREFIX}${digest}`;
}
