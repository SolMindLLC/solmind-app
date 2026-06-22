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
export function createFailClosedRequestAuthPrincipalSource(
  resolve: RequestAuthPrincipalResolver,
): SolMindRequestAuthPrincipalSource {
  return {
    async resolveAuthenticatedUser() {
      try {
        const principal = await resolve();
        // A null/absent result is the deny signal; normalize anything falsy to
        // null so the caller only ever sees a principal or null.
        return principal ?? null;
      } catch {
        // Swallow: no token, cookie, or secret may leak through an error path.
        return null;
      }
    },
  };
}
