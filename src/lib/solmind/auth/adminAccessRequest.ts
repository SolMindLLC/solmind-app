// SolMind MVP0 server-only /admin access request composition helper.
//
// Purpose:
//   - own the per-request composition that the /admin/access Route Handler used to
//     inline: build the request-auth principal source (WHO) and the real Admin auth
//     source (WHAT), delegate the decision to resolveAdminRouteAccess, and reduce the
//     outcome to a single opaque { allowed } shape;
//   - make that composition deterministically testable WITHOUT Next.js request APIs
//     or real env, by accepting an injected RequestCookieAccessor and injectable
//     principal-source / auth-source / audit-writer factories. The route stays a thin
//     shell that only reads cookies() and serializes the result.
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
//     example missing public or service-role env) is swallowed and denies, so no
//     cookie, token, record, or secret can escape through an error path. This is the
//     same posture the route enforced inline; keeping it here makes it testable and
//     keeps it as defense in depth alongside the route's own outer guard.
//   - Opaque outcome only. The return value is exactly { allowed: boolean }. The
//     reason, the derived context, the active role, and any profile/session/identity
//     detail from resolveAdminRouteAccess are intentionally dropped here, so the
//     outward /admin/access surface can never leak them and no Explorer-private or
//     Guide-private field is assembled into the response.
//
// Runtime audit persistence (AUD-3; Doc 22 Sections 10-11; AUTH-RLS-DEC-028/029/030):
//   - This boundary is the single place the bounded authRlsAuditEvent model is
//     constructed, and as of AUD-3 it PERSISTS the Family A events through the real
//     AUD-2 result-based writer chain (auditEventWriter.ts over
//     auditEventWriteExecutor.ts over the service-role client), resolved by default
//     from createAdminAuditEventWriter. The default-off / no-op posture is RETIRED
//     for the production /admin/access path; tests inject deterministic writer
//     doubles through the same factory seam.
//   - Per-class write-failure posture (Doc 22 Section 10, approved at Gate 1):
//       * Would-be ALLOW (fail-closed, AUTH-RLS-DEC-029/030): after the boundary
//         resolves the admin actor, the guarded_service_role_read row is persisted
//         FIRST, then the admin_route_access_decision / allow row, and BOTH must
//         succeed before the outward { allowed: true }. A guarded-read write failure
//         denies with no allow row written; an allow-decision write failure after
//         the guarded-read row persisted denies, and the truthful residual
//         guarded-read row is accepted for MVP0 (AUTH-RLS-DEC-030 carve-out). An
//         audit-write-failure-induced deny persists NO additional decision or
//         failure row (not approved; the bounded operational signal below is the
//         only side channel).
//       * DENY decision and AUTH-RESOLUTION FAILURE (best-effort): the outcome is
//         already a deny and never changes; a persist failure raises only the
//         bounded, value-free operational signal.
//   - The persisted guarded-read event is constructed POST-RESOLUTION with the
//     server-derived admin account id (AUTH-RLS-DEC-029). The legacy pre-read
//     guarded-read bridge is REMOVED: this module no longer passes onServiceRoleRead,
//     so the pre-read hook stays a value-free, default-off marker inside
//     composeRequestAuthContext (placement unchanged, AUTH-RLS-DEC-024) and no
//     double emission is possible. Deny outcomes persist no guarded-read row for
//     MVP0 (AUTH-RLS-DEF-019 tracks the deferred vocabulary expansion).
//   - No false attribution and no false failure rows: the writer is result-based and
//     NEVER throws, so an audit-write failure can never route through the generic
//     fail-closed catch below and mint a false auth_resolution_failure row. The
//     auth_resolution_failure event is persisted (best-effort) only for genuine
//     resolution exceptions: the bridged onAuthResolutionFailure seam inside
//     composeRequestAuthContext, and this module's own catch for a request-path
//     construction/factory exception.
//   - Operational signal: onAuditWriteFailure is a bounded, VALUE-FREE injectable
//     seam (no arguments, no payload, default no-op) fired once per failed persist
//     attempt. A real operational logging/alarm mechanism is deferred to its own
//     approved slice; the signal itself is guarded so a throwing implementation can
//     never flip an outcome, leak, or reach the fail-closed catch.

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
  type AuthRlsAuditEvent,
} from "./authRlsAuditEvent";
import {
  toPersistableAuthRlsAuditEvent,
  type AuthRlsAuditEventWriter,
} from "./auditEventWriter";
import { createAdminAuditEventWriter } from "../supabase/adminAuditEventWriter";
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
//   - createAuditEventWriter: builds the audit persistence port. Defaults to the
//     REAL writer chain (createAdminAuditEventWriter: service-role client -> write
//     executor -> writer), so production /admin/access persists audit rows with no
//     route change (AUD-3). Construction is guarded below: a throwing factory (for
//     example missing service-role env) resolves to an unavailable writer, which
//     fails the allow path closed and leaves best-effort paths unchanged.
//   - onAuditWriteFailure: the bounded, value-free operational signal for a failed
//     audit persist attempt. Default no-op; carries no arguments and no payload.
// Tests inject in-memory / mock-executor-backed doubles, so no Next.js request API,
// network, DB, or env is touched.
export type AdminAccessRequestDependencies = {
  cookies: RequestCookieAccessor;
  createPrincipalSource?: (args: {
    cookies: RequestCookieAccessor;
  }) => SolMindRequestAuthPrincipalSource;
  createAuthSource?: (args: { now: () => Date }) => SolMindAuthSource;
  now?: () => Date;
  createAuditEventWriter?: () => AuthRlsAuditEventWriter;
  onAuditWriteFailure?: () => void;
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
// principal resolves, its real-loaded records derive a trusted context, the
// server-derived active role is permitted on /admin, AND both required audit rows
// (guarded-read first, then the allow decision; AUTH-RLS-DEC-029/030) have
// persisted. Every other outcome -- including any thrown principal-source /
// auth-source construction or load error, an unavailable audit writer, or a failed
// required audit write -- returns { allowed: false } with no detail.
export async function resolveAdminAccessForRequest(
  deps: AdminAccessRequestDependencies,
): Promise<AdminAccessResult> {
  // The bounded, value-free operational signal (default no-op). Guarded so a
  // throwing injected signal can never flip an outcome, leak, or route into the
  // fail-closed catch below (which would mint a false failure row).
  const signalAuditWriteFailure = (): void => {
    try {
      deps.onAuditWriteFailure?.();
    } catch {
      // Intentionally empty: the operational signal must never affect the outcome.
    }
  };

  // Resolve the audit writer ONCE, before the try, inside its own guard. A throwing
  // writer factory (for example missing service-role env on the default real chain)
  // resolves to null -- audit persistence is then UNAVAILABLE: every persist attempt
  // below reports failure, so the allow path fails closed and best-effort paths
  // proceed unchanged. The construction failure deliberately does NOT flow into the
  // fail-closed catch, so audit unavailability alone can never mint a false
  // auth_resolution_failure row.
  let auditWriter: AuthRlsAuditEventWriter | null = null;
  try {
    auditWriter = (deps.createAuditEventWriter ?? createAdminAuditEventWriter)();
  } catch {
    auditWriter = null;
  }

  // Persist one banked bounded event through the result-based writer. Returns true
  // ONLY when the row is confirmed persisted. Never throws: an unavailable writer,
  // an unmappable event, a failure result, and even a (contract-violating) throwing
  // or rejecting injected writer all resolve to false, so an audit-write failure is
  // always handled as a RESULT at the call site and can never reach the generic
  // catch as an exception (no false auth_resolution_failure rows).
  const persistBankedAuditEvent = async (
    event: AuthRlsAuditEvent,
  ): Promise<boolean> => {
    if (auditWriter === null) {
      return false;
    }
    const persistable = toPersistableAuthRlsAuditEvent(event);
    if (persistable === null) {
      return false;
    }
    try {
      const result = await auditWriter.persistAuthRlsAuditEvent(persistable);
      return result.persisted === true;
    } catch {
      return false;
    }
  };

  // Best-effort persistence for the deny-decision and auth-resolution-failure
  // classes (Doc 22 Section 10): the already-denied outcome never changes; a persist
  // failure raises only the bounded operational signal. Never throws/rejects, so the
  // bridged onAuthResolutionFailure seam below can never re-break fail-closed.
  const persistBestEffortAuditEvent = async (
    event: AuthRlsAuditEvent,
  ): Promise<void> => {
    const persisted = await persistBankedAuditEvent(event);
    if (!persisted) {
      signalAuditWriteFailure();
    }
  };

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

    // Delegate the decision. The legacy pre-read guarded-read bridge is REMOVED
    // (AUTH-RLS-DEC-029): onServiceRoleRead is not passed, so the pre-read hook
    // stays a value-free, default-off marker inside composeRequestAuthContext and
    // the persisted guarded-read row is written post-resolution below -- exactly
    // once per allowed request, with no double emission. Only the genuine
    // auth-resolution-failure seam is bridged, best-effort, through the writer.
    const result = await resolveAdminRouteAccess({
      principalSource,
      authSource,
      onAuthResolutionFailure: () =>
        persistBestEffortAuditEvent(createAuthResolutionFailureEvent()),
    });

    if (result.allowed) {
      // Would-be ALLOW: two fail-closed writes in the AUTH-RLS-DEC-030 order --
      // the post-resolution guarded-read row FIRST, then the allow decision row.
      // Both must persist before the outward { allowed: true }, so an allow can
      // never outrun either of its audit rows (Doc 22 Section 10).
      const actorUserAccountId = result.context.identity.userAccountId;

      const guardedReadPersisted = await persistBankedAuditEvent(
        createGuardedServiceRoleReadEvent({ actorUserAccountId }),
      );
      if (!guardedReadPersisted) {
        // Fail closed with NO allow row written and NO additional deny/failure
        // row (an audit-write-failure-induced deny stays row-free by design);
        // the bounded signal is the only side channel.
        signalAuditWriteFailure();
        return { allowed: false };
      }

      const allowDecisionPersisted = await persistBankedAuditEvent(
        toAdminAccessDecisionEvent(result),
      );
      if (!allowDecisionPersisted) {
        // Fail closed. The already-persisted guarded-read row remains as the
        // truthful residual record (AUTH-RLS-DEC-030: the actor was resolved and
        // the guarded read occurred -- not false attribution). No additional
        // deny/failure row is written.
        signalAuditWriteFailure();
        return { allowed: false };
      }

      return { allowed: true };
    }

    // Genuine DENY (verified non-Admin, null principal, or an inner resolution
    // failure already collapsed to the opaque denial): best-effort persist the
    // opaque deny decision row (system context, null actor). The outcome never
    // changes and no guarded-read row is attempted (AUTH-RLS-DEC-029 deny path).
    await persistBestEffortAuditEvent(toAdminAccessDecisionEvent(result));
    return { allowed: false };
  } catch {
    // Fail closed: swallow any REQUEST-PATH exception and deny. This catch covers
    // genuine construction/factory exceptions raised in this composition root (for
    // example a missing service-role env thrown by the auth-source factory) rather
    // than inside composeRequestAuthContext, whose own resolution exceptions
    // already fire the bridged onAuthResolutionFailure seam above. Audit-write
    // failures can NOT land here: the writer path is result-based and guarded, so
    // this catch never records a false failure row for a failed audit write.
    //
    // The genuine failure is recorded best-effort as a bounded
    // auth-resolution-failure event; the helper never throws, so this catch cannot
    // re-break fail-closed or leak. The outward result is always exactly
    // { allowed: false } with no reason or error detail.
    await persistBestEffortAuditEvent(createAuthResolutionFailureEvent());
    return { allowed: false };
  }
}
