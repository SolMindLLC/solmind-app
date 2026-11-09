// SolMind MVP0 request-auth principal source contract (pure, dependency-free).
//
// Purpose:
//   - define the single seam that turns an incoming, already-server-verified
//     request session into the trusted principal the existing SolMind auth chain
//     already consumes, WITHOUT introducing any cookie, header, framework, or
//     Supabase dependency yet;
//   - give the future server-only request-auth adapter (and its tests) a typed
//     port to depend on, plus deterministic, IO-free fixtures to test against.
//
// Architecture notes (MVP0):
//   - This port resolves IDENTITY only: WHO the request is. It returns the
//     existing SupabaseAuthenticatedUser principal, or null. null means deny.
//     It never loads SolMind records; record loading stays on the separate
//     service-role query-client path (AUTH-RLS-DEC-015). Identity and record
//     loading are not merged.
//   - Whatever implements this port MUST have server-verified the principal
//     (the future adapter verifies with the Supabase auth server). A
//     browser-supplied identity hint is never trusted. This contract only
//     describes the SHAPE of the resolved value, not how identity is proven.
//   - Fail closed (AUTH-RLS-DEC-016): missing, invalid, expired, ambiguous,
//     conflicting, thrown, or rejected request-auth state must resolve to null,
//     never to a principal and never to an error that escapes the port.
//   - This module is pure and dependency-free. It imports NO @supabase/ssr, no
//     cookies(), no headers(), no Next.js server APIs, and no browser APIs, and
//     performs no IO of its own. The real server-only @supabase/ssr adapter is a
//     later, separately-approved slice and is intentionally NOT added here.
//     Its one timer, and its readings of the monotonic clock
//     (performance.now), belong to the optional deadline of the fail-closed
//     wrapper below (correction D-14, 2026-11-09).

import { type SupabaseAuthenticatedUser } from "./serverAuthContext";

// --- The port the future server-only request-auth adapter implements ---
//
// A concrete @supabase/ssr-backed adapter (a later, separately-approved slice)
// will implement this same interface; routes/server actions depend on the
// interface, not on any concrete auth client. The method is async because the
// real adapter performs IO (a server-side verified-session call); modeling it as
// async now avoids a breaking signature change later.
export interface SolMindRequestAuthPrincipalSource {
  // Resolve the server-verified principal for the current request, or null when
  // no verified principal can be established. null is the only deny signal; the
  // method never throws to its caller.
  resolveAuthenticatedUser(): Promise<SupabaseAuthenticatedUser | null>;
}

// A bare resolver function that MAY throw or reject. It models the raw
// identity-resolution step a future adapter performs, before the fail-closed
// posture is applied. Kept dependency-free: it is just a thunk returning a
// principal or null, sync or async.
export type RequestAuthPrincipalResolver = () =>
  | SupabaseAuthenticatedUser
  | null
  | Promise<SupabaseAuthenticatedUser | null>;

// --- Deterministic, IO-free fixtures (for tests and composition) ---
//
// NOTE: these are test/integration fixtures, NOT real session verification.
// They imply nothing about how identity is proven in production.

// Create a deterministic in-memory principal source that always resolves the
// given principal (or null). Side-effect-free; for tests and integration
// composition only.
export function createInMemoryRequestAuthPrincipalSource(
  principal: SupabaseAuthenticatedUser | null,
): SolMindRequestAuthPrincipalSource {
  return {
    resolveAuthenticatedUser() {
      return Promise.resolve(principal);
    },
  };
}

// Wrap a raw resolver in the fail-closed posture required by AUTH-RLS-DEC-016.
// Any thrown error, rejected promise, or absent result becomes null, so no
// abnormal request-auth state can fail open and no error (which could carry a
// token, cookie, or secret) escapes the port. The error is swallowed, never
// logged or propagated, mirroring the query client's safeSelect stance.
//
// This is pure orchestration over an injected resolver. It is NOT the request
// auth adapter: it opens no cookies, reads no headers, and imports no
// @supabase/ssr. The future server-only adapter MAY build on it.
//
// Correction D-14 (2026-11-09; REV341c finding 1): a resolver that never
// settles, such as a provider check whose answer stalls, would otherwise keep
// the request waiting with no end. With a deadline, or a caller's
// cancellation signal, the wrapper denies (null) when the deadline passes or
// the signal aborts, whichever comes first; an answer that arrives later is
// ignored, a later rejection is consumed, and the timer and the listener are
// removed. The deadline is an absolute monotonic time taken before the
// resolver is called, so an answer that a busy event loop processes before
// the overdue timer has run is still denied. A signal that has already
// aborted denies without calling the resolver, and one that aborts while the
// resolver's own synchronous part runs denies too. Without either option the
// behavior is unchanged. The wrapper cannot stop the resolver's own work; it
// only stops waiting for it.
export type FailClosedRequestAuthOptions = Readonly<{
  // How long the resolver may take, in milliseconds: a positive whole number
  // no larger than a timer can hold (2,147,483,647).
  deadlineMs?: number;
  // The caller's cancellation, where the caller has one.
  signal?: AbortSignal;
}>;

// The largest delay a Node.js timer holds; a larger one fires after 1 ms.
const MAXIMUM_TIMER_MILLISECONDS = 2_147_483_647;

export function createFailClosedRequestAuthPrincipalSource(
  resolve: RequestAuthPrincipalResolver,
  options: FailClosedRequestAuthOptions = {},
): SolMindRequestAuthPrincipalSource {
  const { deadlineMs, signal } = options;
  if (
    deadlineMs !== undefined &&
    !(Number.isSafeInteger(deadlineMs) && deadlineMs > 0 && deadlineMs <= MAXIMUM_TIMER_MILLISECONDS)
  ) {
    throw new Error("SolMind server configuration error: the request-auth deadline is invalid.");
  }
  return {
    async resolveAuthenticatedUser() {
      if (signal?.aborted) {
        return null;
      }
      // Taken before the resolver runs, so the deadline covers all of it.
      const startedAt = performance.now();
      const overdue = (): boolean =>
        deadlineMs !== undefined && performance.now() - startedAt >= deadlineMs;
      let pending: Promise<SupabaseAuthenticatedUser | null>;
      try {
        pending = Promise.resolve(resolve());
      } catch {
        // Swallow: no token, cookie, or secret may leak through an error path.
        return null;
      }
      // A null/absent result is the deny signal; normalize anything falsy to
      // null so the caller only ever sees a principal or null. A rejection
      // becomes null here too, so it is consumed even when it comes late.
      const settled = pending.then(
        (principal) => principal ?? null,
        () => null,
      );
      if (deadlineMs === undefined && signal === undefined) {
        return settled;
      }
      let ended = false;
      let end: () => void = () => undefined;
      const denied = new Promise<null>((settle) => {
        end = () => {
          ended = true;
          settle(null);
        };
      });
      // The timer ends the wait at the deadline measured from startedAt.
      const timer =
        deadlineMs === undefined
          ? undefined
          : setTimeout(end, Math.max(0, deadlineMs - (performance.now() - startedAt)));
      signal?.addEventListener("abort", end, { once: true });
      if (signal?.aborted) {
        // Aborted while the resolver's synchronous part ran, before the
        // listener existed.
        end();
      }
      try {
        const principal = await Promise.race([settled, denied]);
        // Past the deadline or after cancellation, even an answer that won the
        // race is not used: the timer may not have run yet on a busy event
        // loop, so the monotonic clock is read again here.
        return ended || overdue() ? null : principal;
      } finally {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        signal?.removeEventListener("abort", end);
      }
    },
  };
}
