-- SolMind MVP0 AUD-1 - audit event database writer foundation.
-- Source contract: execution/22_SolMind_MVP0_Auth_RLS_Audit_Persistence_Contract_v0_1.md (Sections 7, 9, 12, 13).
-- Banked decision: AUTH-RLS-DEC-028 (narrow write transport for audit persistence; approved 2026-07-07).
-- Depends on: 20260613001000_identity_core_schema.sql (audit.audit_event).
-- Scope:
--   - create the single enumerated, insert-only, fully validated audit write function:
--       public.solmind_record_audit_event(text, text, text, uuid, text, uuid, text, jsonb)
--   - bake the AUD-1 Auth/RLS boundary vocabulary ONLY: three event types across four
--     approved (event_type, action) pairs, each fixing its required actor_role_context,
--     required actor presence (admin-context pairs require a non-null, FK-valid actor;
--     system-context pairs require a NULL actor - never a sentinel or synthetic id, so
--     no unattributable event can be falsely attributed to a human), required
--     reason_code, per-event metadata key allowlist, and in-function-derived
--     event_summary; for admin_route_access_decision the metadata decision value must
--     equal the validated action, so a row can never say allow in action/reason/summary
--     while its metadata says deny, or vice versa;
--   - fail closed on everything else with fixed, value-free error identifiers (no
--     caller input is ever echoed in an error message);
--   - apply least-privilege EXECUTE: revoke from PUBLIC, anon, and authenticated;
--     grant to service_role only, all in this same migration.
-- This migration creates one privileged write function. It creates no tables, no RLS
-- policies, no table or schema grants, no users, no seed or pilot data, and no Data API
-- schema-exposure change (identity/core/audit stay hidden; exposed schemas remain
-- public, graphql_public). The app-side writer, seam wiring, and async sink evolution
-- are later, separately approved slices (AUD-2, AUD-3); nothing calls this function yet
-- and the app audit seam stays default-off / no-op.
-- Deliberately excluded from the baked vocabulary for now: admin_sensitive_access (its
-- required reason_code values and exact target_entity_type tokens are not fully defined
-- yet; it belongs to a later Admin sensitive-access slice), all login/provisioning
-- events, all safety/escalation events, and all AI/content lifecycle events. Unknown
-- event types fail closed. ip_address and user_agent are structurally absent: no
-- parameter exists for them, so capture is impossible until a privacy review approves
-- a new Paul-gated slice.

create function public.solmind_record_audit_event(
  p_event_type text,
  p_action text,
  p_actor_role_context text,
  p_actor_user_account_id uuid default null,
  p_target_entity_type text default null,
  p_target_entity_id uuid default null,
  p_reason_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  audit_event_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_expected_role_context text;
  v_actor_required boolean;
  v_expected_reason_code text;
  v_event_summary text;
  v_allowed_metadata_keys text[];
  v_key text;
begin
  -- Baked AUD-1 (event_type, action) allowlist. Each approved pair fixes the required
  -- actor role context, the required actor presence, the required reason code, the
  -- derived event summary, and the per-event metadata key allowlist. Any other event,
  -- action, or pair fails closed.
  if p_event_type = 'admin_route_access_decision' and p_action = 'allow' then
    v_expected_role_context := 'admin';
    v_actor_required := true;
    v_expected_reason_code := 'access_granted';
    v_event_summary := 'Admin route access allowed.';
    v_allowed_metadata_keys := array['routeId', 'decision'];
  elsif p_event_type = 'admin_route_access_decision' and p_action = 'deny' then
    v_expected_role_context := 'system';
    v_actor_required := false;
    v_expected_reason_code := 'access_denied';
    v_event_summary := 'Admin route access denied.';
    v_allowed_metadata_keys := array['routeId', 'decision'];
  elsif p_event_type = 'guarded_service_role_read' and p_action = 'read' then
    v_expected_role_context := 'admin';
    v_actor_required := true;
    v_expected_reason_code := 'guarded_read';
    v_event_summary := 'Guarded service-role read at the admin boundary.';
    v_allowed_metadata_keys := array['routeId'];
  elsif p_event_type = 'auth_resolution_failure' and p_action = 'deny' then
    v_expected_role_context := 'system';
    v_actor_required := false;
    v_expected_reason_code := 'auth_unresolved';
    v_event_summary := 'Auth resolution failed at the admin boundary.';
    v_allowed_metadata_keys := array[]::text[];
  else
    raise exception 'solmind_audit_unknown_event_action';
  end if;

  -- The actor role context is fixed per approved pair; an unknown value and a
  -- table-valid-but-wrong value fail identically.
  if p_actor_role_context is distinct from v_expected_role_context then
    raise exception 'solmind_audit_invalid_role_context';
  end if;

  -- Actor presence is fixed per approved pair. Admin-context pairs record an audited
  -- human actor, so the actor id is required (its existence is enforced by the FK on
  -- insert). System-context pairs mean no human actor could be safely attributed, so
  -- the actor id must be NULL: attaching any account id there would create false
  -- attribution, and no sentinel or synthetic "unknown user" id exists.
  if v_actor_required and p_actor_user_account_id is null then
    raise exception 'solmind_audit_actor_required';
  end if;

  if not v_actor_required and p_actor_user_account_id is not null then
    raise exception 'solmind_audit_actor_not_allowed';
  end if;

  -- The target allowlist is per-event-type. All three AUD-1 event types require
  -- exactly target_entity_type = 'admin_route' with a null target_entity_id.
  if p_target_entity_type is distinct from 'admin_route' then
    raise exception 'solmind_audit_invalid_target_entity_type';
  end if;

  if p_target_entity_id is not null then
    raise exception 'solmind_audit_invalid_target_entity_id';
  end if;

  -- The reason code is required and fixed per approved pair; missing, unknown, and
  -- mismatched values fail identically.
  if p_reason_code is distinct from v_expected_reason_code then
    raise exception 'solmind_audit_invalid_reason_code';
  end if;

  -- Metadata: a single-level JSON object only, within the serialized size cap, with
  -- keys from the per-event allowlist and each value a bounded enumerated string.
  -- Nested objects, arrays, unknown keys, and out-of-vocabulary values fail closed.
  if p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'solmind_audit_metadata_not_object';
  end if;

  if pg_catalog.length(p_metadata::text) > 1024 then
    raise exception 'solmind_audit_metadata_oversized';
  end if;

  for v_key in
    select k.key_name
      from pg_catalog.jsonb_object_keys(p_metadata) as k(key_name)
  loop
    if not (v_key = any (v_allowed_metadata_keys)) then
      raise exception 'solmind_audit_metadata_unknown_key';
    end if;

    if pg_catalog.jsonb_typeof(p_metadata -> v_key) <> 'string' then
      raise exception 'solmind_audit_metadata_invalid_value';
    end if;

    if v_key = 'routeId' and (p_metadata ->> v_key) <> 'admin_route' then
      raise exception 'solmind_audit_metadata_invalid_value';
    end if;

    -- The decision metadata value must equal the validated action (the 'decision'
    -- key is only allowlisted for admin_route_access_decision, whose actions are
    -- exactly allow/deny), so a row can never carry an allow action with a deny
    -- metadata decision or vice versa.
    if v_key = 'decision' and (p_metadata ->> v_key) <> p_action then
      raise exception 'solmind_audit_metadata_invalid_value';
    end if;
  end loop;

  -- Exactly one INSERT into audit.audit_event and no other write anywhere.
  -- event_summary is derived above from the validated pair and is never
  -- caller-supplied; created_at comes from the table default; ip_address and
  -- user_agent stay null (no parameter exists for them). A non-existent
  -- p_actor_user_account_id fails the FK here and inserts nothing. There is no
  -- EXCEPTION handler anywhere in this function: every failure propagates to the
  -- caller so the app seam can apply the contracted write-failure posture.
  return query
  insert into audit.audit_event (
    event_type,
    actor_user_account_id,
    actor_role_context,
    target_entity_type,
    target_entity_id,
    action,
    reason_code,
    event_summary,
    metadata
  )
  values (
    p_event_type,
    p_actor_user_account_id,
    p_actor_role_context,
    p_target_entity_type,
    p_target_entity_id,
    p_action,
    p_reason_code,
    v_event_summary,
    p_metadata
  )
  returning audit_event.audit_event_id;
end;
$$;

revoke all on function public.solmind_record_audit_event(text, text, text, uuid, text, uuid, text, jsonb) from public;
revoke execute on function public.solmind_record_audit_event(text, text, text, uuid, text, uuid, text, jsonb) from anon, authenticated;
grant execute on function public.solmind_record_audit_event(text, text, text, uuid, text, uuid, text, jsonb) to service_role;

comment on function public.solmind_record_audit_event(text, text, text, uuid, text, uuid, text, jsonb) is
  'Privileged server-only audit event writer (AUTH-RLS-DEC-028; AUD-1). Inserts exactly one validated, bounded row into audit.audit_event as owner (deliberate non-forced-RLS bypass; the table keeps RLS enabled with zero policies and zero grants); EXECUTE granted to service_role only; decides no authorization, which stays in the app guard layer. Bakes the AUD-1 Auth/RLS boundary vocabulary only and fails closed with fixed, value-free error identifiers on any unknown event, action, pair, role context, actor-presence violation, target, reason code, or metadata shape. Admin-context pairs require a non-null FK-valid actor; system-context pairs require a NULL actor (no sentinel or synthetic id), preventing false attribution; the metadata decision value must equal the validated action for admin_route_access_decision. event_summary is derived in-function; created_at comes from the table default; ip_address/user_agent are structurally absent. Insert-only: no UPDATE or DELETE exists and no other table is touched. Applying FORCE ROW LEVEL SECURITY to audit.audit_event would silently break this function and requires a new AUTH-RLS decision first.';
