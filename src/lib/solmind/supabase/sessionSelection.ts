// SolMind MVP0 active SolMind session selection (pure).
//
// Purpose:
//   - encode the approved MVP0 single-active-session contract as a pure function
//     the future server query client can call to pick the one valid active
//     identity.user_session for an account.
//
// Approved MVP0 decisions encoded here:
//   1. Single active session per account: at most one valid active session is
//      expected. A successful login is responsible for superseding prior active
//      sessions; this function does not write anything.
//   2. SolMind session expiration wins: a session whose expires_at is at or
//      before the injected now is treated as expired and not valid, even if its
//      session_status still reads "active".
//   3. Deny on ambiguity: if more than one valid active session is found, return
//      null rather than silently choosing one.
//
// Architecture notes (MVP0):
//   - Pure and deterministic: time is supplied by an injected now (a Date). This
//     module never reads Date.now() or performs IO.
//   - It reuses the UserSessionRow shape from the adapter and adds the expires_at
//     column (identity.user_session.expires_at is NOT NULL in the schema; the
//     adapter projection omits it because deriveTrustedServerAuthContext only
//     needs session_status). The selection candidate carries expires_at so the
//     expiration rule can be applied here.
//   - This function selects a record; it makes no authorization decision. The
//     guard layer still re-validates the selected session.

import { type UserSessionRow } from "./serverAuthSourceAdapter";

// The only session_status value treated as active. Every other value (expired,
// logged_out, revoked, or any unknown value) is not valid.
export const SOLMIND_ACTIVE_SESSION_STATUS = "active";

// A user_session candidate for selection: the adapter row plus the expires_at
// timestamp (ISO 8601 string, as stored in identity.user_session.expires_at).
export type UserSessionSelectionCandidate = UserSessionRow & {
  expires_at: string;
};

export type SelectActiveUserSessionArgs = {
  candidates: UserSessionSelectionCandidate[];
  // Server-supplied current time. Injected for purity and determinism.
  now: Date;
};

// A candidate is a valid active session only when its status is exactly active
// and its expiry is strictly in the future relative to now. An unparseable or
// past/equal expiry is treated as not valid (deny-by-default).
function isValidActiveSession(
  candidate: UserSessionSelectionCandidate,
  now: Date,
): boolean {
  if (candidate.session_status !== SOLMIND_ACTIVE_SESSION_STATUS) {
    return false;
  }

  const expiresAtMs = Date.parse(candidate.expires_at);
  if (Number.isNaN(expiresAtMs)) {
    return false;
  }

  return expiresAtMs > now.getTime();
}

// Select the single valid active SolMind session for one account.
//   - exactly one valid active session -> that session;
//   - zero valid active sessions      -> null;
//   - more than one valid active session -> null (deny on ambiguity).
export function selectActiveUserSession(
  args: SelectActiveUserSessionArgs,
): UserSessionSelectionCandidate | null {
  const { candidates, now } = args;

  const validActive = candidates.filter((candidate) =>
    isValidActiveSession(candidate, now),
  );

  if (validActive.length === 1) {
    return validActive[0];
  }

  // Zero valid active sessions, or more than one (ambiguous): deny.
  return null;
}
