// SolMind MVP0 server-only audit event write seam (AUD-2 closed-allowlist write executor).
//
// Purpose:
//   - implement the narrow, closed-allowlist WRITE seam over the banked AUD-1 audit
//     writer function public.solmind_record_audit_event (AUTH-RLS-DEC-028; audit
//     persistence contract Doc 22 Sections 7 and 11). Exactly ONE write intent exists
//     and it dispatches to exactly ONE enumerated SECURITY DEFINER function via the
//     server-only service-role client's .rpc(). There is no generic write capability,
//     no second intent, no other function, and no other table reachable from this seam.
//   - mirror the banked read-side transport pattern (serviceRoleRpcExecutor.ts): a
//     closed allowlist, named-argument dispatch, and detail-free fail-closed sentinels
//     (AUTH-RLS-DEC-026 pattern, extended to the narrow write scope by AUTH-RLS-DEC-028).
//
// Server-only boundary (critical):
//   - The service-role key BYPASSES RLS and the audit writer function is
//     service_role-only, so this module must never run in the browser. The
//     `import "server-only";` marker is the import-time guard (AUTH-RLS-DEC-023),
//     backed by the runtime browser guard below, and this module stays OFF the shared
//     src/lib/solmind/supabase/index.ts barrel (AUTH-RLS-DEC-007). It is imported only
//     from explicit server composition paths (the AUD-2 writer; the AUD-3 slice later
//     assembles createServiceRoleClient() -> this executor -> the writer at the
//     production composition root).
//
// Scope discipline (AUD-2; no production wiring):
//   - This module is NOT wired into any route or production composition. Nothing
//     constructs it at runtime, the audit seam stays default-off / no-op, and nothing
//     is persisted until the separately Paul-gated AUD-3 wiring slice.
//   - This executor WRITES exactly one validated audit row per call and decides
//     nothing. The event vocabulary is validated by the writer (auditEventWriter.ts)
//     and re-validated independently inside the database function (two-layer
//     enforcement, Doc 22 Section 9.3); this seam validates only the intent, the named
//     argument shape, and the exact RPC result.
//
// Fail-closed result contract (M2 guard -- deliberately STRICTER than the read seam):
//   - The read executor treats an empty array as a reachable "no rows" result. A WRITE
//     that returns zero rows is a failed or not-performed insert, never a success, so
//     that behavior is NOT mirrored here. The banked function returns exactly one row
//     ({ audit_event_id }) on success, and this seam requires EXACTLY one returned row
//     whose audit_event_id is a non-empty string.
//   - Everything else fails closed to a value-free sentinel: an unknown intent, a
//     missing / extra / wrongly-typed named argument (no .rpc() call is made), an
//     .rpc() error, a thrown .rpc(), a non-array payload, zero rows, multiple rows, or
//     a malformed row. No error body, URL, argument echo, or credential ever leaves
//     this seam.

import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: auditEventWriteExecutor must not be imported in browser code.",
  );
}

// Detail-free sentinel errors. They carry no dynamic value from the intent, the
// arguments, or the underlying failure, so a connection string, key, argument, or
// error body can never leak through the returned error. The caller (the AUD-2 writer,
// and the AUD-3 wiring after it) applies the contracted per-class write-failure
// posture (Doc 22 Section 10) to any non-null error.
export const AUDIT_WRITE_UNMAPPED_INTENT_ERROR =
  "solmind_audit_write_unmapped_intent";
export const AUDIT_WRITE_FAILED_ERROR = "solmind_audit_write_failed";

export type AuditEventWriteError =
  | typeof AUDIT_WRITE_UNMAPPED_INTENT_ERROR
  | typeof AUDIT_WRITE_FAILED_ERROR;

// The single approved write intent and the single enumerated function it maps to.
// The allowlist is closed: there is deliberately no other intent and no other
// function, so every unrecognized intent fails closed without touching .rpc().
export const RECORD_AUDIT_EVENT_INTENT = "record_audit_event";

const RECORD_AUDIT_EVENT_FUNCTION = "solmind_record_audit_event";

// The exact named arguments of public.solmind_record_audit_event (AUD-1 migration
// 20260708000000_audit_event_writer_function.sql). Every parameter is passed
// explicitly -- including the null actor id for system-context events, the always-null
// target id, and the metadata object -- so the dispatched call is fully deterministic
// and never relies on SQL parameter defaults. p_metadata is never null: system events
// with no metadata send an empty object (the function's own default shape), because a
// SQL null metadata would fail the function's not-object check.
export type SolmindRecordAuditEventArgs = {
  p_event_type: string;
  p_action: string;
  p_actor_role_context: string;
  p_actor_user_account_id: string | null;
  p_target_entity_type: string;
  p_target_entity_id: null;
  p_reason_code: string;
  p_metadata: Record<string, string>;
};

export type AuditEventWriteIntent = {
  intent: typeof RECORD_AUDIT_EVENT_INTENT;
  args: SolmindRecordAuditEventArgs;
};

// The write result: either the persisted row id, or a value-free sentinel. The two
// arms are discriminated by `error`, mirroring the read seam's result shape.
export type AuditEventWriteResult =
  | { auditEventId: string; error: null }
  | { auditEventId: null; error: AuditEventWriteError };

export type AuditEventWriteExecutor = {
  write(intent: AuditEventWriteIntent): Promise<AuditEventWriteResult>;
};

// The exact named-argument key set the enumerated function accepts. Used to reject
// any intent whose argument object is missing a parameter, carries an extra one, or
// was forged past the compile-time types (TypeScript types are erased at runtime).
const REQUIRED_ARG_KEYS: readonly string[] = [
  "p_event_type",
  "p_action",
  "p_actor_role_context",
  "p_actor_user_account_id",
  "p_target_entity_type",
  "p_target_entity_id",
  "p_reason_code",
  "p_metadata",
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Runtime defense-in-depth behind the writer's own closed mapping: the key set must
// be exactly the eight named parameters, every required text argument a non-empty
// string, the actor id a non-empty string or null, the target id null (no AUD-1 pair
// carries one), and the metadata a single-level object of string values. Anything
// else fails the intent closed BEFORE any .rpc() call (missing-argument guard).
function isValidRecordAuditEventArgs(
  value: unknown,
): value is SolmindRecordAuditEventArgs {
  if (!isPlainObject(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  const expected = [...REQUIRED_ARG_KEYS].sort();
  if (keys.length !== expected.length) {
    return false;
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (keys[index] !== expected[index]) {
      return false;
    }
  }
  if (!isNonEmptyString(value.p_event_type)) {
    return false;
  }
  if (!isNonEmptyString(value.p_action)) {
    return false;
  }
  if (!isNonEmptyString(value.p_actor_role_context)) {
    return false;
  }
  if (
    value.p_actor_user_account_id !== null &&
    !isNonEmptyString(value.p_actor_user_account_id)
  ) {
    return false;
  }
  if (!isNonEmptyString(value.p_target_entity_type)) {
    return false;
  }
  if (value.p_target_entity_id !== null) {
    return false;
  }
  if (!isNonEmptyString(value.p_reason_code)) {
    return false;
  }
  if (!isPlainObject(value.p_metadata)) {
    return false;
  }
  for (const metadataValue of Object.values(value.p_metadata)) {
    if (typeof metadataValue !== "string") {
      return false;
    }
  }
  return true;
}

// Adapt a server-only service-role Supabase client to the narrow audit write seam by
// dispatching the single approved intent to public.solmind_record_audit_event. The
// client's default `public` profile is used (createServiceRoleClient sets no
// db.schema), which is where the function lives. Fails closed on any unknown intent,
// invalid argument shape, .rpc() error, thrown .rpc(), or non-single-row result.
export function createAuditEventWriteExecutor(
  client: SupabaseClient,
): AuditEventWriteExecutor {
  return {
    async write(intent: AuditEventWriteIntent): Promise<AuditEventWriteResult> {
      // Closed allowlist: exactly one intent maps to exactly one enumerated
      // function. An unknown or malformed intent fails closed without any .rpc().
      if (!isPlainObject(intent) || intent.intent !== RECORD_AUDIT_EVENT_INTENT) {
        return { auditEventId: null, error: AUDIT_WRITE_UNMAPPED_INTENT_ERROR };
      }
      if (!isValidRecordAuditEventArgs(intent.args)) {
        return { auditEventId: null, error: AUDIT_WRITE_UNMAPPED_INTENT_ERROR };
      }

      try {
        const { data, error } = await client.rpc(
          RECORD_AUDIT_EVENT_FUNCTION,
          intent.args,
        );
        if (error !== null && error !== undefined) {
          // Swallow the underlying error; return only a value-free sentinel so no
          // URL, key, argument echo, or error body can leak.
          return { auditEventId: null, error: AUDIT_WRITE_FAILED_ERROR };
        }
        // M2 guard: exactly ONE returned row is the only success. Zero rows,
        // multiple rows, a non-array payload, and a malformed row all fail closed.
        // An empty array is NOT the reachable "no rows" success it is on the read
        // path: for a write it means the insert did not happen.
        if (!Array.isArray(data) || data.length !== 1) {
          return { auditEventId: null, error: AUDIT_WRITE_FAILED_ERROR };
        }
        const row: unknown = data[0];
        if (!isPlainObject(row) || !isNonEmptyString(row.audit_event_id)) {
          return { auditEventId: null, error: AUDIT_WRITE_FAILED_ERROR };
        }
        return { auditEventId: row.audit_event_id, error: null };
      } catch {
        return { auditEventId: null, error: AUDIT_WRITE_FAILED_ERROR };
      }
    },
  };
}
