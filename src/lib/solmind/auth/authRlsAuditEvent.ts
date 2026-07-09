// SolMind MVP0 server-only Auth/RLS audit event seam (bounded event model).
//
// Purpose:
//   - define a small, typed, BOUNDED audit event shape for the MVP0 Auth/RLS
//     access and security events scoped by Doc 16 (Auth/RLS Audit Seam Plan,
//     sections 5 and 7): Admin route access decisions, guarded service-role
//     reads, and bounded auth resolution failures;
//   - provide deterministic, side-effect-free factory helpers that shape those
//     events from only non-sensitive, server-derived values;
//   - provide a no-op sink for tests and default-off marker callers. As of the
//     AUD-3 wiring slice the production /admin/access boundary persists these
//     events through the real AUD-2 writer chain (AUTH-RLS-DEF-003,
//     AUTH-RLS-DEF-009 implemented for that boundary); the no-op sink is demoted
//     to test-only use there.
//
// What this module is NOT (scope guard):
//   - It performs NO persistence itself. There is no database, Supabase, network,
//     filesystem, cookie, header, env, or service-role access here. It does not
//     write to audit.audit_event and proposes no schema, migration, RLS policy,
//     or grant. The runtime writer chain lives in auditEventWriter.ts /
//     auditEventWriteExecutor.ts and is composed at the /admin/access boundary
//     (adminAccessRequest.ts) as of AUD-3; this module only shapes events.
//
// Architecture notes (MVP0):
//   - Server-only and OFF the shared src/lib/solmind/auth/index.ts barrel,
//     mirroring composeRequestAuthContext, adminRouteAccess, adminAccessRequest,
//     serviceRoleClient, and requestAuthClient (AUTH-RLS-DEC-007, AUTH-RLS-DEC-013,
//     AUTH-RLS-DEC-023). The `import "server-only";` marker is the import-time
//     guard, backed by the runtime browser guard below. Import it only from
//     explicit server paths.
//   - Privacy by construction (Doc 16 sections 7-8): every field is a bounded,
//     enumerated literal or a coarse server-derived id. There is NO free-form
//     content field, so conversation content, reflections, summaries, safety-flag
//     text, secrets, tokens, cookies, raw error detail, and full record bodies
//     CANNOT be represented in the event type. This is a structural guarantee,
//     not a convention.
//   - Role separation preserved: MVP0 Auth/RLS events carry only the
//     server-derived `admin` or `system` role context (Doc 16 section 5). Explorer
//     and Guide role contexts are intentionally NOT part of this Auth/RLS event
//     model, so it cannot blend Explorer-private and Guide-private context.

import "server-only";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: authRlsAuditEvent must not be imported in browser code.",
  );
}

// --- Bounded controlled values (Doc 16 sections 5, 7) ---
//
// Each controlled vocabulary is a closed set of plain string literals. The union
// types derived from them are what every event field is typed against, so no
// caller can introduce a free-form value.

// The Auth/RLS audit event categories in scope for MVP0 (Doc 16 section 5).
export const AUTH_RLS_AUDIT_EVENT_TYPES = {
  ADMIN_ROUTE_ACCESS_DECISION: "admin_route_access_decision",
  GUARDED_SERVICE_ROLE_READ: "guarded_service_role_read",
  AUTH_RESOLUTION_FAILURE: "auth_resolution_failure",
} as const;

export type AuthRlsAuditEventType =
  (typeof AUTH_RLS_AUDIT_EVENT_TYPES)[keyof typeof AUTH_RLS_AUDIT_EVENT_TYPES];

// The server-derived actor role context. MVP0 Auth/RLS events are only `admin`
// or `system` (Doc 16 section 5); Explorer and Guide are intentionally excluded
// so this model cannot attribute or blend their private context. This is a
// deliberate SUBSET of the database actor_role_context set
// (admin / guide / explorer / system).
export const AUTH_RLS_AUDIT_ROLE_CONTEXTS = {
  ADMIN: "admin",
  SYSTEM: "system",
} as const;

export type AuthRlsAuditRoleContext =
  (typeof AUTH_RLS_AUDIT_ROLE_CONTEXTS)[keyof typeof AUTH_RLS_AUDIT_ROLE_CONTEXTS];

// The outcome of an Admin route access decision.
export const AUTH_RLS_AUDIT_DECISIONS = {
  ALLOW: "allow",
  DENY: "deny",
} as const;

export type AuthRlsAuditDecision =
  (typeof AUTH_RLS_AUDIT_DECISIONS)[keyof typeof AUTH_RLS_AUDIT_DECISIONS];

// Coarse target entity classes (the resource class, NOT record contents; Doc 16
// section 7). MVP0 covers only the Admin route boundary.
export const AUTH_RLS_AUDIT_TARGET_TYPES = {
  ADMIN_ROUTE: "admin_route",
} as const;

export type AuthRlsAuditTargetType =
  (typeof AUTH_RLS_AUDIT_TARGET_TYPES)[keyof typeof AUTH_RLS_AUDIT_TARGET_TYPES];

// Bounded, enumerated reason codes (NOT free-form internal error text; Doc 16
// sections 7-8). These are generic and reveal no record-, step-, or
// error-level detail.
export const AUTH_RLS_AUDIT_REASON_CODES = {
  ACCESS_GRANTED: "access_granted",
  ACCESS_DENIED: "access_denied",
  GUARDED_READ: "guarded_read",
  AUTH_UNRESOLVED: "auth_unresolved",
} as const;

export type AuthRlsAuditReasonCode =
  (typeof AUTH_RLS_AUDIT_REASON_CODES)[keyof typeof AUTH_RLS_AUDIT_REASON_CODES];

// Short, FIXED, non-sensitive descriptions (Doc 16 section 7). The event summary
// is always chosen from this closed set; it is never caller-supplied free text.
export const AUTH_RLS_AUDIT_EVENT_SUMMARIES = {
  ADMIN_ACCESS_ALLOWED: "Admin route access allowed.",
  ADMIN_ACCESS_DENIED: "Admin route access denied.",
  GUARDED_SERVICE_ROLE_READ: "Guarded service-role read at the admin boundary.",
  AUTH_RESOLUTION_FAILED: "Auth resolution failed at the admin boundary.",
} as const;

export type AuthRlsAuditEventSummary =
  (typeof AUTH_RLS_AUDIT_EVENT_SUMMARIES)[keyof typeof AUTH_RLS_AUDIT_EVENT_SUMMARIES];

// --- Bounded metadata ---
//
// Only these enumerated, non-sensitive keys exist, and each value is itself a
// bounded literal. No content, secret, token, cookie, or raw error detail can be
// represented here (Doc 16 section 8). The keys map to non-sensitive
// audit.audit_event metadata in a later writer slice.
export type AuthRlsAuditMetadata = {
  routeId?: AuthRlsAuditTargetType;
  decision?: AuthRlsAuditDecision;
};

// --- The bounded audit event (Doc 16 section 7) ---
//
// Every field is a bounded literal or a coarse server-derived id. There is no
// free-form content field by design (Doc 16 section 8). actorUserAccountId is
// null when there is no verified principal to attribute (the opaque deny and
// auth-resolution-failure events; a persisted guarded read carries a non-null
// post-resolution actor per AUTH-RLS-DEC-029). These fields reuse the existing
// audit.audit_event columns (Doc 16 sections 2, 7); this module shapes the event
// only and writes nothing.
export type AuthRlsAuditEvent = {
  eventType: AuthRlsAuditEventType;
  actorRoleContext: AuthRlsAuditRoleContext;
  actorUserAccountId: string | null;
  targetEntityType: AuthRlsAuditTargetType;
  reasonCode: AuthRlsAuditReasonCode;
  eventSummary: AuthRlsAuditEventSummary;
  metadata?: AuthRlsAuditMetadata;
};

// --- Deterministic, side-effect-free event factories (safe shaping) ---
//
// Each factory builds a bounded event from only non-sensitive, server-derived
// inputs. They perform no IO and read no ambient state (no Date.now, no env, no
// cookies/headers); event time and persistence belong to the deferred writer
// slice. A factory cannot emit content or secrets because every field it sets is
// drawn from the controlled vocabularies above.

// The Admin route access decision input. An allow carries the server-resolved
// admin account id; a deny carries NO account id at all (a denied or
// unauthenticated request is recorded opaquely under the `system` role context),
// so a denied Explorer/Guide identity is never attributed or carried outward.
export type AdminAccessDecisionInput =
  | {
      decision: typeof AUTH_RLS_AUDIT_DECISIONS.ALLOW;
      actorUserAccountId: string;
    }
  | { decision: typeof AUTH_RLS_AUDIT_DECISIONS.DENY };

// Shape an Admin route access decision event (allow or deny).
export function createAdminAccessDecisionEvent(
  input: AdminAccessDecisionInput,
): AuthRlsAuditEvent {
  if (input.decision === AUTH_RLS_AUDIT_DECISIONS.ALLOW) {
    return {
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
      actorUserAccountId: input.actorUserAccountId,
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.ACCESS_GRANTED,
      eventSummary: AUTH_RLS_AUDIT_EVENT_SUMMARIES.ADMIN_ACCESS_ALLOWED,
      metadata: {
        routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
        decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
      },
    };
  }

  // Deny is intentionally opaque about WHO: no account id is accepted or
  // recorded, and the role context is `system`, so a denied or unauthenticated
  // Explorer/Guide identity is never attributed or carried into the event.
  return {
    eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM,
    actorUserAccountId: null,
    targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
    reasonCode: AUTH_RLS_AUDIT_REASON_CODES.ACCESS_DENIED,
    eventSummary: AUTH_RLS_AUDIT_EVENT_SUMMARIES.ADMIN_ACCESS_DENIED,
    metadata: {
      routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      decision: AUTH_RLS_AUDIT_DECISIONS.DENY,
    },
  };
}

// Shape a guarded service-role read event for the admin boundary. The guarded
// read occurs only after a principal has resolved, so the role context is
// `admin`. Per AUTH-RLS-DEC-029 the PERSISTED guarded-read event is constructed
// post-resolution with the non-null server-derived account id; the nullable input
// is retained for the banked event-model shape and its tests, and a null-actor
// event is unpersistable by design (the AUD-2 writer fails it closed, no RPC).
export function createGuardedServiceRoleReadEvent(args: {
  actorUserAccountId: string | null;
}): AuthRlsAuditEvent {
  return {
    eventType: AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
    actorUserAccountId: args.actorUserAccountId,
    targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
    reasonCode: AUTH_RLS_AUDIT_REASON_CODES.GUARDED_READ,
    eventSummary: AUTH_RLS_AUDIT_EVENT_SUMMARIES.GUARDED_SERVICE_ROLE_READ,
    metadata: {
      routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
    },
  };
}

// Shape a bounded auth resolution failure event: a request reached the boundary
// but failed closed (Doc 16 section 5). It is a generic `system` security event
// with no principal and no failure detail; it never reveals which record or step
// failed (Doc 16 section 8).
export function createAuthResolutionFailureEvent(): AuthRlsAuditEvent {
  return {
    eventType: AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
    actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM,
    actorUserAccountId: null,
    targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
    reasonCode: AUTH_RLS_AUDIT_REASON_CODES.AUTH_UNRESOLVED,
    eventSummary: AUTH_RLS_AUDIT_EVENT_SUMMARIES.AUTH_RESOLUTION_FAILED,
  };
}

// --- The audit sink (async awaited as of AUD-2; no-op test-only as of AUD-3) ---
//
// A sink receives a bounded event. The only sink provided here is a no-op that
// persists NOTHING. As of the AUD-3 wiring slice the production /admin/access
// boundary persists events through the real AUD-2 writer chain directly
// (adminAccessRequest.ts over auditEventWriter.ts), so the no-op sink is demoted
// to test-only / default-off-marker use (AUTH-RLS-DEF-003, AUTH-RLS-DEF-009
// implemented for that boundary).
//
// Async awaited sink contract (Doc 22 Section 11, approved at Gate 1 with
// AUTH-RLS-DEC-028): a real writer-backed sink is asynchronous, so the sink type
// admits a Promise-returning sink and EVERY emission site awaits the sink before
// proceeding. A synchronous throw and an asynchronous rejection are then handled
// identically at the awaited call sites (fail-closed classes deny; best-effort
// classes swallow without an unhandled rejection), and an allow can never resolve
// before an awaited audit write settles. Synchronous sinks -- the no-op below and
// existing test doubles -- remain valid: a void return is awaited as an
// already-settled value.
export type AuthRlsAuditSink = (event: AuthRlsAuditEvent) => void | Promise<void>;

// The no-op sink (test-only / default-off-marker use as of AUD-3). It persists
// nothing, returns nothing, and never throws. It declares no parameter because it
// discards every event; it stays assignable to AuthRlsAuditSink, whose typed
// parameter documents the bounded event shape. This mirrors the existing
// noopCookieSetAll no-op pattern.
export function noopAuthRlsAuditSink(): void {
  // Intentionally empty: the no-op sink persists nothing by design.
}

// A shared no-op sink instance for tests and default-off marker callers. The
// production /admin/access boundary no longer uses it as of AUD-3.
export const NOOP_AUTH_RLS_AUDIT_SINK: AuthRlsAuditSink = noopAuthRlsAuditSink;
