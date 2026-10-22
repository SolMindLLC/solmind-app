// Dormant S6-9 Admin identifier boundary. Accepted policy is owned by
// solmind-sprints/PRJ01-SPR001/Validation_Workspaces/
// Login_Step6_S69_Design_Brief_2026-10-08/DESIGN_BRIEF_R04.md, read with REVIEW_R04.md.
// Keep direct-import only, off barrels and disconnected from the login preview.
// No account eligibility, role, password, IO, environment read or logging here.
// Returned identifiers are sensitive contact/account values, never log material.

import { normalizeLoginEmail } from "./loginContactNormalizer";

export type NormalizedAdminLoginIdentifier = Readonly<{
  identifierType: "email" | "username";
  normalizedIdentifier: string;
}>;

const MAXIMUM_TYPED_CHARACTERS = 512;
const DISALLOWED_USERNAME_CHARACTER = /[^A-Za-z0-9._-]/;
const UPPERCASE_ASCII_LETTER = /[A-Z]/g;

export function normalizeAdminLoginIdentifier(
  value: unknown,
): NormalizedAdminLoginIdentifier | null {
  if (typeof value !== "string" || value.length > MAXIMUM_TYPED_CHARACTERS) {
    return null;
  }

  // Email keeps its established whitespace and punctuation policy. Never
  // reinterpret an invalid address as a username or pre-trim it differently.
  if (value.includes("@")) {
    const email = normalizeLoginEmail(value);
    return email === null
      ? null
      : Object.freeze({ identifierType: "email", normalizedIdentifier: email });
  }

  let start = 0;
  let end = value.length;
  while (start < end && value.charAt(start) === " ") start += 1;
  while (end > start && value.charAt(end - 1) === " ") end -= 1;
  const username = value.slice(start, end);
  if (username.length === 0 || DISALLOWED_USERNAME_CHARACTER.test(username)) {
    return null;
  }

  return Object.freeze({
    identifierType: "username",
    normalizedIdentifier: username.replace(UPPERCASE_ASCII_LETTER, (letter) => letter.toLowerCase()),
  });
}
