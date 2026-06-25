// SolMind MVP0 server-only /admin access request composition helper.
//
// Purpose:
//   - own the per-request composition that the /admin/access Route Handler used to
//     inline: build the request-auth principal source (WHO) and the real Admin auth
//     source (WHAT), delegate the decision to resolveAdminRouteAccess, and reduce the
//     outcome to a single opaque { allowed } shape;
//   - make that composition deterministically testable WITHOUT Next.js request APIs
//     or real env, by accepting an injected RequestCookieAccessor and injectable
//     principal-source / auth-source factories. The route stays a thin shell that
//     only reads cookies() and serializes the result.
//
// Architecture notes (MVP0):
//   - Server-only and OFF the shared src/lib/solmind/auth/index.ts barrel
//     (AUTH-RLS-DEC-007, AUTH-RLS-DEC-013), mirroring composeRequestAuthContext,
//     adminRouteAccess, serviceRoleClient, and requestAuthClient. Import it only from
//     the explicit /admin server composition path. The runtime browser guard below
//     is the interim boundary while the `server-only` package stays deferred
//     (AUTH-RLS-DEC-023, AUTH-RLS-DEF-001).
//   - Identity (WHO) and record loading (WHAT) stay structurally separate
//     (AUTH-RLS-DEC-015): the principal source proves identity; the Admin auth source
//     loads records. A null principal denies before any service-role read (enforced
//     by resolveAdminRouteAccess -> composeRequestAuthContext).
//   - Fail closed (AUTH-RLS-DEC-016): any construction or configuration error (for
//     example missing public or service-role env) is swallowed and denies, so no
//     cookie, token, record, or secret can escape through an error path. This is the
//     same posture the route enforced inline; keeping it here makes it testable and
//     keeps it as defense in depth alongside the route's own outer guard.
//   - Opaque outcome only. The return value is exactly { allowed: boolean }. The
//     reason, the derived context, the active role, and any profile/session/identity
//     detail from resolveAdminRouteAccess are intentionally dropped here, so the
//     outward /admin/access surface can never leak them and no Explorer-private or
//     Guide-private field is assembled into the response.
//   - This slice does NOT thread the onServiceRoleRead audit seam and adds no audit
//     behavior; that stays deferred (AUTH-RLS-DEF-003, AUTH-RLS-DEF-009).

import { resolveAdminRouteAccess } from "./adminRouteAccess";
import { type SolMindAuthSource } from "./authSource";
import { type SolMindRequestAuthPrincipalSource } from "./requestAuthPrincipalSource";
import { type RequestCookieAccessor } from "./requestCookieAccessor";
import { createAdminAuthSource } from "../supabase/adminAuthSource";
import { createSupabaseRequestAuthPrincipalSource } from "../supabase/requestAuthClient";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: adminAccessRequest must not be imported in browser code.",
  );
}

// The opaque outward result. Deliberately a single boolean field: no reason, no
// context, no role, and no profile/session/identity detail is ever carried out.
export type AdminAccessResult = {
  allowed: boolean;
};

// Factory ports, injectable for deterministic tests.
//   - createPrincipalSource: builds the request-auth identity port (WHO) from the
//     injected cookie accessor. Defaults to the real @supabase/ssr-backed adapter.
//   - createAuthSource: builds the record-load port (WHAT). Defaults to the real
//     service-role-backed Admin auth source.
// Tests inject in-memory / mock-executor-backed doubles, so no Next.js request API,
// network, DB, or env is touched.
export type AdminAccessRequestDependencies = {
  cookies: RequestCookieAccessor;
  createPrincipalSource?: (args: {
    cookies: RequestCookieAccessor;
  }) => SolMindRequestAuthPrincipalSource;
  createAuthSource?: (args: { now: () => Date }) => SolMindAuthSource;
  now?: () => Date;
};

// Compose the /admin access decision for one request and return only { allowed }.
//
// Deny-by-default and fail-closed: returns { allowed: true } ONLY when a verified
// principal resolves, its real-loaded records derive a trusted context, and the
// server-derived active role is permitted on /admin. Every other outcome -- including
// any thrown principal-source/auth-source construction or load error -- returns
// { allowed: false } with no detail.
export async function resolveAdminAccessForRequest(
  deps: AdminAccessRequestDependencies,
): Promise<AdminAccessResult> {
  try {
    const now = deps.now ?? (() => new Date());
    const createPrincipalSource =
      deps.createPrincipalSource ?? createSupabaseRequestAuthPrincipalSource;
    const createAuthSource = deps.createAuthSource ?? createAdminAuthSource;

    // Identity (WHO): built from the injected cookie accessor only.
    const principalSource = createPrincipalSource({ cookies: deps.cookies });

    // Records (WHAT): the real Admin auth source (service-role chain) by default. A
    // missing/blank service-role env throws here and is caught below, denying.
    const authSource = createAuthSource({ now });

    const result = await resolveAdminRouteAccess({ principalSource, authSource });

    // Reduce to the opaque boolean: drop reason/context so nothing leaks outward.
    return { allowed: result.allowed };
  } catch {
    // Fail closed: swallow any construction/configuration error and deny.
    return { allowed: false };
  }
}
