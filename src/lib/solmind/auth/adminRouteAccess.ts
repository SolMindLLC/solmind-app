// SolMind MVP0 server-only /admin route-access composition helper.
//
// Purpose:
//   - provide the single, narrowly-scoped server-only helper that the /admin
//     read-only route boundary calls to turn a request-auth principal source into
//     an opaque allow/deny decision for the "/admin" route, by composing the
//     existing composeRequestAuthContext seam with the fixed "/admin" selector;
//   - keep the route file (src/app/admin/access/route.ts) tiny: the route is only
//     the composition root that builds the RequestCookieAccessor from Next.js
//     cookies() and the @supabase/ssr request-auth principal source, then delegates
//     the decision here (AUTH-RLS-DEC-017, AUTH-RLS-DEC-019; AGENTS.md route-size rule).
//
// Architecture notes (MVP0):
//   - Server-only and OFF the shared src/lib/solmind/auth/index.ts barrel
//     (AUTH-RLS-DEC-007, AUTH-RLS-DEC-013), mirroring composeRequestAuthContext,
//     serviceRoleClient, and requestAuthClient. Import it only from explicit server
//     composition paths. The `server-only` package is now installed
//     (AUTH-RLS-DEC-023, AUTH-RLS-DEF-001); the `import "server-only";` marker below
//     is the import-time guard, backed by the runtime browser guard, matching the
//     existing server-only family.
//   - It introduces NO new record loading. The SolMind auth source (the WHAT/record
//     side) is an injected seam. Real service-role record loading is NOT wired yet
//     (AUTH-RLS-DEF-009, AUTH-RLS-DEF-010): when no auth source is injected, the
//     helper uses an empty in-memory seam that denies by default. This contains no
//     service-role key and performs no DB access. Identity (WHO) stays entirely on
//     the injected principal source (AUTH-RLS-DEC-015).
//   - Deny-by-default and fail-closed are inherited from composeRequestAuthContext
//     (AUTH-RLS-DEC-009, AUTH-RLS-DEC-016): a null principal denies before any
//     record load; every abnormal state collapses to the single opaque
//     route-access denial with no record detail.
//   - Role separation preserved: this resolves identity and /admin access only. It
//     assembles no Explorer-private or Guide-private context and blends no AI roles.

import "server-only";

import { type SolMindRequestAuthPrincipalSource } from "./requestAuthPrincipalSource";
import { createInMemoryAuthSource, type SolMindAuthSource } from "./authSource";
import { composeRequestAuthContext } from "./composeRequestAuthContext";
import { type AuthorizeRouteAccessResult } from "./routeAccessDecision";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: adminRouteAccess must not be imported in browser code.",
  );
}

// The single route this boundary gates. It is the SERVER-side selector passed to
// the route access rules; the browser never supplies it. AUTH-RLS-DEC-025 makes
// Admin the lowest-ambiguity first candidate.
export const ADMIN_ACCESS_ROUTE = "/admin" as const;

// The DEFERRED service-role record-load seam. Real service-role SolMind record
// loading is not safe to wire yet (no concrete request-time service-role read site
// exists; AUTH-RLS-DEF-009, AUTH-RLS-DEF-010). Until it lands, the boundary uses an
// empty, deterministic in-memory auth source that holds no records and therefore
// denies by default. It reads no env, uses no service-role key, and performs no DB
// access -- so wiring the boundary now cannot leak service-role behavior.
export function createDeferredAdminAuthSource(): SolMindAuthSource {
  return createInMemoryAuthSource();
}

// Resolve the opaque /admin route-access decision for the current request.
//
//   - principalSource: the request-auth identity port (WHO). At the route
//     composition root this is the real @supabase/ssr-backed adapter built from the
//     request cookies; tests inject an in-memory principal source.
//   - authSource (optional): the record-load seam (WHAT). Defaults to the deferred
//     deny-by-default in-memory seam above. A future slice injects the real
//     service-role-backed source here, with no change to this signature.
//
// Returns the existing AuthorizeRouteAccessResult unchanged: deny-by-default,
// fail-closed, and opaque on denial.
export async function resolveAdminRouteAccess(args: {
  principalSource: SolMindRequestAuthPrincipalSource;
  authSource?: SolMindAuthSource;
}): Promise<AuthorizeRouteAccessResult> {
  const authSource = args.authSource ?? createDeferredAdminAuthSource();
  return composeRequestAuthContext(
    { principalSource: args.principalSource, authSource },
    { selectors: { requestedRoute: ADMIN_ACCESS_ROUTE } },
  );
}
