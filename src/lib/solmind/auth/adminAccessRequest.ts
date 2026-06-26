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
//     the explicit /admin server composition path. The `import "server-only";`
//     marker below is the import-time guard, backed by the runtime browser guard
//     (AUTH-RLS-DEC-023, AUTH-RLS-DEF-001).
//   - Identity (WHO) and record loading (WHAT) stay structurally separate
//     (AUTH-RLS-DEC-015): the principal source proves identity; the Admin auth source
//     loads records. A null principal denies before any service-role read (enforced
//     by resolveAdminRouteAccess -> composeRequestAuthContext).
//   - Fail closed (AUTH-RLS-DEC-016): any construction or configuration error (for
//     example missing public or service-role env), or a throwing injected audit
//     sink, is swallowed and denies, so no cookie, token, record, or secret can
//     escape through an error path. This is the same posture the route enforced
//     inline; keeping it here makes it testable and keeps it as defense in depth
//     alongside the route's own outer guard.
//   - Opaque outcome only. The return value is exactly { allowed: boolean }. The
//     reason, the derived context, the active role, and any profile/session/identity
//     detail from resolveAdminRouteAccess are intentionally dropped here, so the
//     outward /admin/access surface can never leak them and no Explorer-private or
//     Guide-private field is assembled into the response.
//   - Audit seam wiring (AUTH-RLS-DEC-024; Doc 16 sections 5-7, 9). This boundary is
//     the single place the bounded authRlsAuditEvent model is constructed, and it now
//     emits all three MVP0 Auth/RLS categories through ONE default-off sink:
//       1. the Admin route access DECISION event, at the access-decision point;
//       2. the GUARDED SERVICE-ROLE READ event, bridged from composeRequestAuthContext's
//          value-free onServiceRoleRead seam (fired exactly where the read happens, so
//          the server-derived account id is not yet known and is null);
//       3. the AUTH-RESOLUTION-FAILURE event (by exception), bridged from the value-free
//          onAuthResolutionFailure seam for an exception swallowed inside
//          composeRequestAuthContext, AND emitted from this module's own fail-closed
//          catch for a request-path exception (a factory construction error, or a
//          throwing decision sink).
//     The seam is DEFAULT-OFF: when no sink is injected, the no-op sink is used and
//     NOTHING is persisted, so this adds no persistence and no runtime behavior change.
//     A deny is recorded opaquely (system role context, no account id), so a denied or
//     unauthenticated Explorer/Guide identity is never attributed; only an allow
//     carries the server-derived admin account id; the guarded-read event carries only
//     the admin boundary role context (never guide/explorer) with a null account id. No
//     real writer, database access, RLS policy, or audit.audit_event insert is added
//     here; the writer and its fail-open-vs-closed posture remain deferred
//     (AUTH-RLS-DEF-003, AUTH-RLS-DEF-009). A null-principal denial stays the existing
//     opaque decision(deny) event and is NOT additionally recorded as a failure: the
//     failure category is scoped to exceptions (Doc 16 section 5 lists the null case
//     under the category, but task scope records it by exception only).

import "server-only";

import { resolveAdminRouteAccess } from "./adminRouteAccess";
import { type SolMindAuthSource } from "./authSource";
import { type SolMindRequestAuthPrincipalSource } from "./requestAuthPrincipalSource";
import { type RequestCookieAccessor } from "./requestCookieAccessor";
import { type AuthorizeRouteAccessResult } from "./routeAccessDecision";
import {
  AUTH_RLS_AUDIT_DECISIONS,
  createAdminAccessDecisionEvent,
  createAuthResolutionFailureEvent,
  createGuardedServiceRoleReadEvent,
  NOOP_AUTH_RLS_AUDIT_SINK,
  type AuthRlsAuditEvent,
  type AuthRlsAuditSink,
} from "./authRlsAuditEvent";
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
//   - auditSink: the Auth/RLS audit sink. Default-off: when omitted, the no-op sink
//     is used and nothing is persisted (Doc 16 sections 2, 9). A future writer slice
//     injects a real sink here with no change to this signature.
// Tests inject in-memory / mock-executor-backed doubles, so no Next.js request API,
// network, DB, or env is touched.
export type AdminAccessRequestDependencies = {
  cookies: RequestCookieAccessor;
  createPrincipalSource?: (args: {
    cookies: RequestCookieAccessor;
  }) => SolMindRequestAuthPrincipalSource;
  createAuthSource?: (args: { now: () => Date }) => SolMindAuthSource;
  now?: () => Date;
  auditSink?: AuthRlsAuditSink;
};

// Map the internal route-access result to a bounded Admin route access decision
// event. On allow, the server-derived account id is attributed under the admin
// role context. On deny, the event is opaque (system role context, no account id),
// so no Explorer/Guide identity is ever carried into the audit trail (Doc 16
// sections 7-8). This shapes the event only; it performs no IO and no persistence.
function toAdminAccessDecisionEvent(
  result: AuthorizeRouteAccessResult,
): AuthRlsAuditEvent {
  if (result.allowed) {
    return createAdminAccessDecisionEvent({
      decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
      actorUserAccountId: result.context.identity.userAccountId,
    });
  }
  return createAdminAccessDecisionEvent({
    decision: AUTH_RLS_AUDIT_DECISIONS.DENY,
  });
}

// Compose the /admin access decision for one request and return only { allowed }.
//
// Deny-by-default and fail-closed: returns { allowed: true } ONLY when a verified
// principal resolves, its real-loaded records derive a trusted context, and the
// server-derived active role is permitted on /admin. Every other outcome -- including
// any thrown principal-source/auth-source construction or load error, or a throwing
// injected audit sink -- returns { allowed: false } with no detail.
export async function resolveAdminAccessForRequest(
  deps: AdminAccessRequestDependencies,
): Promise<AdminAccessResult> {
  // Resolve the audit sink ONCE, before the try, so the fail-closed catch below can
  // also emit through it. Default-off: when no sink is injected the no-op sink is
  // used and NOTHING is persisted (Doc 16 sections 2, 9).
  const auditSink = deps.auditSink ?? NOOP_AUTH_RLS_AUDIT_SINK;

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

    // Bridge the two value-free composition seams (composeRequestAuthContext) to the
    // bounded Auth/RLS event model, both through the same default-off sink:
    //   - onServiceRoleRead fires exactly where the guarded service-role read happens
    //     (before records load), so the server-derived account id is not yet known and
    //     is null, per the createGuardedServiceRoleReadEvent contract. The event
    //     carries only the admin boundary role context, never guide/explorer.
    //   - onAuthResolutionFailure fires when composeRequestAuthContext swallows a
    //     resolution exception (a thrown principal source or record load) into the
    //     opaque denial. The event is a generic system security event with no
    //     principal and no failure detail.
    // This is the only place the rich event model is constructed.
    const result = await resolveAdminRouteAccess({
      principalSource,
      authSource,
      onServiceRoleRead: () =>
        auditSink(createGuardedServiceRoleReadEvent({ actorUserAccountId: null })),
      onAuthResolutionFailure: () =>
        auditSink(createAuthResolutionFailureEvent()),
    });

    // Emit exactly one bounded Admin route access decision event at this boundary
    // (Doc 16 sections 5-7, 9). Default-off: the sink is the no-op unless a real
    // sink is injected, so this adds no persistence and no runtime behavior change.
    // A throwing injected sink is caught below and fails closed (denies), the safe
    // MVP0 interim until the writer slice fixes the failure posture
    // (AUTH-RLS-DEF-003, AUTH-RLS-DEF-009).
    auditSink(toAdminAccessDecisionEvent(result));

    // Reduce to the opaque boolean: drop reason/context so nothing leaks outward.
    return { allowed: result.allowed };
  } catch {
    // Fail closed: swallow any REQUEST-PATH exception and deny. This catch covers
    // exceptions raised in this composition root rather than inside
    // composeRequestAuthContext (whose own resolution exceptions already fire the
    // onAuthResolutionFailure bridge above): a principal/auth-source FACTORY or
    // CONSTRUCTION error (for example a missing service-role env), or a throwing
    // DECISION sink. It records the request-path exception as a bounded
    // auth-resolution-failure event (Doc 16 section 5), itself guarded so a throwing
    // sink can never re-break fail-closed or leak.
    //
    // Duplicate-failure note: on the rare path where an inner resolution exception
    // already emitted a failure event and the later decision sink then throws, this
    // catch emits a SECOND bounded failure event (no de-duplication). That is
    // acceptable for the MVP0 default-off seam -- every event stays bounded and the
    // outcome is unchanged -- and the future real audit-writer slice may refine
    // duplicate-failure behavior once the audit-write failure policy is decided
    // (AUTH-RLS-DEF-003, AUTH-RLS-DEF-009).
    //
    // The outward result is always exactly { allowed: false } with no reason or
    // error detail.
    try {
      auditSink(createAuthResolutionFailureEvent());
    } catch {
      // Intentionally empty: a throwing sink must not flip the deny or leak.
    }
    return { allowed: false };
  }
}
