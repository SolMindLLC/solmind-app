// SolMind MVP0 request cookie accessor contract (pure, dependency-free).
//
// Purpose:
//   - define the minimal interface the future server-only request-auth adapter
//     will read incoming request cookies through, WITHOUT importing
//     @supabase/ssr, next/headers, cookies(), headers(), NextRequest,
//     NextResponse, or any browser API;
//   - give that adapter (and its tests) a typed read port plus deterministic,
//     IO-free fixtures to test against, so the @supabase/ssr coupling and the
//     Next.js cookies()/headers() call can be added later in a single, separately
//     approved server-only slice.
//
// Architecture notes (MVP0):
//   - This accessor reads cookies only. It is the READ shape the request-auth
//     boundary needs to hand request session cookies to a server-side getUser()
//     verification (AUTH-RLS-DEC-018, AUTH-RLS-DEC-020). It resolves nothing
//     about identity; principal resolution stays on
//     requestAuthPrincipalSource.ts (AUTH-RLS-DEC-015). This file does not
//     duplicate that responsibility.
//   - Cookie writes are an explicit no-op for MVP0 (AUTH-RLS-DEC-018). The
//     verification-only boundary never persists or rotates session cookies;
//     persisting refreshed/rotated cookies (the @supabase/ssr setAll path) is
//     deferred (AUTH-RLS-DEF-015). A no-op write fails safe: an unverifiable
//     session simply denies.
//   - The shapes mirror the @supabase/ssr server cookie methods (a getAll-style
//     read returning { name, value } entries, and a setAll-style write) so the
//     future adapter can wire this accessor straight into a request-scoped
//     Supabase auth client, WITHOUT this module importing @supabase/ssr. The
//     cookie-options bag is modeled as an opaque, dependency-free record because
//     the concrete option type belongs to the framework/@supabase/ssr layer that
//     MVP0 does not import here.
//   - The Next.js cookies()/headers() call lives only at the per-route or
//     server-action composition root, which builds a RequestCookieAccessor and
//     injects it into the server-only adapter (AUTH-RLS-DEC-019). Neither this
//     module nor the future adapter imports next/headers.
//   - This module is pure and dependency-free. It performs no IO of its own and
//     imports nothing. The in-memory helpers below are test/integration
//     fixtures, NOT real cookie storage, and hold no real session data.

// --- Read shape: one incoming request cookie ---
//
// Mirrors the element shape that an @supabase/ssr getAll() read yields
// ({ name, value }) without importing @supabase/ssr. Values are taken verbatim;
// this contract does not decode, verify, or trust them. Verification happens
// later, server-side, in the request-auth adapter.
export type RequestCookie = {
  name: string;
  value: string;
};

// --- Write shape: one cookie a future setAll path would receive ---
//
// Modeled dependency-free. options is an opaque, read-only bag because the real
// cookie-options type belongs to the framework/@supabase/ssr layer MVP0 does not
// import. For MVP0 this shape exists only so the no-op write contract is typed;
// nothing is ever persisted from it (AUTH-RLS-DEC-018, AUTH-RLS-DEF-015).
export type RequestCookieToSet = {
  name: string;
  value: string;
  options?: Readonly<Record<string, unknown>>;
};

// --- The read-oriented accessor the composition root builds and injects ---
//
// getAll returns every incoming request cookie. setAll is an explicit MVP0 no-op
// (it accepts the future write shape but persists nothing), so the request-auth
// boundary stays verification-only and no session-write behavior leaks into
// MVP0. A concrete accessor (built at the composition root from Next.js
// cookies()) will satisfy this same interface in a later, separately-approved
// slice.
export interface RequestCookieAccessor {
  // Read all incoming request cookies. Implementations should return a stable
  // snapshot of the request's cookies and must not expose mutable internal
  // state to the caller.
  getAll(): RequestCookie[];

  // MVP0: explicit no-op. Writes are intentionally not persisted or rotated
  // (AUTH-RLS-DEC-018; deferred under AUTH-RLS-DEF-015). Modeled as a method so
  // the future adapter can pass it straight to the @supabase/ssr setAll slot.
  setAll(cookiesToSet: RequestCookieToSet[]): void;
}

// --- Explicit no-op write (named so it is reusable and testable) ---
//
// The single, deliberate MVP0 cookie-write no-op. It persists nothing, returns
// nothing, and never throws, centralizing the "writes are a no-op" decision in
// one place (AUTH-RLS-DEC-018). It declares no parameters because it discards
// every write; it stays assignable to RequestCookieAccessor.setAll, whose typed
// parameter documents the future (deferred) write shape (AUTH-RLS-DEF-015).
export function noopCookieSetAll(): void {
  // Intentionally empty: MVP0 does not persist or rotate session cookies.
}

// --- Deterministic, IO-free fixtures (for tests and composition) ---
//
// NOTE: these are test/integration fixtures, NOT real cookie storage. They imply
// nothing about how request cookies are read in production and hold no real
// session data.

// Create a deterministic in-memory RequestCookieAccessor from an explicit list
// of cookies. getAll returns a fresh, defensive copy each call (fresh array and
// fresh entry objects), so a caller can never mutate the fixture through the
// returned value. setAll is the explicit no-op. Side-effect-free.
export function createInMemoryRequestCookieAccessor(
  cookies: readonly RequestCookie[] = [],
): RequestCookieAccessor {
  // Snapshot once so later mutation of the caller's array cannot change reads.
  const snapshot: RequestCookie[] = cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
  }));

  return {
    getAll() {
      return snapshot.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
      }));
    },
    setAll: noopCookieSetAll,
  };
}

// Find a single request cookie value by name from an accessor, or null when no
// cookie of that name is present. Pure read helper over getAll, for tests and
// future composition. Names are matched exactly (no normalization), consistent
// with the trusted-value handling elsewhere in the auth layer. If duplicate
// names are present, the first match wins.
export function findRequestCookieValue(
  accessor: RequestCookieAccessor,
  name: string,
): string | null {
  const match = accessor.getAll().find((cookie) => cookie.name === name);
  return match ? match.value : null;
}
