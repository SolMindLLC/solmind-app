-- Early-test notice storage and service-role boundaries. Synthetic accounts
-- only, in a disposable database; every change rolls back. No provider call.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog, pg_temp;
set local statement_timeout = '120s';
select no_plan();

create function pg_temp.notice_id(n integer) returns uuid language sql immutable as $$
  select ('e0611000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
create function pg_temp.notice_switch(turn_on boolean, label text, revision bigint, operation integer)
returns text language sql as $$
  select outcome from public.solmind_set_explorer_early_test_notice_setting_v1(
    turn_on, label, revision, pg_temp.notice_id(operation),
    'paul_approved', pg_temp.notice_id(900), 'paul_approved_configuration_change')
$$;

select has_table('core', 'explorer_early_test_notice_setting', 'protected typed setting exists');
select has_table('identity', 'explorer_early_test_notice_agreement', 'private agreement table exists');
select ok(c.relrowsecurity and not c.relforcerowsecurity, n.nspname || '.' || c.relname || ' has owner-mediated RLS')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where (n.nspname, c.relname) in (
   ('core', 'explorer_early_test_notice_setting'), ('identity', 'explorer_early_test_notice_agreement'));
select is((select count(*)::integer from pg_policies where
  (schemaname, tablename) in (('core', 'explorer_early_test_notice_setting'),
    ('identity', 'explorer_early_test_notice_agreement'))), 0, 'neither table has an RLS policy');
select ok(not has_table_privilege(r.role_name, t.table_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
  r.role_name || ' has no direct access to ' || t.table_name)
  from unnest(array['anon', 'authenticated', 'service_role']) r(role_name)
  cross join unnest(array['core.explorer_early_test_notice_setting',
    'identity.explorer_early_test_notice_agreement']) t(table_name);
select is((select count(*)::integer from core.explorer_early_test_notice_setting), 1,
  'exactly one typed application-setting row exists');
select results_eq(
  $$select enabled, notice_version, version from public.solmind_read_explorer_early_test_notice_setting_v1()$$,
  $$values(false, 'early-test-notice-2026-11-06'::text, 1::bigint)$$,
  'setting is off by default at the approved version');
select is((select count(*)::integer from core.application_setting), 6,
  'the existing closed integer-setting family is unchanged');

select is(pg_get_function_arguments('public.solmind_read_explorer_early_test_notice_v1(uuid,uuid)'::regprocedure),
  'p_actor_user_account_id uuid, p_user_session_id uuid', 'status binds only the server-derived account and session');
select is(pg_get_function_result('public.solmind_read_explorer_early_test_notice_v1(uuid,uuid)'::regprocedure),
  'TABLE(enabled boolean, notice_version text, agreed boolean)', 'status returns no account, session, time or private content');
select is(pg_get_function_arguments('public.solmind_agree_explorer_early_test_notice_v1(uuid,uuid,text,boolean)'::regprocedure),
  'p_actor_user_account_id uuid, p_user_session_id uuid, p_notice_version text, p_adult_affirmation boolean',
  'agreement has the exact account/session/version/adult contract');
select is(pg_get_function_result('public.solmind_agree_explorer_early_test_notice_v1(uuid,uuid,text,boolean)'::regprocedure),
  'TABLE(enabled boolean, notice_version text, agreed boolean)', 'agreement returns only closed current status');
select is(pg_get_function_result('public.solmind_read_explorer_early_test_notice_setting_v1()'::regprocedure),
  'TABLE(enabled boolean, notice_version text, version bigint)', 'configuration reader returns only the protected switch');
select ok(p.prosecdef and pg_get_userbyid(p.proowner) = 'postgres' and 'search_path=""' = any(p.proconfig),
  p.proname || ' uses postgres ownership and an empty search path')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname in ('solmind_read_explorer_early_test_notice_setting_v1',
      'solmind_read_explorer_early_test_notice_v1', 'solmind_agree_explorer_early_test_notice_v1',
      'solmind_set_explorer_early_test_notice_setting_v1');
select ok(has_function_privilege('service_role', p.oid, 'EXECUTE')
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  p.proname || ' permits only service-role execution')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname in ('solmind_read_explorer_early_test_notice_setting_v1',
      'solmind_read_explorer_early_test_notice_v1', 'solmind_agree_explorer_early_test_notice_v1',
      'solmind_set_explorer_early_test_notice_setting_v1');
select ok(not has_function_privilege(r.role_name, p.oid, 'EXECUTE'),
  r.role_name || ' cannot call internal ' || p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join unnest(array['anon', 'authenticated', 'service_role']) r(role_name)
 where (n.nspname, p.proname) in (
   ('identity', 'solmind_guard_early_test_notice_agreement_v1'),
   ('identity', 'solmind_require_early_test_notice_explorer_v1'),
   ('audit', 'solmind_guard_early_test_notice_audit_v1'));
select ok(not has_table_privilege('service_role', 'audit.audit_event', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
  'service role gains no direct audit access');
select ok(exists (select 1 from pg_constraint
  where conrelid = 'identity.explorer_early_test_notice_agreement'::regclass
    and confrelid = 'identity.user_account'::regclass and contype = 'f' and confdeltype = 'c'),
  'agreement account reference cascades only when the account is deleted');
select ok(p.prosecdef and pg_get_userbyid(p.proowner) = 'postgres' and 'search_path=""' = any(p.proconfig),
  'agreement deletion guard sees account existence regardless of caller RLS')
  from pg_proc p where p.oid = 'identity.solmind_guard_early_test_notice_agreement_v1()'::regprocedure;
select is((select count(*)::integer from pg_trigger
  where tgrelid = 'audit.audit_event'::regclass
    and tgfoid = 'audit.solmind_guard_early_test_notice_audit_v1()'::regprocedure
    and (tgtype & 32) <> 0), 0, 'notice adds no truncate trigger to shared audit storage');

insert into identity.user_account (user_account_id, display_name, account_status)
select pg_temp.notice_id(n), 'Synthetic Notice Account ' || n,
  case when n = 5 then 'inactive' else 'active' end from generate_series(1, 10) n;
insert into identity.user_role_assignment (
  user_role_assignment_id, user_account_id, role_code, role_status, granted_at, revoked_at
)
select pg_temp.notice_id(20 + n), pg_temp.notice_id(n),
  case when n = 3 then 'guide' when n = 4 then 'admin' else 'explorer' end,
  case when n = 6 then 'revoked' when n = 9 then 'suspended' else 'active' end,
  case when n = 10 then now() + interval '1 hour' else now() - interval '1 hour' end,
  case when n = 6 then now() else null end from generate_series(1, 10) n;
insert into identity.user_role_assignment (user_role_assignment_id, user_account_id, role_code, role_status)
values (pg_temp.notice_id(38), pg_temp.notice_id(8), 'guide', 'active');
insert into identity.user_session (
  user_session_id, user_account_id, active_role_context, created_at, expires_at, session_status
)
select pg_temp.notice_id(40 + n), pg_temp.notice_id(n),
  case when n in (3, 8) then 'guide' when n = 4 then 'admin' else 'explorer' end,
  now() - interval '1 hour',
  case when n = 7 then now() - interval '1 minute' else now() + interval '1 hour' end,
  'active' from generate_series(1, 10) n;
-- Both another live device and an expired-but-unswept active row must leave
-- the exact presented valid session usable at the notice boundary.
-- Production already prevents this state with its unique active-session index.
-- Remove it only in this rolled-back fault fixture, then restore it below; no
-- migration or runtime authentication/session rule is changed by this test.
drop index identity.user_session_one_active_per_account_idx;
insert into identity.user_session (
  user_session_id, user_account_id, active_role_context, created_at, expires_at, session_status
) values
  (pg_temp.notice_id(62), pg_temp.notice_id(1), 'explorer',
    now() - interval '2 hours', now() - interval '1 hour', 'active'),
  (pg_temp.notice_id(63), pg_temp.notice_id(1), 'explorer',
    now() - interval '1 hour', now() + interval '1 hour', 'active');

set local role service_role;
select results_eq(
  $$select * from public.solmind_read_explorer_early_test_notice_v1(pg_temp.notice_id(1), pg_temp.notice_id(41))$$,
  $$values(false, 'early-test-notice-2026-11-06'::text, false)$$,
  'an authenticated Explorer sees the switch off with no agreement');
select throws_ok($$select * from identity.explorer_early_test_notice_agreement$$,
  '42501', null, 'service role cannot read agreements directly');
select throws_ok($$select * from core.explorer_early_test_notice_setting$$,
  '42501', null, 'service role cannot read the setting directly');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(41), 'early-test-notice-2026-11-06', true)$$,
  'P0001', 'solmind_early_test_notice_unavailable', 'agreement while the setting is off saves nothing');
select is(pg_temp.notice_switch(false, 'early-test-notice-2026-11-06', 1, 101),
  'unchanged', 'same-value setting request is writeless');
select is(pg_temp.notice_switch(true, 'early-test-notice-2026-11-06', 1, 102),
  'applied', 'authorized version-bound setting change enables the notice');
select is(pg_temp.notice_switch(true, 'early-test-notice-2026-11-06', 1, 102),
  'already_applied', 'exact setting replay is writeless');
select results_eq(
  $$select * from public.solmind_read_explorer_early_test_notice_v1(pg_temp.notice_id(1), pg_temp.notice_id(41))$$,
  $$values(true, 'early-test-notice-2026-11-06'::text, false)$$,
  'another live session and an unswept expired session do not block the presented valid session');
select throws_ok($$select * from public.solmind_read_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(62))$$,
  'P0001', 'solmind_early_test_notice_denied', 'the expired exact session remains denied despite another valid session');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(62), 'early-test-notice-2026-11-06', true)$$,
  'P0001', 'solmind_early_test_notice_denied', 'agreement cannot borrow expiry from another session');
select throws_ok($$select pg_temp.notice_switch(false, 'early-test-notice-2026-11-06', 1, 102)$$,
  'P0001', 'solmind_early_test_notice_operation_conflict', 'changed setting retry is refused');
select throws_ok($$select pg_temp.notice_switch(false, 'early-test-notice-2026-11-06', 1, 103)$$,
  'P0001', 'solmind_early_test_notice_version_conflict', 'stale setting revision is refused');
select throws_ok($$select * from public.solmind_set_explorer_early_test_notice_setting_v1(
  false, 'early-test-notice-2026-11-06', 2, pg_temp.notice_id(103),
  'admin', pg_temp.notice_id(4), 'paul_approved_configuration_change')$$,
  'P0001', 'solmind_early_test_notice_invalid_authority', 'routine Admin role is no operator authority');
select throws_ok($$select * from public.solmind_set_explorer_early_test_notice_setting_v1(
  false, 'early-test-notice-2026-11-06', 2, pg_temp.notice_id(103),
  'paul_approved', null, 'paul_approved_configuration_change')$$,
  'P0001', 'solmind_early_test_notice_invalid_authority', 'setting change requires its authority reference');
select throws_ok($$select * from public.solmind_set_explorer_early_test_notice_setting_v1(
  false, 'early-test-notice-2026-11-06', 2, pg_temp.notice_id(103),
  'paul_approved', pg_temp.notice_id(900), 'runbook_configuration_change')$$,
  'P0001', 'solmind_early_test_notice_invalid_authority', 'setting reason must match its authority');
select throws_ok($$select * from public.solmind_set_explorer_early_test_notice_setting_v1(
  null, 'early-test-notice-2026-11-06', 2, pg_temp.notice_id(103),
  'paul_approved', pg_temp.notice_id(900), 'paul_approved_configuration_change')$$,
  'P0001', 'solmind_early_test_notice_invalid_input', 'null switch cannot open the app');

select throws_ok(format('select * from public.solmind_read_explorer_early_test_notice_v1(%L::uuid,%L::uuid)',
    pg_temp.notice_id(n), pg_temp.notice_id(40 + n)),
  'P0001', 'solmind_early_test_notice_denied',
  'status refuses Guide/Admin/inactive/revoked/expired/wrong-role/suspended/future-grant actor ' || n)
  from generate_series(3, 10) n;
select throws_ok(format('select * from public.solmind_agree_explorer_early_test_notice_v1(%L::uuid,%L::uuid,%L,true)',
    pg_temp.notice_id(n), pg_temp.notice_id(40 + n), 'early-test-notice-2026-11-06'),
  'P0001', 'solmind_early_test_notice_denied', 'agreement also refuses unauthorized actor ' || n)
  from generate_series(3, 10) n;
select throws_ok($$select * from public.solmind_read_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(42))$$,
  'P0001', 'solmind_early_test_notice_denied', 'another Explorer session cannot read this account');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(42), 'early-test-notice-2026-11-06', true)$$,
  'P0001', 'solmind_early_test_notice_denied', 'another Explorer session cannot record this account agreement');
select throws_ok($$select * from public.solmind_read_explorer_early_test_notice_v1(null, null)$$,
  'P0001', 'solmind_early_test_notice_denied', 'null actor/session is denied');
select throws_ok($$select * from public.solmind_read_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(999))$$,
  'P0001', 'solmind_early_test_notice_denied', 'absent session is denied');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(41), 'early-test-notice-2026-11-06', false)$$,
  'P0001', 'solmind_early_test_notice_invalid_input', 'adult affirmation must be true');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(41), 'early-test-notice-2026-11-06', null)$$,
  'P0001', 'solmind_early_test_notice_invalid_input', 'missing adult affirmation is refused');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(41), 'wrong-version', true)$$,
  'P0001', 'solmind_early_test_notice_unavailable', 'a stale or invented notice version cannot be accepted');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(41), 'free form content', true)$$,
  'P0001', 'solmind_early_test_notice_invalid_input', 'version field cannot carry free-form content');
reset role;
select is((select count(*)::integer from identity.explorer_early_test_notice_agreement), 0,
  'all declined, disabled and invalid calls have saved no agreement');
select is((select count(*)::integer from audit.audit_event
  where event_type = 'explorer_early_test_notice_agreed'), 0, 'they have written no agreement audit');
select is((select count(*)::integer from audit.audit_event
  where event_type = 'explorer_early_test_notice_setting_changed'), 1,
  'only the real setting change is audited');
select is((select metadata from audit.audit_event where event_type = 'explorer_early_test_notice_setting_changed'),
  jsonb_build_object('setting_key', 'explorer_early_test_notice', 'enabled', true,
    'notice_version', 'early-test-notice-2026-11-06', 'expected_version', 1, 'version', 2,
    'operation_id', pg_temp.notice_id(102)::text, 'authority_basis', 'paul_approved',
    'authority_reference_id', pg_temp.notice_id(900)::text), 'setting audit is exact and content-free');

-- The pgTAP exception subtransaction proves that a failed audit cannot leave
-- an agreement behind. This injected failure exists only in this rolled-back test.
create function pg_temp.notice_reject_test_audit() returns trigger language plpgsql as $$
begin
  if NEW.event_type = 'explorer_early_test_notice_agreed'
    and NEW.actor_user_account_id = pg_temp.notice_id(2)
  then raise exception 'notice_test_audit_failure'; end if;
  return NEW;
end $$;
create trigger notice_test_audit_failure before insert on audit.audit_event
  for each row execute function pg_temp.notice_reject_test_audit();
set local role service_role;
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(2), pg_temp.notice_id(42), 'early-test-notice-2026-11-06', true)$$,
  'P0001', 'notice_test_audit_failure', 'agreement cannot commit without its audit');
reset role;
select is((select count(*)::integer from identity.explorer_early_test_notice_agreement
  where user_account_id = pg_temp.notice_id(2)), 0, 'failed audit rolls back the agreement');
drop trigger notice_test_audit_failure on audit.audit_event;

set local role service_role;
select results_eq(
  $$select * from public.solmind_agree_explorer_early_test_notice_v1(
    pg_temp.notice_id(1), pg_temp.notice_id(41), 'early-test-notice-2026-11-06', true)$$,
  $$values(true, 'early-test-notice-2026-11-06'::text, true)$$,
  'first deliberate agreement records the current version even with additional active sessions');
reset role;
create temp table notice_first_agreement as select * from identity.explorer_early_test_notice_agreement;
set local role service_role;
select results_eq(
  $$select * from public.solmind_agree_explorer_early_test_notice_v1(
    pg_temp.notice_id(1), pg_temp.notice_id(41), 'early-test-notice-2026-11-06', true)$$,
  $$values(true, 'early-test-notice-2026-11-06'::text, true)$$,
  'repeat agreement succeeds idempotently');
select results_eq(
  $$select * from public.solmind_read_explorer_early_test_notice_v1(pg_temp.notice_id(1), pg_temp.notice_id(41))$$,
  $$values(true, 'early-test-notice-2026-11-06'::text, true)$$,
  'accepted Explorer status permits the app gate');
select results_eq(
  $$select * from public.solmind_read_explorer_early_test_notice_v1(pg_temp.notice_id(1), pg_temp.notice_id(63))$$,
  $$values(true, 'early-test-notice-2026-11-06'::text, true)$$,
  'another valid exact session of this account sees the same account-bound agreement');
select results_eq(
  $$select * from public.solmind_read_explorer_early_test_notice_v1(pg_temp.notice_id(2), pg_temp.notice_id(42))$$,
  $$values(true, 'early-test-notice-2026-11-06'::text, false)$$,
  'agreement of another account supplies no authority');
reset role;
update identity.user_session set session_status = 'expired', ended_at = clock_timestamp()
 where user_session_id in (pg_temp.notice_id(62), pg_temp.notice_id(63));
create unique index user_session_one_active_per_account_idx
  on identity.user_session (user_account_id) where session_status = 'active';
select ok((select indisunique from pg_index
  where indexrelid = 'identity.user_session_one_active_per_account_idx'::regclass),
  'the fault fixture restores the existing active-session uniqueness rule');
select results_eq($$select * from identity.explorer_early_test_notice_agreement$$,
  $$select * from notice_first_agreement$$, 'idempotent retry preserves every stored field and agreed-at time');
select ok((select adult_affirmation and agreed_at >= transaction_timestamp()
  and agreed_at <= clock_timestamp() from identity.explorer_early_test_notice_agreement),
  'database time and true adult affirmation are stored');
select is((select count(*)::integer from audit.audit_event where event_type = 'explorer_early_test_notice_agreed'),
  1, 'exactly one agreement audit exists after retry');
select ok((select e.actor_user_account_id = a.user_account_id and e.actor_role_context = 'explorer'
  and e.target_entity_type = 'explorer_early_test_notice_agreement' and e.target_entity_id = a.agreement_id
  and e.action = 'agree' and e.reason_code = 'explorer_confirmed_early_test_notice'
  and e.event_summary = 'Explorer agreed to the early-test notice and affirmed adulthood.'
  and e.created_at = a.agreed_at and e.ip_address is null and e.user_agent is null
  and e.metadata = jsonb_build_object('notice_version', a.notice_version, 'adult_affirmation', true)
  from identity.explorer_early_test_notice_agreement a join audit.audit_event e
    on e.target_entity_id = a.agreement_id and e.event_type = 'explorer_early_test_notice_agreed'),
  'agreement audit is atomically bound, exact and free of messages or request metadata');
select throws_ok($$insert into identity.explorer_early_test_notice_agreement
  (user_account_id, notice_version, adult_affirmation)
  values (pg_temp.notice_id(1), 'early-test-notice-2026-11-06', true)$$,
  '23505', null, 'account/version uniqueness is enforced by the table');
select throws_ok($$insert into identity.explorer_early_test_notice_agreement
  (user_account_id, notice_version, adult_affirmation)
  values (pg_temp.notice_id(2), 'early-test-notice-2026-11-06', false)$$,
  '23514', null, 'the table independently rejects false adult affirmation');
select throws_ok($$update identity.explorer_early_test_notice_agreement set agreed_at = clock_timestamp()$$,
  'P0001', 'solmind_early_test_notice_agreement_immutable', 'even owner updates cannot rewrite an agreement');
select throws_ok($$delete from identity.explorer_early_test_notice_agreement$$,
  'P0001', 'solmind_early_test_notice_agreement_immutable', 'agreements cannot be deleted while their accounts exist');
select throws_ok($$truncate identity.explorer_early_test_notice_agreement$$,
  'P0001', 'solmind_early_test_notice_agreement_immutable', 'agreements cannot be truncated');
select throws_ok($$update audit.audit_event set metadata = '{}'::jsonb
  where event_type = 'explorer_early_test_notice_agreed'$$,
  'P0001', 'solmind_early_test_notice_audit_immutable', 'agreement audit cannot be rewritten');
select throws_ok($$delete from audit.audit_event where event_type = 'explorer_early_test_notice_agreed'$$,
  'P0001', 'solmind_early_test_notice_audit_immutable', 'agreement audit cannot be deleted');
select throws_ok($$delete from audit.audit_event where event_type = 'explorer_early_test_notice_setting_changed'$$,
  'P0001', 'solmind_early_test_notice_audit_immutable', 'setting change audit cannot be deleted');
-- Shared audit operations outside the two notice families keep their existing
-- behavior. The notice owns row-level update/delete protection only.
insert into audit.audit_event (audit_event_id, event_type, actor_role_context, action, event_summary)
values (pg_temp.notice_id(200), 'notice_test_unrelated_event', 'system', 'test', 'Synthetic unrelated audit.');
select lives_ok($$update audit.audit_event set event_summary = 'Updated synthetic unrelated audit.'
  where audit_event_id = pg_temp.notice_id(200)$$, 'notice guard does not block unrelated audit updates');
select throws_ok($$update audit.audit_event set event_type = 'explorer_early_test_notice_agreed'
  where audit_event_id = pg_temp.notice_id(200)$$,
  'P0001', 'solmind_early_test_notice_audit_immutable', 'an unrelated audit cannot be relabeled as notice evidence');
select lives_ok($$delete from audit.audit_event where audit_event_id = pg_temp.notice_id(200)$$,
  'notice guard does not block unrelated audit deletion');
select throws_ok($$insert into audit.audit_event
  (event_type, actor_user_account_id, actor_role_context, target_entity_type, target_entity_id,
    action, reason_code, event_summary, created_at, metadata)
  select event_type, actor_user_account_id, actor_role_context, target_entity_type, target_entity_id,
    action, reason_code, event_summary, created_at, metadata from audit.audit_event
  where event_type = 'explorer_early_test_notice_agreed'$$,
  '23505', null, 'one agreement cannot receive duplicate audit events');

-- A newer notice is a separate account/version agreement; old evidence stays.
set local role service_role;
select is(pg_temp.notice_switch(true, 'early-test-notice-2026-11-06-r2', 2, 104),
  'applied', 'operator can select a new bounded version');
select results_eq(
  $$select * from public.solmind_read_explorer_early_test_notice_v1(pg_temp.notice_id(1), pg_temp.notice_id(41))$$,
  $$values(true, 'early-test-notice-2026-11-06-r2'::text, false)$$,
  'old-version agreement never bypasses the current-version notice');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(41), 'early-test-notice-2026-11-06', true)$$,
  'P0001', 'solmind_early_test_notice_unavailable', 'stale displayed-version submission is refused');
select results_eq(
  $$select * from public.solmind_agree_explorer_early_test_notice_v1(
    pg_temp.notice_id(1), pg_temp.notice_id(41), 'early-test-notice-2026-11-06-r2', true)$$,
  $$values(true, 'early-test-notice-2026-11-06-r2'::text, true)$$,
  'new version needs its own deliberate agreement');
select is(pg_temp.notice_switch(false, 'early-test-notice-2026-11-06-r2', 3, 105),
  'applied', 'operator can turn the notice off without deleting evidence');
select results_eq(
  $$select * from public.solmind_read_explorer_early_test_notice_v1(pg_temp.notice_id(2), pg_temp.notice_id(42))$$,
  $$values(false, 'early-test-notice-2026-11-06-r2'::text, false)$$,
  'off setting permits the app gate without manufacturing agreement');
reset role;
select is((select count(*)::integer from identity.explorer_early_test_notice_agreement), 2,
  'original and newer agreement records are retained');
select is((select count(*)::integer from audit.audit_event where event_type = 'explorer_early_test_notice_agreed'),
  2, 'each new account/version has exactly one audit');

-- A new session for the same account inherits its agreement, while an ended
-- session cannot use even a previously accepted version.
update identity.user_session set session_status = 'logged_out', ended_at = clock_timestamp()
 where user_session_id = pg_temp.notice_id(41);
insert into identity.user_session (user_session_id, user_account_id, active_role_context, expires_at)
values (pg_temp.notice_id(61), pg_temp.notice_id(1), 'explorer', now() + interval '1 hour');
set local role service_role;
select throws_ok($$select * from public.solmind_read_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(41))$$,
  'P0001', 'solmind_early_test_notice_denied', 'logged-out session cannot read even after agreement');
select results_eq(
  $$select * from public.solmind_read_explorer_early_test_notice_v1(pg_temp.notice_id(1), pg_temp.notice_id(61))$$,
  $$values(false, 'early-test-notice-2026-11-06-r2'::text, true)$$,
  'agreement is per account/version and survives signing in again');
reset role;

set local role authenticated;
select throws_ok($$select * from public.solmind_read_explorer_early_test_notice_setting_v1()$$,
  '42501', null, 'browser roles cannot read configuration by RPC');
select throws_ok($$select * from public.solmind_read_explorer_early_test_notice_v1(null, null)$$,
  '42501', null, 'browser roles cannot call the actor status RPC');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(null, null, null, true)$$,
  '42501', null, 'browser roles cannot call agreement RPC directly');
reset role;

-- Isolate this new FK/guard from existing account-retention references. This
-- owner-written structural fixture adds no audit, role, session or profile.
-- Real account deletion must still satisfy every pre-existing retention FK.
insert into identity.user_account (user_account_id, display_name, account_status)
values (pg_temp.notice_id(11), 'Synthetic Cascade Account', 'deleted');
insert into identity.explorer_early_test_notice_agreement (user_account_id, notice_version, adult_affirmation)
values (pg_temp.notice_id(11), 'early-test-notice-2026-11-06', true),
  (pg_temp.notice_id(11), 'early-test-notice-2026-11-06-r2', true);
select throws_ok($$delete from identity.explorer_early_test_notice_agreement
  where user_account_id = pg_temp.notice_id(11)$$,
  'P0001', 'solmind_early_test_notice_agreement_immutable',
  'marking an account deleted does not permit direct agreement deletion');
select lives_ok($$delete from identity.user_account where user_account_id = pg_temp.notice_id(11)$$,
  'physical account deletion may cascade to its notice agreements');
select is((select count(*)::integer from identity.explorer_early_test_notice_agreement
  where user_account_id = pg_temp.notice_id(11)), 0, 'account deletion removes every notice version for that account');
select is((select count(*)::integer from identity.explorer_early_test_notice_agreement
  where user_account_id = pg_temp.notice_id(1)), 2, 'account deletion preserves another account agreements');

-- SQL and TypeScript use the same lowercase ASCII version token: 1-128
-- characters, with dots and hyphens permitted after its first letter or digit.
set local role service_role;
select throws_ok(format('select pg_temp.notice_switch(false,%L,4,106)', label),
  'P0001', 'solmind_early_test_notice_invalid_input', 'setting rejects invalid version token ' || description)
  from (values ('', 'empty'), ('_bad', 'leading underscore'), ('bad_version', 'underscore'),
    ('Upper', 'uppercase'), (repeat('a', 129), '129 characters')) invalid(label, description);
select throws_ok(format('select * from public.solmind_agree_explorer_early_test_notice_v1(%L::uuid,%L::uuid,%L,true)',
    pg_temp.notice_id(2), pg_temp.notice_id(42), label),
  'P0001', 'solmind_early_test_notice_invalid_input', 'agreement rejects invalid version token ' || description)
  from (values ('', 'empty'), ('_bad', 'leading underscore'), ('bad_version', 'underscore'),
    ('Upper', 'uppercase'), (repeat('a', 129), '129 characters')) invalid(label, description);
select is(pg_temp.notice_switch(true, 'a.' || repeat('a', 125) || '-', 4, 106),
  'applied', 'setting accepts the 128-character version boundary with dots and hyphens');
select results_eq(
  $$select * from public.solmind_agree_explorer_early_test_notice_v1(
    pg_temp.notice_id(2), pg_temp.notice_id(42), 'a.' || repeat('a', 125) || '-', true)$$,
  $$values(true, 'a.' || repeat('a', 125) || '-', true)$$,
  'agreement accepts the same 128-character token as the setting');
select is(pg_temp.notice_switch(true, '1', 5, 107),
  'applied', 'setting accepts the one-character version boundary');
select results_eq(
  $$select * from public.solmind_agree_explorer_early_test_notice_v1(
    pg_temp.notice_id(2), pg_temp.notice_id(42), '1', true)$$,
  $$values(true, '1'::text, true)$$,
  'agreement accepts the same one-character token as the setting');
reset role;
select throws_ok($$update core.explorer_early_test_notice_setting set notice_version = 'bad_version'$$,
  '23514', null, 'the setting table independently enforces the shared version pattern');
select throws_ok($$insert into identity.explorer_early_test_notice_agreement
  (user_account_id, notice_version, adult_affirmation) values (pg_temp.notice_id(2), 'bad_version', true)$$,
  '23514', null, 'the agreement table independently enforces the shared version pattern');

-- An absent configuration is an error, never the default-off result.
delete from core.explorer_early_test_notice_setting;
set local role service_role;
select throws_ok($$select * from public.solmind_read_explorer_early_test_notice_setting_v1()$$,
  'P0001', 'solmind_early_test_notice_unavailable', 'unreadable setting fails closed');
select throws_ok($$select * from public.solmind_read_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(61))$$,
  'P0001', 'solmind_early_test_notice_unavailable', 'actor status also fails closed without its setting');
select throws_ok($$select * from public.solmind_agree_explorer_early_test_notice_v1(
  pg_temp.notice_id(1), pg_temp.notice_id(61), 'early-test-notice-2026-11-06-r2', true)$$,
  'P0001', 'solmind_early_test_notice_unavailable', 'agreement fails closed without its setting');
reset role;
select * from finish();
rollback;
