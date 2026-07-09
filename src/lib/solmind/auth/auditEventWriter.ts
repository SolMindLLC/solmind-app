// SolMind MVP0 server-only Auth/RLS audit event writer (AUD-2).
//
// Purpose:
//   - map a bounded, banked Auth/RLS audit event (authRlsAuditEvent.ts) to the exact
//     named arguments of the banked AUD-1 database function
//     public.solmind_record_audit_event, through the closed-allowlist write seam
//     (auditEventWriteExecutor.ts), and resolve EVERY failure to a detail-free,
//     value-free sentinel (audit persistence contract Doc 22 Section 11;
//     AUTH-RLS-DEC-028).
//   - derive the persisted `action` column EXPLICITLY from the closed mapping below.
//     The banked app event model deliberately carries NO action field; the action is
//     never caller-supplied and never inferred from free input (M3 guard).
//   - enforce, as defense in depth, that a null-actor guarded_service_role_read event
//     can NEVER reach the database function: the persistable envelope types the
//     guarded-read actor as non-null, and the runtime mapping/validation below fails
//     any null- or empty-actor guarded read closed with NO RPC call
//     (AUTH-RLS-DEC-029; the banked function requires a non-null FK-valid actor for
//     this pair, so naive persistence of the pre-read bridge event would deny every
//     request including valid Admins).
//
// Server-only boundary (critical):
//   - This module builds the arguments for an RLS-bypassing privileged write, so it
//     must never run in the browser. The `import "server-only";` marker is the
//     import-time guard (AUTH-RLS-DEC-023), backed by the runtime browser guard
//     below, and this module stays OFF the shared src/lib/solmind/auth/index.ts
//     barrel (AUTH-RLS-DEC-007), mirroring the existing server-only family.
//
// Scope discipline (AUD-2; no production wiring):
//   - Nothing constructs this writer in production. The audit seam stays default-off
//     / no-op (NOOP_AUTH_RLS_AUDIT_SINK), and nothing is persisted at runtime until
//     the separately Paul-gated AUD-3 wiring slice injects the real chain
//     (createServiceRoleClient() -> createAuditEventWriteExecutor ->
//     createAuthRlsAuditEventWriter) at the /admin/access composition root and
//     applies the per-class write-failure posture (Doc 22 Sections 10-11;
//     AUTH-RLS-DEC-029 post-resolution guarded-read timing; AUTH-RLS-DEC-030
//     guarded-read-row-first two-write ordering).
//   - Privacy is structural and two-layer (Doc 22 Section 9.3): the bounded event
//     model cannot represent content or secrets, this mapping refuses anything that
//     does not exactly match one approved row, and the database function
//     independently re-validates every value. event_summary is never sent (the
//     function derives it); ip_address/user_agent are structurally absent.

import "server-only";

import {
  AUTH_RLS_AUDIT_DECISIONS,
  AUTH_RLS_AUDIT_EVENT_SUMMARIES,
  AUTH_RLS_AUDIT_EVENT_TYPES,
  AUTH_RLS_AUDIT_REASON_CODES,
  AUTH_RLS_AUDIT_ROLE_CONTEXTS,
  AUTH_RLS_AUDIT_TARGET_TYPES,
  type AuthRlsAuditEvent,
} from "./authRlsAuditEvent";
import {
  AUDIT_WRITE_FAILED_ERROR,
  RECORD_AUDIT_EVENT_INTENT,
  type AuditEventWriteError,
  type AuditEventWriteExecutor,
  type SolmindRecordAuditEventArgs,
} from "../supabase/auditEventWriteExecutor";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: auditEventWriter must not be imported in browser code.",
  );
}

// --- The persisted action vocabulary (closed; mirrors the AUD-1 baked pairs) ---
//
// The banked app event model deliberately has no action field, so the database
// `action` column is derived HERE, from the closed mapping below, and nowhere else.
// These are the only three actions the four baked AUD-1 (event_type, action) pairs
// use; this is a persistence-mapping vocabulary, not an event-model expansion.
export const AUTH_RLS_AUDIT_ACTIONS = {
  ALLOW: "allow",
  DENY: "deny",
  READ: "read",
} as const;

export type AuthRlsAuditAction =
  (typeof AUTH_RLS_AUDIT_ACTIONS)[keyof typeof AUTH_RLS_AUDIT_ACTIONS];

// The exact bounded metadata payload each approved row persists. These are the
// single source of truth for both the mapping (banked event -> envelope) and the
// runtime validation inside the writer, and they match the AUD-1 per-event metadata
// key allowlists exactly (routeId/decision for the decision pairs, routeId for the
// guarded read, and NO keys for the resolution failure).
const ADMIN_ACCESS_ALLOW_METADATA = {
  routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
  decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
} as const;

const ADMIN_ACCESS_DENY_METADATA = {
  routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
  decision: AUTH_RLS_AUDIT_DECISIONS.DENY,
} as const;

const GUARDED_READ_METADATA = {
  routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
} as const;

const AUTH_RESOLUTION_FAILURE_METADATA: Record<string, never> = {};

// --- The persistable envelope (Doc 22 Section 8; the writer's ONLY input) ---
//
// A discriminated union over the four approved Family A rows, aligned to the
// audit.audit_event column set. Each arm fixes its action, role context, actor
// presence, reason code, and exact metadata payload at the TYPE level, so nothing
// outside a bounded family row is representable at the writer input. Per
// AUTH-RLS-DEC-029 the guarded-read actor is typed NON-NULL: a null-actor guarded
// read is unrepresentable here, and the runtime validation below additionally fails
// a type-cast-forged one closed with no RPC call. There is no eventSummary field:
// the database function derives the summary from the validated pair, so a
// caller-supplied summary is structurally impossible.
export type PersistableAdminAccessAllowAuditEvent = {
  eventType: typeof AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION;
  action: typeof AUTH_RLS_AUDIT_ACTIONS.ALLOW;
  actorRoleContext: typeof AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN;
  actorUserAccountId: string;
  targetEntityType: typeof AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE;
  reasonCode: typeof AUTH_RLS_AUDIT_REASON_CODES.ACCESS_GRANTED;
  metadata: typeof ADMIN_ACCESS_ALLOW_METADATA;
};

export type PersistableAdminAccessDenyAuditEvent = {
  eventType: typeof AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION;
  action: typeof AUTH_RLS_AUDIT_ACTIONS.DENY;
  actorRoleContext: typeof AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM;
  actorUserAccountId: null;
  targetEntityType: typeof AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE;
  reasonCode: typeof AUTH_RLS_AUDIT_REASON_CODES.ACCESS_DENIED;
  metadata: typeof ADMIN_ACCESS_DENY_METADATA;
};

export type PersistableGuardedServiceRoleReadAuditEvent = {
  eventType: typeof AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ;
  action: typeof AUTH_RLS_AUDIT_ACTIONS.READ;
  actorRoleContext: typeof AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN;
  // Non-null by decision AUTH-RLS-DEC-029: the persisted guarded-read event is
  // constructed only AFTER actor/account resolution (an AUD-3 concern), so a
  // null-actor guarded read is unrepresentable at the writer input.
  actorUserAccountId: string;
  targetEntityType: typeof AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE;
  reasonCode: typeof AUTH_RLS_AUDIT_REASON_CODES.GUARDED_READ;
  metadata: typeof GUARDED_READ_METADATA;
};

export type PersistableAuthResolutionFailureAuditEvent = {
  eventType: typeof AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE;
  action: typeof AUTH_RLS_AUDIT_ACTIONS.DENY;
  actorRoleContext: typeof AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM;
  actorUserAccountId: null;
  targetEntityType: typeof AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE;
  reasonCode: typeof AUTH_RLS_AUDIT_REASON_CODES.AUTH_UNRESOLVED;
  // Record<string, never> (not the wide `{}` type) so no key is representable.
  metadata: Record<string, never>;
};

export type PersistableAuthRlsAuditEvent =
  | PersistableAdminAccessAllowAuditEvent
  | PersistableAdminAccessDenyAuditEvent
  | PersistableGuardedServiceRoleReadAuditEvent
  | PersistableAuthResolutionFailureAuditEvent;

// --- Shared validation helpers ---

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// Exact metadata match: the actual metadata (undefined counts as empty, matching the
// banked auth-resolution-failure factory, which sets no metadata field) must carry
// exactly the expected keys with exactly the expected values. Extra keys, missing
// keys, wrong values, arrays, and non-object shapes all fail.
function metadataMatchesExactly(
  actual: unknown,
  expected: Readonly<Record<string, string>>,
): boolean {
  const expectedKeys = Object.keys(expected).sort();
  if (actual === undefined) {
    return expectedKeys.length === 0;
  }
  if (typeof actual !== "object" || actual === null || Array.isArray(actual)) {
    return false;
  }
  const actualRecord = actual as Record<string, unknown>;
  const actualKeys = Object.keys(actualRecord).sort();
  if (actualKeys.length !== expectedKeys.length) {
    return false;
  }
  for (let index = 0; index < expectedKeys.length; index += 1) {
    if (actualKeys[index] !== expectedKeys[index]) {
      return false;
    }
    if (actualRecord[expectedKeys[index]] !== expected[expectedKeys[index]]) {
      return false;
    }
  }
  return true;
}

// --- The closed mapping: banked event -> persistable envelope (M3 guard) ---
//
// Each block mirrors one baked AUD-1 (event_type, action) pair and validates the
// FULL banked event shape -- role context, actor presence, target, reason code,
// fixed summary, and exact metadata -- before deriving the action. Any event that
// does not exactly match one approved row returns null, and the writer then fails
// closed with NO RPC call: a null- or empty-actor guarded read (AUTH-RLS-DEC-029),
// a hand-crafted or tampered event, a mismatched role/reason/summary/metadata, or
// an unknown event type. Null is value-free; nothing from the event is echoed.
export function toPersistableAuthRlsAuditEvent(
  event: AuthRlsAuditEvent,
): PersistableAuthRlsAuditEvent | null {
  if (
    event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION &&
    event.actorRoleContext === AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN &&
    isNonEmptyString(event.actorUserAccountId) &&
    event.targetEntityType === AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE &&
    event.reasonCode === AUTH_RLS_AUDIT_REASON_CODES.ACCESS_GRANTED &&
    event.eventSummary === AUTH_RLS_AUDIT_EVENT_SUMMARIES.ADMIN_ACCESS_ALLOWED &&
    metadataMatchesExactly(event.metadata, ADMIN_ACCESS_ALLOW_METADATA)
  ) {
    return {
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
      action: AUTH_RLS_AUDIT_ACTIONS.ALLOW,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
      actorUserAccountId: event.actorUserAccountId,
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.ACCESS_GRANTED,
      metadata: ADMIN_ACCESS_ALLOW_METADATA,
    };
  }

  if (
    event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION &&
    event.actorRoleContext === AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM &&
    event.actorUserAccountId === null &&
    event.targetEntityType === AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE &&
    event.reasonCode === AUTH_RLS_AUDIT_REASON_CODES.ACCESS_DENIED &&
    event.eventSummary === AUTH_RLS_AUDIT_EVENT_SUMMARIES.ADMIN_ACCESS_DENIED &&
    metadataMatchesExactly(event.metadata, ADMIN_ACCESS_DENY_METADATA)
  ) {
    return {
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
      action: AUTH_RLS_AUDIT_ACTIONS.DENY,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM,
      actorUserAccountId: null,
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.ACCESS_DENIED,
      metadata: ADMIN_ACCESS_DENY_METADATA,
    };
  }

  // Guarded service-role read: the actor must already be resolved (non-empty
  // string). The banked pre-read bridge event carries a structurally-unavailable
  // null actor and is deliberately UNMAPPABLE here (AUTH-RLS-DEC-029): persisting
  // it would violate the banked function's non-null actor requirement.
  if (
    event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ &&
    event.actorRoleContext === AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN &&
    isNonEmptyString(event.actorUserAccountId) &&
    event.targetEntityType === AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE &&
    event.reasonCode === AUTH_RLS_AUDIT_REASON_CODES.GUARDED_READ &&
    event.eventSummary ===
      AUTH_RLS_AUDIT_EVENT_SUMMARIES.GUARDED_SERVICE_ROLE_READ &&
    metadataMatchesExactly(event.metadata, GUARDED_READ_METADATA)
  ) {
    return {
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
      action: AUTH_RLS_AUDIT_ACTIONS.READ,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
      actorUserAccountId: event.actorUserAccountId,
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.GUARDED_READ,
      metadata: GUARDED_READ_METADATA,
    };
  }

  if (
    event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE &&
    event.actorRoleContext === AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM &&
    event.actorUserAccountId === null &&
    event.targetEntityType === AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE &&
    event.reasonCode === AUTH_RLS_AUDIT_REASON_CODES.AUTH_UNRESOLVED &&
    event.eventSummary ===
      AUTH_RLS_AUDIT_EVENT_SUMMARIES.AUTH_RESOLUTION_FAILED &&
    metadataMatchesExactly(event.metadata, AUTH_RESOLUTION_FAILURE_METADATA)
  ) {
    return {
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
      action: AUTH_RLS_AUDIT_ACTIONS.DENY,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM,
      actorUserAccountId: null,
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.AUTH_UNRESOLVED,
      metadata: AUTH_RESOLUTION_FAILURE_METADATA,
    };
  }

  return null;
}

// --- Runtime envelope validation and exact argument construction ---
//
// TypeScript types are erased at runtime, so the writer re-validates the envelope
// against the same closed rows before building arguments (defense in depth against
// a type-cast-forged envelope, per AUTH-RLS-DEC-029). The validation table below is
// keyed by the (eventType, action) pair, mirroring the AUD-1 baked allowlist.
type PersistableEventRowSpec = {
  eventType: string;
  action: AuthRlsAuditAction;
  actorRoleContext: string;
  actorRequired: boolean;
  reasonCode: string;
  metadata: Readonly<Record<string, string>>;
};

const PERSISTABLE_EVENT_ROW_SPECS: readonly PersistableEventRowSpec[] = [
  {
    eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    action: AUTH_RLS_AUDIT_ACTIONS.ALLOW,
    actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
    actorRequired: true,
    reasonCode: AUTH_RLS_AUDIT_REASON_CODES.ACCESS_GRANTED,
    metadata: ADMIN_ACCESS_ALLOW_METADATA,
  },
  {
    eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    action: AUTH_RLS_AUDIT_ACTIONS.DENY,
    actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM,
    actorRequired: false,
    reasonCode: AUTH_RLS_AUDIT_REASON_CODES.ACCESS_DENIED,
    metadata: ADMIN_ACCESS_DENY_METADATA,
  },
  {
    eventType: AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    action: AUTH_RLS_AUDIT_ACTIONS.READ,
    actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
    actorRequired: true,
    reasonCode: AUTH_RLS_AUDIT_REASON_CODES.GUARDED_READ,
    metadata: GUARDED_READ_METADATA,
  },
  {
    eventType: AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
    action: AUTH_RLS_AUDIT_ACTIONS.DENY,
    actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM,
    actorRequired: false,
    reasonCode: AUTH_RLS_AUDIT_REASON_CODES.AUTH_UNRESOLVED,
    metadata: AUTH_RESOLUTION_FAILURE_METADATA,
  },
];

// Build the exact named arguments for the enumerated function, or null when the
// envelope does not exactly match one approved row (the writer then fails closed
// with no RPC call). The metadata sent is the SPEC's fixed payload (already proven
// equal to the envelope's), so no caller-held object reference reaches the seam.
function buildRecordAuditEventArgs(
  event: PersistableAuthRlsAuditEvent,
): SolmindRecordAuditEventArgs | null {
  let spec: PersistableEventRowSpec | null = null;
  for (const candidate of PERSISTABLE_EVENT_ROW_SPECS) {
    if (
      candidate.eventType === event.eventType &&
      candidate.action === event.action
    ) {
      spec = candidate;
      break;
    }
  }
  if (spec === null) {
    return null;
  }
  if (event.actorRoleContext !== spec.actorRoleContext) {
    return null;
  }
  if (spec.actorRequired) {
    if (!isNonEmptyString(event.actorUserAccountId)) {
      return null;
    }
  } else if (event.actorUserAccountId !== null) {
    return null;
  }
  if (event.targetEntityType !== AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE) {
    return null;
  }
  if (event.reasonCode !== spec.reasonCode) {
    return null;
  }
  if (!metadataMatchesExactly(event.metadata, spec.metadata)) {
    return null;
  }
  return {
    p_event_type: spec.eventType,
    p_action: spec.action,
    p_actor_role_context: spec.actorRoleContext,
    p_actor_user_account_id: event.actorUserAccountId,
    p_target_entity_type: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
    p_target_entity_id: null,
    p_reason_code: spec.reasonCode,
    p_metadata: { ...spec.metadata },
  };
}

// --- The writer (fail-closed sentinel handling) ---

// Value-free sentinel for an event the closed mapping refuses (including the
// AUTH-RLS-DEC-029 null-actor guarded-read defense). It carries nothing from the
// event, mirroring the seam sentinels.
export const AUDIT_EVENT_UNMAPPABLE_ERROR = "solmind_audit_event_unmappable";

export type AuditEventPersistError =
  | typeof AUDIT_EVENT_UNMAPPABLE_ERROR
  | AuditEventWriteError;

// The persist result: either the persisted row id, or a value-free sentinel that
// the AUD-3 wiring maps to the contracted per-class posture (deny for fail-closed
// classes; swallow plus bounded operational signal for best-effort classes; Doc 22
// Section 10). The writer itself never throws and never decides the posture.
export type AuditEventPersistResult =
  | { persisted: true; auditEventId: string }
  | { persisted: false; error: AuditEventPersistError };

export type AuthRlsAuditEventWriter = {
  persistAuthRlsAuditEvent(
    event: PersistableAuthRlsAuditEvent,
  ): Promise<AuditEventPersistResult>;
};

// Construct the writer over an injected closed-allowlist write executor. The AUD-3
// slice assembles the real chain (createServiceRoleClient() ->
// createAuditEventWriteExecutor -> this writer) at the production composition root;
// tests inject a deterministic executor double (no network, DB, or env).
export function createAuthRlsAuditEventWriter(deps: {
  executor: AuditEventWriteExecutor;
}): AuthRlsAuditEventWriter {
  return {
    async persistAuthRlsAuditEvent(
      event: PersistableAuthRlsAuditEvent,
    ): Promise<AuditEventPersistResult> {
      const args = buildRecordAuditEventArgs(event);
      if (args === null) {
        // Fail closed with NO RPC call: the event does not exactly match an
        // approved row (null-actor guarded read, tampered shape, or unknown pair).
        return { persisted: false, error: AUDIT_EVENT_UNMAPPABLE_ERROR };
      }
      try {
        const result = await deps.executor.write({
          intent: RECORD_AUDIT_EVENT_INTENT,
          args,
        });
        if (result.error !== null) {
          // Pass the seam's value-free sentinel through unchanged; no detail is
          // added and none exists to add.
          return { persisted: false, error: result.error };
        }
        return { persisted: true, auditEventId: result.auditEventId };
      } catch {
        // A throwing executor is a transport failure: resolve (never reject) to
        // the value-free failed sentinel so the writer cannot produce an
        // unhandled rejection or leak the underlying error.
        return { persisted: false, error: AUDIT_WRITE_FAILED_ERROR };
      }
    },
  };
}
