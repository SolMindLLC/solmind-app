// SolMind MVP0 server-only request-auth context composer (the first guarded
// boundary, AUTH-RLS-DEC-025 category).
//
// Purpose:
//   - compose, in one explicit place, the two already-built halves of the auth
//     chain that have never been wired together: request IDENTITY (who) from the
//     request-auth principal source, and SolMind RECORDS (what) from the
//     service-role-backed auth source, into a single deterministic, deny-by-default
//     route-access decision a future route/server action can call;
//   - keep identity verification and service-role record loading STRUCTURALLY
//     separate (AUTH-RLS-DEC-015): a null principal denies BEFORE any record load
//     is attempted, and the resolved principal flows into the load only as a
//     lookup key.
//
// Architecture notes (MVP0):
//   - This is the guarded route/server-action composition boundary
//     (AUTH-RLS-DEC-006, AUTH-RLS-DEC-017, AUTH-RLS-DEC-025). It is server-only and
//     stays OFF the shared src/lib/solmind/auth/index.ts barrel, mirroring
//     serviceRoleClient and requestAuthClient. Import it only from explicit server
//     composition paths (a route/server action).
//   - It depends ONLY on dependency-free ports: SolMindRequestAuthPrincipalSource
//     (identity) and SolMindAuthSource (records). It imports NO @supabase/ssr, no
//     @supabase/supabase-js, no service-role client, no env, no cookies(), and no
//     headers(). The concrete identity adapter (requestAuthClient.ts) and the
//     concrete service-role-backed auth source are injected by the composition
//     root, so this module never touches a Supabase client and is unit-testable
//     with in-memory test doubles. No real service-role DB read is wired here; that
//     wiring is a later, separately-approved step (AUTH-RLS-DEF-010).
//   - server-only enforcement: the `server-only` package is now installed
//     (AUTH-RLS-DEC-023, AUTH-RLS-DEF-001), so this module carries the
//     `import "server-only";` marker below as the import-time guard, backed by the
//     same runtime browser guard as serviceRoleClient.ts and requestAuthClient.ts.
//   - Audit seam placement (AUTH-RLS-DEC-024): the OPTIONAL onServiceRoleRead hook
//     below is the dedicated audit seam, placed at THIS guarded boundary and nowhere
//     else. It is deliberately NOT inside requestAuthClient.ts (which reads no
//     records) nor inside the generic supabaseAuthQueryClient / serverAuthSourceAdapter
//     (which stay audit-free). This module fixes the audit PLACEMENT only; the audit
//     implementation (fields, sink, redaction, and the final audit-write-failure
//     fail-open-vs-closed posture) remains deferred (AUTH-RLS-DEF-003, AUTH-RLS-DEF-009).
//     Until then the seam is default-off: omit it and no audit call is made.
//   - Fail closed (AUTH-RLS-DEC-009, AUTH-RLS-DEC-016): any abnormal state -- a null
//     principal, a thrown/rejected principal source, a thrown/rejected record load,
//     or a derivation/route failure -- collapses to the single opaque route-access
//     denial. The caller never learns which record or step failed.
//   - Role separation preserved: this boundary resolves identity and access only. It
//     assembles no Explorer-private or Guide-private context and does not blend the
//     SolMind Virtual Guide and SolMind Guide Assistant contexts.

import "server-only";

import { type SolMindRequestAuthPrincipalSource } from "./requestAuthPrincipalSource";
import { type SolMindAuthSource } from "./authSource";
import {
  authorizeRouteAccess,
  ROUTE_ACCESS_DENY_REASON,
  type AuthorizeRouteAccessResult,
  type RouteAccessSelectors,
} from "./routeAccessDecision";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: composeRequestAuthContext must not be imported in browser code.",
  );
}

// --- Audit seam (placement only; implementation deferred) ---
//
// A minimal, value-free marker that a guarded service-role auth-context read was
// attempted at this boundary. It intentionally carries NO principal, token,
// cookie, record, or secret, so the seam cannot leak identity detail. The concrete
// audit fields, sink, redaction, and failure posture are decided in the
// implementation slice (AUTH-RLS-DEF-003, AUTH-RLS-DEF-009); this type fixes only
// that an audit seam exists at the guarded boundary (AUTH-RLS-DEC-024).
export type ServiceRoleReadAuditEvent = {
  kind: "server_auth_context_read";
};

// The injected audit sink. Optional: when omitted, no audit call is made (the
// seam is default-off until the audit implementation lands).
export type ServiceRoleReadAuditSink = (event: ServiceRoleReadAuditEvent) => void;

// --- Auth-resolution-failure seam (placement only; value-free) ---
//
// A minimal, value-FREE marker that auth resolution failed BY EXCEPTION at this
// guarded boundary (a thrown/rejected principal source or record load that this
// composer swallows into the opaque denial). Like onServiceRoleRead, it carries NO
// principal, token, cookie, record, or raw error, so the seam cannot leak which
// record or step failed (Doc 16 sections 5, 8). The composer only SIGNALS that a
// resolution exception occurred; the bounded event model and the audit sink stay
// one layer up (adminAccessRequest), keeping this module free of the rich event
// model (AUTH-RLS-DEC-024). It is default-off: omit it and no call is made.
export type AuthResolutionFailureAuditSink = () => void;

// --- Injected dependencies (ports + the optional audit seam) ---
//
// principalSource proves WHO (identity only); authSource loads WHAT (records only).
// They are separate clients and are never merged (AUTH-RLS-DEC-015). In production
// the composition root injects the concrete @supabase/ssr-backed principal source
// and the concrete service-role-backed auth source; tests inject in-memory doubles.
export type ComposeRequestAuthContextDependencies = {
  principalSource: SolMindRequestAuthPrincipalSource;
  authSource: SolMindAuthSource;
  onServiceRoleRead?: ServiceRoleReadAuditSink;
  onAuthResolutionFailure?: AuthResolutionFailureAuditSink;
};

// --- Request input (browser selectors only, NOT authority) ---
//
// selectors are the browser-supplied values (the requested route, and optionally a
// claimed role that is never consulted for the decision). They only select which
// route decision to attempt; authority is the server-derived active role.
export type ComposeRequestAuthContextInput = {
  selectors: RouteAccessSelectors;
};

function denyRouteAccess(): AuthorizeRouteAccessResult {
  return { allowed: false, reason: ROUTE_ACCESS_DENY_REASON };
}

// Compose request identity -> guarded service-role record load -> trusted-context
// derivation -> route access decision.
//
// Deny-by-default and fail-closed: returns an allow result ONLY when a verified
// principal resolves, its records derive a trusted context, and the server-derived
// active role is permitted on the requested route. Every other outcome returns the
// same opaque denial.
export async function composeRequestAuthContext(
  deps: ComposeRequestAuthContextDependencies,
  input: ComposeRequestAuthContextInput,
): Promise<AuthorizeRouteAccessResult> {
  try {
    // 1. IDENTITY (who). Resolve the server-verified principal. A null principal is
    //    the deny signal and short-circuits BEFORE any service-role read is
    //    attempted, so an unauthenticated request never triggers a record load
    //    (AUTH-RLS-DEC-015, AUTH-RLS-DEC-016).
    const principal = await deps.principalSource.resolveAuthenticatedUser();
    if (principal === null) {
      return denyRouteAccess();
    }

    // 2. RECORDS (what). A guarded service-role read happens here, at this boundary
    //    and only here. Mark it through the audit seam (AUTH-RLS-DEC-024) before the
    //    read; the seam is default-off when no sink is injected. The principal flows
    //    in only as a lookup key (AUTH-RLS-DEC-015); the server-loaded records remain
    //    the source of truth.
    deps.onServiceRoleRead?.({ kind: "server_auth_context_read" });
    const serverAuthContext = await deps.authSource.loadServerAuthContextInput({
      authenticatedUser: principal,
    });

    // 3. DECISION. Derive the trusted context and decide route access from the
    //    SERVER-derived active role only. Denial is opaque and deny-by-default; the
    //    browser-claimed role in selectors is never consulted.
    return authorizeRouteAccess({
      serverAuthContext,
      selectors: input.selectors,
    });
  } catch {
    // Fail closed: a thrown/rejected principal source, record load, or audit sink
    // collapses to the opaque denial. The error is swallowed (not logged, not
    // propagated) so no token, cookie, record, or secret leaks through an error
    // path. The final audit-write-failure posture is decided in the audit
    // implementation slice (AUTH-RLS-DEF-003, AUTH-RLS-DEF-009); failing closed here
    // is the conservative MVP0 interim.
    //
    // Signal the value-free auth-resolution-failure seam (Doc 16 section 5) BEFORE
    // returning. It is wrapped in its own guard so a throwing failure-audit hook can
    // never re-break fail-closed or leak: any error from the hook is swallowed and
    // the denial is returned unchanged.
    try {
      deps.onAuthResolutionFailure?.();
    } catch {
      // Intentionally empty: a throwing failure-audit hook must not propagate.
    }
    return denyRouteAccess();
  }
}
