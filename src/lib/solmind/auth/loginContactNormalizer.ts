// Login step 6, sub-slice S6-1: the shared login contact normalizer.
//
// Source of truth: solmind-docs
// `execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`,
// AUTH-RLS-DEC-033: "Server-side canonical normalization is one shared,
// unit-tested trust-boundary function." Login step 5's callers only check
// that a contact is already canonical and left this function owed before
// activation. The canonical form is the one the database already enforces:
// `execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md` keeps
// `normalized_contact_value` as a lowercase email, and the current issuance
// function (`supabase/migrations/20260929010000_verification_issuance_abuse_limits.sql`)
// accepts an email contact only if it is 3 to 254 characters, equal to its
// own lowercase form, matches that function's pattern (copied below as
// `CANONICAL_EMAIL_PATTERN`) and has no `..`. The invitation issuance
// functions apply the same check.
//
// What it does, in order, to what a person typed:
//   1. refuses anything that is not a string, or is longer than 512
//      characters, before any other work;
//   2. removes leading and trailing ASCII whitespace (tab, line feed, form
//      feed, carriage return and space), as a browser's email field does;
//   3. refuses the rest unless every character is printable ASCII (0x21 to
//      0x7E). Nothing outside ASCII is mapped or folded: a look-alike such as
//      the Kelvin sign, which Unicode lowercasing would turn into `k`, is
//      refused, not turned into another person's address;
//   4. lowercases A-Z only;
//   5. accepts the result only if it passes the database's own check above,
//      exactly.
// So every email it returns is one the issuance function accepts, and
// typing the same address in any letter case, with or without surrounding
// whitespace, gives the same contact.
//
// Email only. Step 6 signs in by email (and the Admin username, whose lookup
// belongs to the login lookups of sub-slices S6-5 and S6-9); phone sign-in is
// outside step 6 (contract 25 Section 19), so phone normalization joins this
// module when phone sign-in is designed.
//
// A refusal is `null` and carries nothing. A success returns the canonical
// email, which is a contact value: callers must keep it out of audit rows,
// errors, traces, alarms and logs (AUTH-RLS-DEC-032's clarification).
// Whether an account uses that email is not this function's question; it
// reads nothing and decides no eligibility.
//
// Pure: no import, no IO, no environment read, no clock and no logging.
//
// Dormant: no application runtime caller is introduced; no application file
// imports this module, and the unit tests do. Keep it direct-import only and
// off every barrel.

export const LOGIN_CONTACT_NORMALIZER_LIMITS = Object.freeze({
  maximumInputCharacters: 512,
  minimumEmailCharacters: 3,
  maximumEmailCharacters: 254,
} as const);

// HTML's ASCII whitespace: tab, line feed, form feed, carriage return, space.
const ASCII_WHITESPACE = Object.freeze(["\t", "\n", "\f", "\r", " "]);

// Whole-string patterns: without the `m` flag, `$` matches only at the very
// end of the text.
const PRINTABLE_ASCII_PATTERN = /^[\x21-\x7e]*$/;
const UPPERCASE_ASCII_LETTER = /[A-Z]/g;
// The issuance function's email pattern, character for character.
const CANONICAL_EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+$/;

function trimAsciiWhitespace(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && ASCII_WHITESPACE.includes(value.charAt(start))) {
    start += 1;
  }
  while (end > start && ASCII_WHITESPACE.includes(value.charAt(end - 1))) {
    end -= 1;
  }
  return value.slice(start, end);
}

// The canonical email for what was typed, or null.
export function normalizeLoginEmail(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > LOGIN_CONTACT_NORMALIZER_LIMITS.maximumInputCharacters
  ) {
    return null;
  }
  const trimmed = trimAsciiWhitespace(value);
  if (!PRINTABLE_ASCII_PATTERN.test(trimmed)) {
    return null;
  }
  const lowered = trimmed.replace(UPPERCASE_ASCII_LETTER, (letter) => letter.toLowerCase());
  if (
    lowered.length < LOGIN_CONTACT_NORMALIZER_LIMITS.minimumEmailCharacters ||
    lowered.length > LOGIN_CONTACT_NORMALIZER_LIMITS.maximumEmailCharacters ||
    !CANONICAL_EMAIL_PATTERN.test(lowered) ||
    lowered.includes("..")
  ) {
    return null;
  }
  return lowered;
}
