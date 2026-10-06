import "server-only";

import { Buffer } from "node:buffer";

import { createVerificationCodePepper, type VerificationCodePepper } from "./verificationCode";

// Login step 6, sub-slice S6-1: the verification pepper's source.
//
// Source of truth: solmind-docs
// `execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`,
// AUTH-RLS-DEC-032: the pepper is at least 32 random bytes, server-only, never
// `NEXT_PUBLIC_`, never stored in the database, and required at startup;
// missing or malformed configuration fails closed with a bounded value-free
// operational signal. Login step 5 left its source and startup check owed
// before activation; this module is the source, and the login route
// configuration beside it holds the startup check. Paul's 2026-10-05 evening
// decision 1 accepted that the settings banked decisions already require
// (this pepper among them) are within login step 6; the contract 25 wording
// that records that meaning, and its register record, belong to sub-slice
// S6-3.
//
// The setting. One server-only environment variable,
// `SOLMIND_VERIFICATION_PEPPER`, holds the pepper as base64url text with no
// padding: 32 to 64 bytes, so 43 to 86 characters from A-Z, a-z, 0-9, `-`
// and `_`. More than 64 bytes would add nothing: HMAC-SHA-256 hashes a key
// longer than its 64-byte block down to 32 bytes first. The text is accepted
// only in its one canonical form: it must match that character set and
// length exactly (no padding, no `+` or `/`, no whitespace or line
// terminator anywhere), and decoding it and encoding the bytes again must
// give back the same text, so the platform's lenient decoder cannot widen
// what is accepted (it would otherwise skip stray characters and ignore
// unused trailing bits). The bytes' randomness cannot be checked here;
// generating 32 random bytes is the operator's duty.
//
// Misconfiguration tripwire. If the environment also holds
// `NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER`, whatever its value, the pepper
// is refused: a copy under a public name is a misconfiguration. This is a
// tripwire for that one name, not a guarantee that the value is exposed
// nowhere else.
//
// Fail closed. Any failure (the variable missing or empty, a malformed
// value, the tripwire, an environment that is not an object, an exception
// while reading it, or a refusal from the code module's own pepper check)
// throws one fixed `VerificationPepperSourceError` whose message is its code
// and nothing else. Whatever was thrown inside is dropped unread, so the
// error carries no part of the value. That fixed error is this module's only
// signal: it logs nothing itself, and how the error is surfaced when the
// server starts is the activating slice's wiring.
//
// The handle. A success returns the code module's opaque pepper handle: it
// has no own properties, so logging or serializing it shows `{}`, and the
// bytes live only in the Node key object that module keeps out of reach.
// After the handle is made, this module overwrites its decoded copy of the
// bytes with zeros. That does not erase the value: the text stays in the
// environment, and JavaScript strings cannot be wiped. Each call reads the
// environment again and makes a new handle; nothing is cached.
//
// The environment is passed in, defaulting to `process.env`, and only the
// two names above are read from it, as plain property reads.
//
// Dormant: no application runtime caller is introduced. Among application
// files, only the login route configuration beside it imports it, and no
// application file imports that; the unit tests import both. Keep it
// server-only, direct-import only and off every barrel.

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: the verification pepper source must not be imported in browser code.",
  );
}

export const VERIFICATION_PEPPER_ENV = "SOLMIND_VERIFICATION_PEPPER" as const;
export const VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE =
  "NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER" as const;

export const VERIFICATION_PEPPER_SOURCE_LIMITS = Object.freeze({
  minimumBytes: 32,
  maximumBytes: 64,
  minimumCharacters: 43,
  maximumCharacters: 86,
} as const);

export const VERIFICATION_PEPPER_SOURCE_ERROR_CODE = "verification_pepper_unavailable" as const;

// The one fixed, value-free error: the message is the code and nothing else.
export class VerificationPepperSourceError extends Error {
  readonly code: typeof VERIFICATION_PEPPER_SOURCE_ERROR_CODE;

  constructor() {
    super(VERIFICATION_PEPPER_SOURCE_ERROR_CODE);
    this.name = "VerificationPepperSourceError";
    this.code = VERIFICATION_PEPPER_SOURCE_ERROR_CODE;
  }
}

// Whole-string pattern: without the `m` flag, `$` matches only at the very
// end of the text, and the character set holds no line terminator, so a
// final line terminator is refused too.
const PEPPER_TEXT_PATTERN = /^[A-Za-z0-9_-]{43,86}$/;

function decodePepperText(text: unknown): Buffer | null {
  if (typeof text !== "string" || !PEPPER_TEXT_PATTERN.test(text)) {
    return null;
  }
  const bytes = Buffer.from(text, "base64url");
  if (
    bytes.byteLength < VERIFICATION_PEPPER_SOURCE_LIMITS.minimumBytes ||
    bytes.byteLength > VERIFICATION_PEPPER_SOURCE_LIMITS.maximumBytes ||
    bytes.toString("base64url") !== text
  ) {
    bytes.fill(0);
    return null;
  }
  return bytes;
}

function readPepper(environment: unknown): VerificationCodePepper | null {
  if (environment === null || typeof environment !== "object") {
    return null;
  }
  const record = environment as Readonly<Record<string, unknown>>;
  if (record[VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE] !== undefined) {
    return null;
  }
  const bytes = decodePepperText(record[VERIFICATION_PEPPER_ENV]);
  if (bytes === null) {
    return null;
  }
  try {
    return createVerificationCodePepper(bytes);
  } finally {
    bytes.fill(0);
  }
}

// Reads, checks and wraps the pepper, or throws the one fixed error.
export function loadVerificationPepper(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): VerificationCodePepper {
  let pepper: VerificationCodePepper | null;
  try {
    pepper = readPepper(environment);
  } catch {
    // Dropped unread, so it cannot carry any part of the value out.
    pepper = null;
  }
  if (pepper === null) {
    throw new VerificationPepperSourceError();
  }
  return pepper;
}
