-- SolMind MVP0 AUD-1 pgTAP: audit writer positive path, validation negatives, and
-- no-unintended-write proof.
-- Source contract: execution/22_SolMind_MVP0_Auth_RLS_Audit_Persistence_Contract_v0_1.md (Section 12 family 2).
-- Banked decision: AUTH-RLS-DEC-028.
-- Run with: supabase test db  (local stack only; never cloud).
--
-- Scope of THIS file:
--   - seed one synthetic, local-ephemeral actor account (never real or pilot data)
--     and prove each of the four approved AUD-1 (event_type, action) pairs inserts
--     exactly one bounded audit.audit_event row with the in-function-derived
--     event_summary, the table-default created_at, and null ip_address/user_agent;
--   - prove service_role can execute the writer end-to-end (the sanctioned transport);
--   - prove every contracted validation negative fails closed with its fixed,
--     value-free error identifier and inserts nothing: unknown/mismatched
--     event/action, wrong or unknown actor_role_context, actor-presence violations
--     (a null actor on an admin-context pair; a non-null actor on a system-context
--     pair - system events must never be attributed to a human account),
--     unknown/missing target, non-null target_entity_id, unknown/missing/mismatched
--     reason_code, and every prohibited metadata shape (unknown key, non-object,
--     jsonb null, SQL null, array, nested object, out-of-vocabulary value, a
--     decision value contradicting the validated action, oversized serialization);
--   - prove sentinel sensitive strings passed through the text inputs are never
--     echoed: every raised message is asserted EXACTLY equal to its fixed
--     identifier, so no caller value can appear in it;
--   - prove a non-existent actor_user_account_id fails the FK and inserts nothing;
--   - prove the function writes ONLY audit.audit_event: a before/after row-count
--     sweep over every other SolMind table (identity, core, audit, scheduling, ai,
--     content, notification) is identical, with a minimum-table-count guard so the
--     sweep cannot pass vacuously.
--
-- Rollback-safe: everything runs inside a transaction that ROLLS BACK, so no seeded
-- or written row persists. It adds no migration, function, policy, or grant. The
-- synthetic ids below are fixed, obviously-synthetic literals, not real accounts.

begin;

select plan(61);

-- --- Fixture: one synthetic active account for the allow-path actor FK ----------------------

insert into identity.user_account (user_account_id, display_name, account_status)
values ('33333333-3333-3333-3333-333333333333', 'AUD1 Synthetic Admin', 'active');

-- --- Before snapshot for the no-unintended-write proof (excludes audit.audit_event) ---------

create temp table solmind_row_counts_before as
select n.nspname as schema_name,
       c.relname as table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname),
                           false, true, '')))[1]::text::bigint as row_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where c.relkind = 'r'
   and n.nspname in ('identity', 'core', 'audit', 'scheduling', 'ai', 'content', 'notification')
   and not (n.nspname = 'audit' and c.relname = 'audit_event');

-- --- Positive path: admin_route_access_decision + allow --------------------------------------

select is(
  (select count(*)::int from audit.audit_event),
  0,
  'audit.audit_event starts empty (no seed or pilot audit rows)'
);

create temp table aud1_allow as
select r.audit_event_id
  from public.solmind_record_audit_event(
    'admin_route_access_decision',
    'allow',
    'admin',
    '33333333-3333-3333-3333-333333333333'::uuid,
    'admin_route',
    null,
    'access_granted',
    '{"routeId": "admin_route", "decision": "allow"}'::jsonb
  ) as r;

select is(
  (select count(*)::int from aud1_allow),
  1,
  'a valid allow call returns exactly one audit_event_id'
);

select is(
  (select count(*)::int from audit.audit_event),
  1,
  'a valid allow call inserts exactly one audit.audit_event row'
);

select is(
  (select count(*)::int
     from audit.audit_event e
     join aud1_allow r using (audit_event_id)),
  1,
  'the returned audit_event_id matches the inserted row'
);

select is(
  (select e.event_type from audit.audit_event e join aud1_allow r using (audit_event_id)),
  'admin_route_access_decision',
  'the allow row carries the validated event_type'
);

select is(
  (select e.action from audit.audit_event e join aud1_allow r using (audit_event_id)),
  'allow',
  'the allow row carries the validated action'
);

select is(
  (select e.actor_role_context from audit.audit_event e join aud1_allow r using (audit_event_id)),
  'admin',
  'the allow row carries the admin actor role context'
);

select is(
  (select e.actor_user_account_id from audit.audit_event e join aud1_allow r using (audit_event_id)),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'the allow row carries the server-derived actor account id'
);

select ok(
  (select e.target_entity_type = 'admin_route' and e.target_entity_id is null
     from audit.audit_event e join aud1_allow r using (audit_event_id)),
  'the allow row targets admin_route with a null target_entity_id'
);

select is(
  (select e.reason_code from audit.audit_event e join aud1_allow r using (audit_event_id)),
  'access_granted',
  'the allow row carries the required access_granted reason code'
);

select is(
  (select e.event_summary from audit.audit_event e join aud1_allow r using (audit_event_id)),
  'Admin route access allowed.',
  'event_summary is derived in-function from the validated pair (no such parameter exists)'
);

select ok(
  (select e.metadata = '{"routeId": "admin_route", "decision": "allow"}'::jsonb
     from audit.audit_event e join aud1_allow r using (audit_event_id)),
  'the allow row carries exactly the banked routeId/decision metadata (app key casing preserved)'
);

select ok(
  (select e.ip_address is null and e.user_agent is null
     from audit.audit_event e join aud1_allow r using (audit_event_id)),
  'ip_address and user_agent stay null (structurally absent from the function)'
);

select ok(
  (select e.created_at = now()
     from audit.audit_event e join aud1_allow r using (audit_event_id)),
  'created_at comes from the table default (transaction now(); no caller timestamp exists)'
);

-- --- Positive path: admin_route_access_decision + deny (opaque; system context) --------------

create temp table aud1_deny as
select r.audit_event_id
  from public.solmind_record_audit_event(
    'admin_route_access_decision',
    'deny',
    'system',
    null,
    'admin_route',
    null,
    'access_denied',
    '{"routeId": "admin_route", "decision": "deny"}'::jsonb
  ) as r;

select is(
  (select count(*)::int from aud1_deny),
  1,
  'a valid deny call returns exactly one audit_event_id'
);

select ok(
  (select e.actor_user_account_id is null
      and e.actor_role_context = 'system'
      and e.reason_code = 'access_denied'
     from audit.audit_event e join aud1_deny r using (audit_event_id)),
  'the deny row is opaque: system role context, null actor, access_denied reason'
);

select is(
  (select e.event_summary from audit.audit_event e join aud1_deny r using (audit_event_id)),
  'Admin route access denied.',
  'the deny row derives the fixed deny summary in-function'
);

-- --- Positive path: guarded_service_role_read + read ------------------------------------------

create temp table aud1_read as
select r.audit_event_id
  from public.solmind_record_audit_event(
    'guarded_service_role_read',
    'read',
    'admin',
    '33333333-3333-3333-3333-333333333333'::uuid,
    'admin_route',
    null,
    'guarded_read',
    '{"routeId": "admin_route"}'::jsonb
  ) as r;

select is(
  (select count(*)::int from aud1_read),
  1,
  'a valid guarded-read call returns exactly one audit_event_id'
);

select ok(
  (select e.event_summary = 'Guarded service-role read at the admin boundary.'
      and e.reason_code = 'guarded_read'
      and e.metadata = '{"routeId": "admin_route"}'::jsonb
     from audit.audit_event e join aud1_read r using (audit_event_id)),
  'the guarded-read row derives its fixed summary and carries only the routeId metadata key'
);

select ok(
  (select e.actor_role_context = 'admin'
      and e.actor_user_account_id = '33333333-3333-3333-3333-333333333333'::uuid
     from audit.audit_event e join aud1_read r using (audit_event_id)),
  'the guarded-read row carries the required server-resolved actor id under the admin role context'
);

-- --- Positive path: auth_resolution_failure + deny (metadata omitted; defaults to {}) --------

create temp table aud1_fail as
select r.audit_event_id
  from public.solmind_record_audit_event(
    'auth_resolution_failure',
    'deny',
    'system',
    null,
    'admin_route',
    null,
    'auth_unresolved'
  ) as r;

select is(
  (select count(*)::int from aud1_fail),
  1,
  'a valid auth-resolution-failure call returns exactly one audit_event_id'
);

select ok(
  (select e.event_summary = 'Auth resolution failed at the admin boundary.'
      and e.reason_code = 'auth_unresolved'
      and e.metadata = '{}'::jsonb
     from audit.audit_event e join aud1_fail r using (audit_event_id)),
  'the failure row derives its fixed summary and the omitted metadata defaults to the empty object'
);

-- --- service_role end-to-end execution (the sanctioned transport) ----------------------------

set local role service_role;

select is(
  (select count(*)::int
     from public.solmind_record_audit_event(
       'admin_route_access_decision',
       'deny',
       'system',
       null,
       'admin_route',
       null,
       'access_denied',
       '{"routeId": "admin_route", "decision": "deny"}'::jsonb
     )),
  1,
  'service_role can execute the writer end-to-end and receives exactly one audit_event_id'
);

reset role;

select is(
  (select count(*)::int from audit.audit_event),
  5,
  'exactly the five positive-path rows exist before the negative-path probes'
);

-- --- Validation negatives: every probe raises a fixed, value-free identifier ------------------
-- The message is asserted EXACTLY, so no probe can echo caller input.

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_sensitive_access', 'view', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_unknown_event_action',
  'admin_sensitive_access is named but excluded from AUD-1 and fails closed (later Admin sensitive-access slice)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('bogus_event', 'allow', 'admin', null, 'admin_route', null, 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_unknown_event_action',
  'an unknown event_type fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'export', 'admin', null, 'admin_route', null, 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_unknown_event_action',
  'an unknown action fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('guarded_service_role_read', 'allow', 'admin', null, 'admin_route', null, 'guarded_read', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_unknown_event_action',
  'a mismatched event_type/action pair fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'bogus_role', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_role_context',
  'an unknown actor_role_context fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'guide', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_role_context',
  'guide is table-valid but never valid for an AUD-1 event and fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'deny', 'admin', null, 'admin_route', null, 'access_denied', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_role_context',
  'the wrong actor_role_context for the pair fails closed (a deny must carry system, not admin)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', null, 'admin_route', null, 'access_granted', '{"routeId": "admin_route", "decision": "allow"}'::jsonb)$$,
  'P0001',
  'solmind_audit_actor_required',
  'an allow with a null actor_user_account_id fails closed (admin-context pairs require the audited actor)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('guarded_service_role_read', 'read', 'admin', null, 'admin_route', null, 'guarded_read', '{"routeId": "admin_route"}'::jsonb)$$,
  'P0001',
  'solmind_audit_actor_required',
  'a guarded read with a null actor_user_account_id fails closed (admin-context pairs require the audited actor)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'deny', 'system', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_denied', '{"routeId": "admin_route", "decision": "deny"}'::jsonb)$$,
  'P0001',
  'solmind_audit_actor_not_allowed',
  'a deny with a non-null actor_user_account_id fails closed (system events must never attribute a human account)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('auth_resolution_failure', 'deny', 'system', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'auth_unresolved', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_actor_not_allowed',
  'an auth-resolution failure with a non-null actor_user_account_id fails closed (no false attribution)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'user_account', null, 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_target_entity_type',
  'an unknown target_entity_type fails closed (the allowlist is per-event-type)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, null, null, 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_target_entity_type',
  'a missing target_entity_type fails closed when the event requires one'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', gen_random_uuid(), 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_target_entity_id',
  'a non-null target_entity_id fails closed for every AUD-1 event type'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'bogus_reason', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_reason_code',
  'an unknown reason_code fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, null, '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_reason_code',
  'a missing reason_code fails closed (reason codes are required for AUD-1 events)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_denied', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_reason_code',
  'a mismatched reason_code for the pair fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{"routeId": "admin_route", "decision": "allow", "extra": "x"}'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_unknown_key',
  'an unknown metadata key fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '"not-an-object"'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_not_object',
  'non-object metadata (a jsonb string) fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', 'null'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_not_object',
  'jsonb null metadata fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', null::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_not_object',
  'an explicit SQL NULL metadata fails closed rather than silently defaulting'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '[]'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_not_object',
  'top-level array metadata fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{"routeId": {"nested": true}, "decision": "allow"}'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_invalid_value',
  'a nested metadata object fails closed (single-level objects only)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{"routeId": ["admin_route"], "decision": "allow"}'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_invalid_value',
  'an array metadata value fails closed (no AUD-1 key allows arrays)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{"routeId": "admin_route", "decision": "maybe"}'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_invalid_value',
  'an out-of-vocabulary metadata value fails closed'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{"routeId": "admin_route", "decision": "deny"}'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_invalid_value',
  'an allow action with a deny metadata decision fails closed (the decision must equal the validated action)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'deny', 'system', null, 'admin_route', null, 'access_denied', '{"routeId": "admin_route", "decision": "allow"}'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_invalid_value',
  'a deny action with an allow metadata decision fails closed (the decision must equal the validated action)'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', jsonb_build_object('routeId', repeat('x', 1100)))$$,
  'P0001',
  'solmind_audit_metadata_oversized',
  'metadata over the 1024-character serialized cap fails closed'
);

-- Sentinel non-leak proofs: each message is asserted EXACTLY equal to its fixed
-- identifier, so the sentinel string cannot appear anywhere in it.

select throws_ok(
  $$select * from public.solmind_record_audit_event('SOLMIND_SENTINEL_SECRET_9f3a_DO_NOT_ECHO', 'allow', 'admin', null, 'admin_route', null, 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_unknown_event_action',
  'a sentinel sensitive string passed as event_type is never echoed in the raised error'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'SOLMIND_SENTINEL_SECRET_9f3a_DO_NOT_ECHO', null, 'access_granted', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_target_entity_type',
  'a sentinel sensitive string passed as target_entity_type is never echoed in the raised error'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'SOLMIND_SENTINEL_SECRET_9f3a_DO_NOT_ECHO', '{}'::jsonb)$$,
  'P0001',
  'solmind_audit_invalid_reason_code',
  'a sentinel sensitive string passed as reason_code is never echoed in the raised error'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{"SOLMIND_SENTINEL_SECRET_9f3a_DO_NOT_ECHO": "x"}'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_unknown_key',
  'a sentinel sensitive string passed as a metadata key is never echoed in the raised error'
);

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '33333333-3333-3333-3333-333333333333'::uuid, 'admin_route', null, 'access_granted', '{"routeId": "SOLMIND_SENTINEL_SECRET_9f3a_DO_NOT_ECHO", "decision": "allow"}'::jsonb)$$,
  'P0001',
  'solmind_audit_metadata_invalid_value',
  'a sentinel sensitive string passed as a metadata value is never echoed in the raised error'
);

-- A non-existent actor fails the FK (fixed constraint error class) and inserts nothing.

select throws_ok(
  $$select * from public.solmind_record_audit_event('admin_route_access_decision', 'allow', 'admin', '44444444-4444-4444-4444-444444444444'::uuid, 'admin_route', null, 'access_granted', '{"routeId": "admin_route", "decision": "allow"}'::jsonb)$$,
  '23503',
  null,
  'a non-existent actor_user_account_id fails the foreign key and fails closed'
);

select is(
  (select count(*)::int from audit.audit_event),
  5,
  'no negative-path probe inserted a row (including the failed foreign-key call)'
);

-- --- No-unintended-write proof: only audit.audit_event changed -------------------------------

select cmp_ok(
  (select count(*)::int from solmind_row_counts_before),
  '>=',
  20,
  'the no-unintended-write sweep covers the SolMind tables (guard against a vacuous diff)'
);

create temp table solmind_row_counts_after as
select n.nspname as schema_name,
       c.relname as table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname),
                           false, true, '')))[1]::text::bigint as row_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where c.relkind = 'r'
   and n.nspname in ('identity', 'core', 'audit', 'scheduling', 'ai', 'content', 'notification')
   and not (n.nspname = 'audit' and c.relname = 'audit_event');

select is(
  (select count(*)::int
     from ((table solmind_row_counts_before except table solmind_row_counts_after)
           union all
           (table solmind_row_counts_after except table solmind_row_counts_before)) as diff),
  0,
  'the writer writes only audit.audit_event: every other SolMind table row count is unchanged'
);

select * from finish();

rollback;
