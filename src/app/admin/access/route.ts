// SolMind MVP0 first real read-only auth boundary: the /admin access probe.
//
// This Route Handler is the per-route COMPOSITION ROOT (AUTH-RLS-DEC-017,
// AUTH-RLS-DEC-019). It is the first place the full request-auth chain is wired to a
// real request:
//   1. read the incoming request cookies via Next.js cookies();
//   2. build the dependency-free RequestCookieAccessor (read-only; MVP0 writes are a
//      no-op, AUTH-RLS-DEC-018);
//   3. construct the @supabase/ssr request-auth principal source from those cookies
//      (identity / WHO only -- public anon key, never the service-role key);
//   4. delegate to resolveAdminRouteAccess, which composes the principal source with
//      the deferred record-load seam (WHAT) and the fixed "/admin" selector.
//
// It is read-only: it performs no writes, creates/supersedes no user_session, adds no
// RLS policy, runs no migration, and loads no real SolMind records (record loading is
// the deferred in-memory seam in adminRouteAccess.ts). It returns only an opaque
// { allowed } boolean: deny-by-default, fail-closed, and never leaking which record or
// step failed.
//
// Route Handlers are server-only (never bundled to the client), so the server-only
// helpers it imports stay off the client. The shared barrels are not used.

import { cookies } from "next/headers";

import { resolveAdminRouteAccess } from "@/lib/solmind/auth/adminRouteAccess";
import {
  noopCookieSetAll,
  type RequestCookieAccessor,
} from "@/lib/solmind/auth/requestCookieAccessor";
import { createSupabaseRequestAuthPrincipalSource } from "@/lib/solmind/supabase/requestAuthClient";

// Reading request cookies is a request-time API: this route is always dynamic and is
// never prerendered at build time.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let allowed = false;

  try {
    // Composition root: build the read-only RequestCookieAccessor from the incoming
    // request cookies. setAll is the explicit MVP0 no-op (AUTH-RLS-DEC-018).
    const cookieStore = await cookies();
    const requestCookies: RequestCookieAccessor = {
      getAll: () =>
        cookieStore
          .getAll()
          .map((cookie) => ({ name: cookie.name, value: cookie.value })),
      setAll: noopCookieSetAll,
    };

    // Identity (WHO): the @supabase/ssr request-auth adapter, built only here at the
    // composition root. It verifies server-side via getUser() and never reads the
    // service-role key.
    const principalSource = createSupabaseRequestAuthPrincipalSource({
      cookies: requestCookies,
    });

    const result = await resolveAdminRouteAccess({ principalSource });
    allowed = result.allowed;
  } catch {
    // Fail closed (AUTH-RLS-DEC-016): any construction or configuration error (for
    // example missing public env) denies, leaking no detail. The error is swallowed
    // so no cookie, token, or secret can escape through an error path.
    allowed = false;
  }

  // Opaque outcome only: a single boolean, no record or derivation detail.
  return new Response(JSON.stringify({ allowed }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
