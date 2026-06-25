// SolMind MVP0 first real read-only auth boundary: the /admin access probe.
//
// This Route Handler is the per-route COMPOSITION ROOT (AUTH-RLS-DEC-017,
// AUTH-RLS-DEC-019), kept as a THIN shell:
//   1. read the incoming request cookies via Next.js cookies();
//   2. build the dependency-free RequestCookieAccessor (read-only; MVP0 writes are a
//      no-op, AUTH-RLS-DEC-018);
//   3. delegate the whole composition decision to resolveAdminAccessForRequest, which
//      builds the @supabase/ssr request-auth principal source (WHO) and the real
//      Admin auth source (WHAT), calls resolveAdminRouteAccess, and reduces the result
//      to an opaque { allowed }.
//
// All composition, derivation, and fail-closed logic now lives in the testable
// adminAccessRequest helper; this file holds only the Next.js request-surface glue,
// which is why the composition behavior is unit-tested there rather than here.
//
// It is read-only: it performs no writes, creates/supersedes no user_session, adds no
// RLS policy, and runs no migration. It returns only an opaque { allowed } boolean:
// deny-by-default, fail-closed, and never leaking which record or step failed (no
// reason, context, role, profile, session, or identity detail is carried out).
//
// Route Handlers are server-only (never bundled to the client), so the server-only
// helpers it imports stay off the client. The shared barrels are not used.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { resolveAdminAccessForRequest } from "@/lib/solmind/auth/adminAccessRequest";
import {
  noopCookieSetAll,
  type RequestCookieAccessor,
} from "@/lib/solmind/auth/requestCookieAccessor";

// Reading request cookies is a request-time API: this route is always dynamic and is
// never prerendered at build time.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let allowed = false;

  try {
    // Build the read-only RequestCookieAccessor from the incoming request cookies.
    // setAll is the explicit MVP0 no-op (AUTH-RLS-DEC-018).
    const cookieStore = await cookies();
    const requestCookies: RequestCookieAccessor = {
      getAll: () =>
        cookieStore
          .getAll()
          .map((cookie) => ({ name: cookie.name, value: cookie.value })),
      setAll: noopCookieSetAll,
    };

    // Delegate composition (identity + real record load + decision) to the testable
    // helper. The helper fails closed internally; this outer guard additionally
    // covers any failure of the request-surface glue above (AUTH-RLS-DEC-016).
    const result = await resolveAdminAccessForRequest({ cookies: requestCookies });
    allowed = result.allowed;
  } catch {
    // Fail closed: any error denies, leaking no detail. The error is swallowed so no
    // cookie, token, or secret can escape through an error path.
    allowed = false;
  }

  // Opaque outcome only: a single boolean, no record or derivation detail.
  return NextResponse.json({ allowed });
}
